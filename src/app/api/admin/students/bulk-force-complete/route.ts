import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { invalidateDashboardCache } from "@/lib/dashboard-aggregator";
import { syncStudentIndex } from "@/lib/sync-student-index";
import { normalizeCertName } from "@/lib/cert-name";
import { detailChannelFromCategory, pickRandomCategory } from "@/lib/beasiswa-channel";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/admin/students/bulk-force-complete   (Admin)
 *
 * Luluskan peserta secara massal sampai tersertifikasi. Menangani DUA kondisi:
 *
 *  A. Peserta yang SUDAH punya enrollment course-main (status In Progress /
 *     Selesai) tapi belum klaim sertifikat → di-update jadi certified.
 *  B. Peserta "Belum Start" yang BELUM punya enrollment course-main → dibuatkan
 *     enrollment dari nol (di-enroll), lengkap dengan pre-test, kuis (lulus),
 *     survei 1 & 2, lalu certified. channelSource/beasiswaType/eventId mengikuti
 *     data user bila ada; untuk peserta Instant Form yang belum punya kategori
 *     beasiswa, kategori di-RANDOM deterministik (vl/wpb/bootcamp).
 *
 * PDF TIDAK dibuat di sini — ditandai pdfPending=true lalu digenerate di latar
 * belakang oleh cron /api/cron/generate-pending-pdf (hindari timeout GAS).
 *
 * body { userIds: string[] }
 */

const QUIZ_STEP_ID_DEFAULT = "new-1779462139521";
const SURVEY2_STEP_ID = "new-1779478025717";

// Jawaban benar kuis (sama dengan auto-complete-lead & import-student).
const QUIZ_CORRECT: Record<string, string> = {
  "q-1779462169465": "A",
  "q-1779462319546": "A",
  "q-1779462400362": "B",
};

const SCORE_CHOICES = [60, 70, 100];

/** Skor "acak" deterministik berbasis seed (email) agar stabil bila diulang. */
function pickScore(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return SCORE_CHOICES[h % SCORE_CHOICES.length];
}

