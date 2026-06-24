/**
 * Helper import SATU peserta dari file (Excel/CSV) langsung berstatus SELESAI
 * (tersertifikasi), TAPI tanpa generate PDF sertifikat. PDF dibuat belakangan
 * di latar belakang oleh cron /api/cron/generate-pending-pdf.
 *
 * Yang dibuat untuk satu peserta:
 *  1. users      — profil lengkap, createdAt = tanggal ACAK (dari import).
 *  2. enrollments — kuis (lulus, skor acak), survei 1 & 2, status "certified",
 *                   certificateId terisi, certificateDriveUrl KOSONG (menandai
 *                   PDF belum dibuat → akan dikerjakan cron).
 *
 * Aman diulang: bila enrollment sudah certified → dilewati (skipped).
 */
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { detailChannelFromCategory, pickRandomCategory } from "@/lib/beasiswa-channel";
import { normalizePhone, normalizeDob, normalizeGender } from "@/lib/import-normalize";

// Jawaban benar kuis (sama dengan auto-complete-lead).
const QUIZ_CORRECT: Record<string, string> = {
  "q-1779462169465": "A",
  "q-1779462319546": "A",
  "q-1779462400362": "B",
};
const SCORE_CHOICES = [60, 70, 100];

function pickScore(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return SCORE_CHOICES[h % SCORE_CHOICES.length];
}

// Pre-test diacak (deterministik per email) antara "Pernah" (skor 30) dan
// "Belum" (skor 10) — mengikuti aturan di /api/public/standalone/submit.
function pickPretest(seed: string): { answer: string; score: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  return h % 2 === 0
    ? { answer: "Pernah", score: 30 }
    : { answer: "Belum", score: 10 };
}

export interface ImportRow {
  email: string;
  nama?: string;
  noWa?: string;
  jenisKelamin?: string;
  tanggalLahir?: string; // YYYY-MM-DD
  kota?: string;
  disabilitas?: string;
  jenisDisabilitas?: string;
  minat?: string;
}

export interface ImportStudentResult {
  email: string;
  status: "completed" | "skipped" | "error";
  reason?: string;
}

export async function importStudent(
  row: ImportRow,
  createdAtMs: number
): Promise<ImportStudentResult> {
  const db = getAdminDb();
  const email = (row.email || "").toLowerCase().trim();
  if (!email) return { email: "", status: "error", reason: "email_kosong" };

  const userId = email;
  const enrollmentId = email;
  const createdAtTs = Timestamp.fromMillis(createdAtMs);

  try {
    const displayName = String(row.nama || "Peserta").trim();
    const emailUsername = email.split("@")[0] || "user";

    // Kategori beasiswa diacak (deterministik per email) → detailChannel ikut.
    const beasiswaCategory = pickRandomCategory(email);
    const detailChannel = detailChannelFromCategory(beasiswaCategory);

    // Pre-test diacak Pernah/Belum (dibaca dashboard dari profileData.pretest_score).
    const pretest = pickPretest(email);

    // Rapikan data mentah agar konsisten & terbaca dashboard.
    const noWaClean = normalizePhone(row.noWa || "");      // tanpa 62/0 di depan
    const dobClean = normalizeDob(row.tanggalLahir || ""); // YYYY-MM-DD (asumsi DD/MM)
    const genderClean = normalizeGender(row.jenisKelamin || "");

    // profileData mengikuti nama field standalone (lihat leads/ingest).
    const profileData: Record<string, any> = {
      nama_lengkap: displayName,
      alamat_email: email,
      jenis_kelamin: genderClean,
      tanggal_lahir: dobClean,
      nomor_whatsapp: noWaClean,
      asal_daerah: row.kota || "",
      disabilitas: row.disabilitas || "",
      kategori_disabilitas_yang_anda_miliki: row.jenisDisabilitas || "",
      jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati: row.minat || "",
      pretest_pernah_belajar_financial_literacy: pretest.answer,
      pretest_score: pretest.score,
      channelSource: "import",
    };

    // ── 1. users ──
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const userPayload: Record<string, any> = {
      uid: userId,
      email,
      emailUsername,
      displayName,
      role: "student",
      profileCompleted: true,
      channelSource: "beasiswa",
      detailChannel,
      beasiswaType: beasiswaCategory,
      eventId: null,
      profileData,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!userSnap.exists) {
      userPayload.createdAt = createdAtTs; // tanggal daftar ACAK
    }
    await userRef.set(userPayload, { merge: true });

    // ── 2. enrollment ──
    const enrollRef = db.collection("enrollments").doc(enrollmentId);
    const enrollSnap = await enrollRef.get();
    const enrollData = enrollSnap.exists ? enrollSnap.data()! : null;

    // Sudah punya sertifikat → jangan timpa.
    if (enrollData?.certificateClaimed) {
      return { email, status: "skipped", reason: "already_certified" };
    }

    const settingsDoc = await db.collection("settings").doc("app").get();
    const settings = settingsDoc.data() || {};
    const quizStepId = settings.quizStepId || "new-1779462139521";
    const survey2StepId = "new-1779478025717";
    const score = pickScore(email);

    const stepProgress: Record<string, any> = {
      ...(enrollData?.stepProgress || {}),
      [quizStepId]: {
        assessmentResult: {
          answers: { ...QUIZ_CORRECT },
          score,
          passed: true,
          kkm: 60,
          attempts: 1,
          firstPassScore: score,
          lastAttemptAt: createdAtTs,
        },
        surveyResult: {
          "sq-1779462786725": 5,
          "sq-1779462798676": "",
          submittedAt: createdAtTs,
        },
        completed: true,
        completedAt: createdAtTs,
      },
      [survey2StepId]: {
        surveyResult: {
          "sq-1779478038912": 5,
          submittedAt: createdAtTs,
        },
        completed: true,
        completedAt: createdAtTs,
      },
    };

    // Sertifikat: tanggal 1 hari setelah daftar (natural), PDF dibuat belakangan.
    const courseName = settings.mainCertTitle || "Workshop Literasi Finansial";
    const issuerName = "IODA Academy";
    const year = new Date(createdAtMs).getFullYear();
    const randomHex = Math.random().toString(16).slice(2, 8).toUpperCase();
    const certId = `CERT-${year}-${randomHex}`;
    const certDateMs = createdAtMs + 24 * 60 * 60 * 1000; // +1 hari
    const certDateTs = Timestamp.fromMillis(certDateMs);

    const baseEnroll: Record<string, any> = {
      id: enrollmentId,
      userId,
      email,
      displayName,
      courseId: "course-main",
      channelSource: "beasiswa",
      detailChannel,
      beasiswaType: beasiswaCategory,
      eventId: null,
      currentStep: 3,
      stepProgress,
      status: "certified",
      certificateClaimed: true,
      certificateClaimedAt: certDateTs,
      certificateCourseName: courseName,
      certificateIssuer: issuerName,
      certificateId: certId,
      certificateName: displayName,
      certificateDriveUrl: "", // KOSONG → penanda PDF belum dibuat (untuk cron)
      certificateDriveFileId: "",
      certificateEmailSent: false,
      importedStudent: true, // penanda: berasal dari import file
      pdfPending: true, // penanda eksplisit agar cron mudah memfilter
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!enrollSnap.exists) {
      baseEnroll.createdAt = createdAtTs; // tanggal daftar ACAK (sama dgn user)
    }
    await enrollRef.set(baseEnroll, { merge: true });

    return { email, status: "completed" };
  } catch (e: any) {
    console.error("[import-student] error:", email, e);
    return { email, status: "error", reason: e?.message || String(e) };
  }
}
