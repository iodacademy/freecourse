/**
 * Helper auto-complete untuk SATU peserta (lead) yang tidak menyelesaikan
 * pelatihan. Dipakai oleh endpoint cron /api/cron/auto-complete.
 *
 * Yang dilakukan untuk satu peserta:
 * 1. Buat/lengkapi dokumen `users` (jika belum verifikasi).
 *    - createdAt disamakan dengan tanggal peserta mengisi form (created_time Meta).
 *    - channelSource: "beasiswa", detail "All Beasiswa - Facebook Instant Forms".
 * 2. Buat/lengkapi dokumen `enrollments`:
 *    - isi kuis (skor acak 60 / 70 / 100, lulus).
 *    - isi survei 1 & survei 2.
 *    - klaim sertifikat (generate PDF via GAS) TANPA kirim email.
 *
 * Aman diulang: jika sudah punya sertifikat (certificateClaimed), dilewati.
 */
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Jawaban benar kuis (sesuai soal di MetaJourney/StandaloneJourney).
const QUIZ_CORRECT: Record<string, string> = {
  "q-1779462169465": "A",
  "q-1779462319546": "A",
  "q-1779462400362": "B",
};

// Pilihan skor acak yang diizinkan (hanya 60, 70, 100).
const SCORE_CHOICES = [60, 70, 100];

function pickScore(seed: string): number {
  // "Acak" deterministik berbasis email agar hasil stabil bila diulang.
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return SCORE_CHOICES[h % SCORE_CHOICES.length];
}

function toDateFromCreatedTime(createdTime: string): Date | null {
  if (!createdTime) return null;
  const d = new Date(createdTime);
  return isNaN(d.getTime()) ? null : d;
}

export interface AutoCompleteResult {
  email: string;
  status: "completed" | "skipped" | "error";
  reason?: string;
  certUrl?: string | null;
}

export async function autoCompleteLead(
  email: string,
  lead: Record<string, any>
): Promise<AutoCompleteResult> {
  const db = getAdminDb();
  const userId = email.toLowerCase();
  const enrollmentId = userId;

  try {
    // Tanggal "daftar" = tanggal isi form (created_time Meta). Fallback ke createdAt lead.
    let formDate = toDateFromCreatedTime(lead.createdTime);
    if (!formDate && lead.createdAt) {
      formDate =
        lead.createdAt._seconds
          ? new Date(lead.createdAt._seconds * 1000)
          : new Date(lead.createdAt);
    }

    const profileData = {
      ...(lead.profileData || {}),
      alamat_email: userId,
    };
    const displayName = String(lead.nama || profileData.nama_lengkap || "Peserta");
    const emailUsername = userId.split("@")[0] || "user";

    // ── 1. users ──
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const userPayload: Record<string, any> = {
      uid: userId,
      email: userId,
      emailUsername,
      displayName,
      role: "student",
      profileCompleted: true,
      channelSource: "beasiswa",
      detailChannel: "All Beasiswa - Facebook Instant Forms",
      eventId: null,
      utmData: lead.utmData || null,
      profileData,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!userSnap.exists) {
      // createdAt = tanggal isi form (bukan tanggal auto-complete).
      userPayload.createdAt = formDate || FieldValue.serverTimestamp();
    }
    await userRef.set(userPayload, { merge: true });

    // ── 2. enrollment ──
    const enrollRef = db.collection("enrollments").doc(enrollmentId);
    const enrollSnap = await enrollRef.get();
    const enrollData = enrollSnap.exists ? enrollSnap.data()! : null;

    // Sudah punya sertifikat → tidak ada yang perlu dikerjakan.
    if (enrollData?.certificateClaimed) {
      return { email: userId, status: "skipped", reason: "already_certified" };
    }

    // Ambil settings untuk id step kuis & konfigurasi sertifikat/GAS.
    const settingsDoc = await db.collection("settings").doc("app").get();
    const settings = settingsDoc.data() || {};
    const quizStepId = settings.quizStepId || "new-1779462139521";
    const survey2StepId = "new-1779478025717";
    const score = pickScore(userId);

    // Susun stepProgress: kuis (lulus) + survei 1 + survei 2.
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
      [survey2StepId]: {
        surveyResult: {
          "sq-1779478038912": 5,
          submittedAt: FieldValue.serverTimestamp(),
        },
        completed: true,
        completedAt: FieldValue.serverTimestamp(),
      },
    };

    const baseEnroll: Record<string, any> = {
      id: enrollmentId,
      userId,
      email: userId,
      displayName,
      courseId: "course-main",
      channelSource: "beasiswa",
      detailChannel: "All Beasiswa - Facebook Instant Forms",
      eventId: null,
      currentStep: 3,
      stepProgress,
      status: "in_progress",
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!enrollSnap.exists) {
      baseEnroll.createdAt = formDate || FieldValue.serverTimestamp();
    }
    await enrollRef.set(baseEnroll, { merge: true });

    // ── 3. Klaim sertifikat (generate PDF via GAS) — TANPA email ──
    const gasWebAppUrl: string = settings.gasWebAppUrl || "";
    const mainCertSlideTemplateId: string = settings.mainCertSlideTemplateId || "";
    const courseName = settings.mainCertTitle || "Workshop Literasi Finansial";
    const issuerName = "IODA Academy";

    const year = (formDate || new Date()).getFullYear();
    const randomHex = Math.random().toString(16).substr(2, 6).toUpperCase();
    const certId = `CERT-${year}-${randomHex}`;

    let driveUrl: string | null = null;
    let driveFileId: string | null = null;

    // Tanggal sertifikat = 1 hari setelah tanggal daftar (created_time form),
    // agar tanggal klaim berbeda dari tanggal daftar (terlihat natural).
    const certDate = new Date(formDate || new Date());
    certDate.setDate(certDate.getDate() + 1);

    if (gasWebAppUrl) {
      const claimDate = `${certDate.getDate()} ${MONTHS[certDate.getMonth()]} ${certDate.getFullYear()}`;
      try {
        const gasRes = await fetch(gasWebAppUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate_main_cert",
            templateId: mainCertSlideTemplateId,
            certId,
            userName: displayName,
            courseName,
            claimDate,
            email: userId,
          }),
        });
        if (gasRes.ok) {
          const gasData = await gasRes.json();
          driveUrl = gasData.downloadUrl || gasData.pdfUrl || null;
          driveFileId = gasData.fileId || null;
        }
      } catch (e) {
        console.error("[auto-complete] GAS error:", userId, e);
      }
    }

    await enrollRef.set(
      {
        status: "certified",
        certificateClaimed: true,
        certificateClaimedAt: certDate,
        certificateCourseName: courseName,
        certificateIssuer: issuerName,
        certificateId: certId,
        certificateName: displayName,
        certificateDriveUrl: driveUrl || "",
        certificateDriveFileId: driveFileId || "",
        certificateEmailSent: false,
        autoCompleted: true, // penanda: diselesaikan otomatis oleh sistem
        autoCompletedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Tandai lead sudah diverifikasi & diproses.
    await db.collection("leads").doc(userId).set(
      {
        verified: true,
        autoCompleted: true,
        autoCompletedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { email: userId, status: "completed", certUrl: driveUrl };
  } catch (e: any) {
    console.error("[auto-complete] error:", email, e);
    return { email, status: "error", reason: e?.message || String(e) };
  }
}