/** Ambil Date dari nilai createdAt Firestore (Timestamp / {_seconds} / string). */
function toDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  if (v._seconds) return new Date(v._seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();

    let reqBody: any = {};
    try { reqBody = await req.json(); } catch (e) {}

    const rawUserIds: string[] = reqBody.userIds || [];
    if (!Array.isArray(rawUserIds) || rawUserIds.length === 0) {
      return json({ error: "Daftar userIds kosong atau tidak valid." }, 400);
    }
    // Dedup agar tidak membuat enrollment ganda untuk userId yang sama.
    const userIds = Array.from(new Set(rawUserIds.filter(Boolean)));

    // Enrollment course-main yang sudah ada → peta by userId (untuk kondisi A).
    const enrollmentsSnap = await db.collection("enrollments")
      .where("courseId", "==", "course-main")
      .get();
    const enrollByUser = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    enrollmentsSnap.docs.forEach((d) => {
      const uid = d.data().userId;
      if (uid) enrollByUser.set(uid, d);
    });

    // Info course untuk nama/penyelenggara sertifikat.
    const [courseDoc, settingsDoc] = await Promise.all([
      db.collection("courses").doc("course-main").get(),
      db.collection("settings").doc("app").get(),
    ]);
    const courseTitle = courseDoc.data()?.title || "Literasi Finansial Dasar";
    const issuerName = courseDoc.data()?.certificateConfig?.issuerName || "IODA Academy";
    const settings = settingsDoc.data() || {};
    const certCourseName = settings.mainCertTitle || courseTitle;
    const quizStepId = settings.quizStepId || QUIZ_STEP_ID_DEFAULT;

    const year = new Date().getFullYear();

    let updatedCount = 0;   // kondisi A: enrollment sudah ada
    let enrolledCount = 0;  // kondisi B: dibuatkan enrollment baru (Belum Start)
    let skippedCount = 0;   // sudah certified / tidak relevan
    const touchedUids: string[] = [];

    // Susun stepProgress kuis (lulus) + survei 1 + survei 2 — dipakai dua kondisi.
    function buildStepProgress(score: number): Record<string, any> {
      return {
        [quizStepId]: {
          assessmentResult: {
            answers: { ...QUIZ_CORRECT },
            score,
            passed: true,
            kkm: 60,
            attempts: 1,
            firstPassScore: score,
            lastAttemptAt: FieldValue.serverTimestamp(),
          },
          surveyResult: {
            "sq-1779462786725": 5,
            "sq-1779462798676": "",
            submittedAt: FieldValue.serverTimestamp(),
          },
          completed: true,
          completedAt: FieldValue.serverTimestamp(),
        },
        [SURVEY2_STEP_ID]: {
          surveyResult: {
            "sq-1779478038912": 5,
            submittedAt: FieldValue.serverTimestamp(),
          },
          completed: true,
          completedAt: FieldValue.serverTimestamp(),
        },
      };
    }

    // Proses per peserta. Pakai batch, commit tiap 200 doc (kondisi B menulis
    // 2 dokumen/peserta: users + enrollments).
    let batch = db.batch();
    let ops = 0;
    const flush = async (force = false) => {
      if (ops > 0 && (force || ops >= 200)) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    };

    for (const userId of userIds) {
      const certId = `CERT-${year}-${Math.random().toString(16).substr(2, 6).toUpperCase()}`;
      const existing = enrollByUser.get(userId);

      // Ambil dokumen user (untuk nama, channel, beasiswa, tanggal daftar).
      const uDoc = await db.collection("users").doc(userId).get();
      const u = uDoc.exists ? (uDoc.data() as any) : {};

      let certName =
        u?.profileData?.namaLengkap || u?.displayName || existing?.data().displayName || "Peserta";
      certName = normalizeCertName(certName) || "Peserta";

      // ── Kondisi A: enrollment sudah ada (In Progress / Selesai) ──
      if (existing) {
        const data = existing.data();
        if (data.certificateClaimed) { skippedCount++; continue; }

        const score = pickScore(userId);
        batch.update(existing.ref, {
          certificateClaimed: true,
          certificateClaimedAt: FieldValue.serverTimestamp(),
          certificateCourseName: courseTitle,
          certificateId: certId,
          certificateIssuer: issuerName,
          certificateName: certName,
          status: "certified",
          currentStep: 3,
          updatedAt: FieldValue.serverTimestamp(),
          // Lengkapi progress bila kosong; merge agar progress yang sudah ada tetap.
          stepProgress: { ...(data.stepProgress || {}), ...buildStepProgress(score) },
          certificateDriveUrl: "",
          certificateDriveFileId: "",
          pdfPending: true,
        });
        ops++; updatedCount++; touchedUids.push(userId);
        await flush();
        continue;
      }

      // ── Kondisi B: Belum Start → buat enrollment dari nol ──
      // Channel & beasiswa: ikut data user bila ada, else random deterministik.
      const channelSource = u?.channelSource || "beasiswa";
      let beasiswaType: string | null = u?.beasiswaType || null;
      let detailChannel: string = u?.detailChannel || "";
      if (!beasiswaType) {
        const cat = pickRandomCategory(userId);
        beasiswaType = cat;
        if (!detailChannel) detailChannel = detailChannelFromCategory(cat);
      }
      const eventId = u?.eventId ?? null;

      // Tanggal sertifikat = tanggal daftar user + 1 hari (natural).
      const baseDate = toDate(u?.createdAt) || new Date();
      const certDate = new Date(baseDate);
      certDate.setDate(certDate.getDate() + 1);

      const score = pickScore(userId);
      // Doc id users = Firebase Auth UID (bukan email), dan enrollment lama
      // memakai doc-id terpisah dari userId. Pakai auto-id agar tidak menabrak
      // & konsisten dengan pola enrollment yang ada.
      const enrollRef = db.collection("enrollments").doc();

      batch.set(enrollRef, {
        id: enrollRef.id,
        userId,
        email: u?.email || userId,
        displayName: certName,
        courseId: "course-main",
        channelSource,
        detailChannel,
        beasiswaType,
        eventId,
        currentStep: 3,
        stepProgress: buildStepProgress(score),
        status: "certified",
        certificateClaimed: true,
        certificateClaimedAt: certDate,
        certificateCourseName: certCourseName,
        certificateIssuer: issuerName,
        certificateId: certId,
        certificateName: certName,
        certificateDriveUrl: "",
        certificateDriveFileId: "",
        certificateEmailSent: false,
        pdfPending: true,
        bulkEnrolled: true, // penanda: di-enroll lewat Luluskan Massal
        createdAt: toDate(u?.createdAt) || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      ops++;

      // Pastikan user layak tampil di dashboard (role student & profileCompleted).
      // Tidak menimpa field yang sudah ada; hanya melengkapi yang kosong.
      const userPatch: Record<string, any> = {
        role: u?.role || "student",
        profileCompleted: true,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (!u?.channelSource) userPatch.channelSource = channelSource;
      if (!u?.detailChannel) userPatch.detailChannel = detailChannel;
      if (!u?.beasiswaType) userPatch.beasiswaType = beasiswaType;
      if (!u?.displayName) userPatch.displayName = certName;
      // Pre-test: isi acak bila benar-benar belum ada (konsisten auto-complete).
      const pd = { ...(u?.profileData || {}) };
      if (pd.pretest_score == null || pd.pretest_score === "") {
        let h = 0;
        for (let i = 0; i < userId.length; i++) h = (h * 33 + userId.charCodeAt(i)) >>> 0;
        const pernah = h % 2 === 0;
        pd.pretest_pernah_belajar_financial_literacy = pernah ? "Pernah" : "Belum";
        pd.pretest_score = pernah ? 30 : 10;
        userPatch.profileData = pd;
      }
      batch.set(db.collection("users").doc(userId), userPatch, { merge: true });
      ops++;

      enrolledCount++; touchedUids.push(userId);
      await flush();
    }

    await flush(true);

    if (touchedUids.length === 0) {
      return json({ message: "Peserta yang dipilih sudah memiliki sertifikat atau tidak ditemukan." });
    }

    invalidateDashboardCache();
    touchedUids.forEach((uid) => syncStudentIndex(uid));

    const total = updatedCount + enrolledCount;
    return json({
      success: true,
      message: `Berhasil meluluskan ${total} peserta (${updatedCount} sudah mulai, ${enrolledCount} di-enroll dari Belum Start).`,
      updatedCount: total,
      breakdown: { updated: updatedCount, enrolled: enrolledCount, skipped: skippedCount },
    });

  } catch (e) {
    return handleError(e);
  }
}
