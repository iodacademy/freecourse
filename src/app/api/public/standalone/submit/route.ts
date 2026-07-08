import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { invalidateDashboardCache } from '@/lib/dashboard-aggregator';
import { syncStudentIndex } from '@/lib/sync-student-index';
import { normalizeCertName, validateCertName } from '@/lib/cert-name';
import { FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';

const ALLOWED_ORIGINS = new Set([
  'https://app.iodacademy.id',
  'http://localhost:5173',
  'http://localhost:5174',
]);

const corsHeaders = (request: NextRequest) => {
  const origin = request.headers.get('origin') || '';
  return {
    ...(ALLOWED_ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
};

const json = (request: NextRequest, data: unknown, status = 200) => NextResponse.json(data, {
  status,
  headers: corsHeaders(request),
});

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, payload } = body;

    if (!email) {
      return json(request, { error: 'Email is required' }, 400);
    }

    const db = getAdminDb();
    const userId = email.toLowerCase(); // Use email as the document ID for simplicity and uniqueness
    const enrollmentId = userId;
    const cleanPayloadObject = (value: any) => (
      value && typeof value === 'object' && !Array.isArray(value) ? value : {}
    );
    const mergeStepProgress = (current: any, next: any) => ({
      ...cleanPayloadObject(current),
      ...cleanPayloadObject(next),
    });
    
    // Get settings for dynamic step IDs
    const settingsDoc = await db.collection("settings").doc("app").get();
    const settings = settingsDoc.data() || {};
    const quizStepId = settings.quizStepId || "new-1779462139521";
    const survey2StepId = "new-1779478025717"; // Derived from main app structure

    if (action === 'identity') {
      // 1. Save Identity Form
      const userRef = db.collection('users').doc(userId);
      await userRef.set({
        uid: userId,
        email: email,
        displayName: payload.nama_lengkap || '',
        channelSource: payload.channelSource || 'beasiswa',
        detailChannel: payload.detailChannel || 'All Beasiswa - Facebook Instant Forms',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        profileCompleted: true,
        role: 'student',
        profileData: payload
      }, { merge: true });

      // Initialize enrollment if it doesn't exist
      const enrollmentRef = db.collection('enrollments').doc(enrollmentId);
      const enrollmentSnap = await enrollmentRef.get();
      const enrollmentData = enrollmentSnap.data() || {};

      await enrollmentRef.set({
        ...(!enrollmentSnap.exists ? {
          id: enrollmentId,
          userId: userId,
          email: email,
          createdAt: FieldValue.serverTimestamp(),
          stepProgress: {},
        } : {}),
        displayName: payload.nama_lengkap || enrollmentData.displayName || '',
        courseId: payload.courseId || enrollmentData.courseId || 'course-main',
        channelSource: payload.channelSource || enrollmentData.channelSource || 'beasiswa',
        detailChannel: payload.detailChannel || enrollmentData.detailChannel || 'All Beasiswa - Facebook Instant Forms',
        beasiswaType: payload.beasiswaType || enrollmentData.beasiswaType || 'bootcamp',
        bulkEnrolled: enrollmentData.bulkEnrolled ?? true,
        certificateClaimed: enrollmentData.certificateClaimed ?? false,
        certificateClaimedAt: enrollmentData.certificateClaimedAt ?? null,
        certificateDriveUrl: enrollmentData.certificateDriveUrl ?? "",
        certificateDriveFileId: enrollmentData.certificateDriveFileId ?? "",
        certificateEmailSent: enrollmentData.certificateEmailSent ?? false,
        pdfPending: enrollmentData.pdfPending ?? false,
        updatedAt: FieldValue.serverTimestamp(),
        currentStep: Math.max(Number(enrollmentData.currentStep || 1), 1),
        status: enrollmentData.status || 'active',
      }, { merge: true });

      // Tandai lead INI sudah verifikasi (mengisi identitas). Dipakai tombol
      // "Auto Complete — Instant Form" untuk MELEWATI peserta yang sudah jadi
      // siswa, agar tidak memproses ulang ratusan lead lama. Pakai update agar
      // tidak membuat dokumen leads baru bila lead-nya tidak ada.
      try {
        await db.collection('leads').doc(userId).update({
          verified: true,
          verifiedAt: FieldValue.serverTimestamp(),
        });
      } catch {
        // Lead tidak ada (mis. peserta non-instant-form) → abaikan.
      }

      syncStudentIndex(userId);
      return json(request, { success: true, message: 'Identity saved' });
    }

    if (action === 'pretest') {
      // Simpan jawaban + nilai Pre-test ke users.profileData (bukan enrollments).
      const answer = payload?.pretest_pernah_belajar_financial_literacy ?? "";
      const score = answer === "Pernah" ? 30 : 10;
      const userRef = db.collection('users').doc(userId);
      await userRef.set({
        updatedAt: FieldValue.serverTimestamp(),
        profileData: {
          pretest_pernah_belajar_financial_literacy: answer,
          pretest_score: score,
        },
      }, { merge: true });

      syncStudentIndex(userId);
      return json(request, { success: true, message: 'Pre-test saved', score });
    }

    if (action === 'quiz') {
      // 2. Update Quiz Score
      const enrollmentRef = db.collection('enrollments').doc(enrollmentId);
      
      const stepKey = quizStepId;
      
      await enrollmentRef.set({
        updatedAt: FieldValue.serverTimestamp(),
        currentStep: 2, // Move to Survey step
        stepProgress: {
          [stepKey]: {
            assessmentResult: {
              answers: payload.answers,
              score: payload.score,
              passed: payload.passed,
              kkm: payload.kkm,
              attempts: 1,
              firstPassScore: payload.score,
              lastAttemptAt: FieldValue.serverTimestamp()
            },
            completed: payload.passed,
            completedAt: payload.passed ? FieldValue.serverTimestamp() : null
          }
        }
      }, { merge: true });

      syncStudentIndex(userId);
      return json(request, { success: true, message: 'Quiz updated' });
    }

    if (action === 'survey') {
      // 3. Update Survey
      const enrollmentRef = db.collection('enrollments').doc(enrollmentId);
      const { surveyType } = payload;
      const stepKey = surveyType === 'survei1' ? quizStepId : survey2StepId;
      
      await enrollmentRef.set({
        updatedAt: FieldValue.serverTimestamp(),
        currentStep: 3, // Move to Extra Material / Certificate
        stepProgress: {
          [stepKey]: {
            surveyResult: payload.surveyResult,
            submittedAt: FieldValue.serverTimestamp(),
            completed: true,
            completedAt: FieldValue.serverTimestamp()
          }
        }
      }, { merge: true });

      syncStudentIndex(userId);
      return json(request, { success: true, message: 'Survey updated' });
    }

    if (action === 'sync_enrollment') {
      // Sinkronisasi dari Student Center untuk peserta yang sudah certified
      // sebelum enrollment berhasil dibuat di database Financial Literacy.
      const enrollmentRef = db.collection('enrollments').doc(enrollmentId);
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      const enrollmentDoc = await enrollmentRef.get();
      const enrollmentData = enrollmentDoc.data() || {};
      const profileData = cleanPayloadObject(payload.profileData || userDoc.data()?.profileData);
      const displayName = payload.displayName || payload.confirmedName || profileData.nama_lengkap || userDoc.data()?.displayName || '';
      const stepProgress = mergeStepProgress(enrollmentData.stepProgress, payload.stepProgress);
      const driveUrl = payload.certificateDriveUrl || payload.driveUrl || enrollmentData.certificateDriveUrl || '';

      await enrollmentRef.set({
        ...(!enrollmentDoc.exists ? {
          id: enrollmentId,
          userId: userId,
          email: email,
          createdAt: FieldValue.serverTimestamp(),
          stepProgress: {},
        } : {}),
        displayName,
        courseId: payload.courseId || 'course-main',
        channelSource: payload.channelSource || userDoc.data()?.channelSource || 'beasiswa',
        detailChannel: payload.detailChannel || userDoc.data()?.detailChannel || 'All Beasiswa - Facebook Instant Forms',
        beasiswaType: payload.beasiswaType || userDoc.data()?.beasiswaType || 'bootcamp',
        bulkEnrolled: true,
        currentStep: 3,
        updatedAt: FieldValue.serverTimestamp(),
        status: 'certified',
        certificateClaimed: true,
        certificateClaimedAt: enrollmentData.certificateClaimedAt || FieldValue.serverTimestamp(),
        certificateCourseName: payload.certificateCourseName || 'Financial Literacy',
        certificateIssuer: payload.certificateIssuer || 'IODA Academy',
        certificateId: payload.certificateId || enrollmentData.certificateId || '',
        certificateName: payload.confirmedName || displayName,
        certificateDriveUrl: driveUrl,
        certificateDriveFileId: payload.certificateDriveFileId || enrollmentData.certificateDriveFileId || '',
        certificateEmailSent: enrollmentData.certificateEmailSent ?? false,
        pdfPending: !driveUrl,
        ...(Object.keys(stepProgress).length ? { stepProgress } : {}),
        ...(payload.customFormResult ? { customFormResult: payload.customFormResult } : {}),
        ...(payload.quiz ? { quiz: payload.quiz } : {}),
        ...(payload.survey ? { survey: payload.survey } : {}),
      }, { merge: true });

      invalidateDashboardCache();
      syncStudentIndex(userId);

      return json(request, { success: true, message: 'Enrollment synced' });
    }

    if (action === 'certificate_status') {
      const enrollmentRef = db.collection('enrollments').doc(enrollmentId);
      const enrollmentDoc = await enrollmentRef.get();
      if (!enrollmentDoc.exists) {
        return json(request, { error: 'Enrollment belum ditemukan.' }, 404);
      }

      const enrollmentData = enrollmentDoc.data() || {};
      const syncToken = String(payload?.syncToken || payload?.certificateSyncToken || '').trim();
      const storedToken = String(enrollmentData.studentCenterSyncToken || '').trim();
      if (!storedToken || syncToken !== storedToken) {
        return json(request, { error: 'Token sinkronisasi tidak valid.' }, 403);
      }

      return json(request, {
        success: true,
        certificateClaimed: enrollmentData.certificateClaimed === true,
        status: enrollmentData.status || '',
        certificateId: enrollmentData.certificateId || '',
        certificateDriveUrl: enrollmentData.certificateDriveUrl || '',
        driveUrl: enrollmentData.certificateDriveUrl || '',
        certificateDriveFileId: enrollmentData.certificateDriveFileId || '',
        pdfPending: enrollmentData.pdfPending === true,
        syncToken: storedToken,
      });
    }

    if (action === 'certificate') {
      // 4. Claim Certificate
      const enrollmentRef = db.collection('enrollments').doc(enrollmentId);
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      const enrollmentDoc = await enrollmentRef.get();
      const enrollmentData = enrollmentDoc.data() || {};
      const settingsDoc = await db.collection("settings").doc("app").get();

      // Jika peserta mengonfirmasi/memperbaiki nama saat klaim sertifikat,
      // pakai nama itu (dirapikan) untuk sertifikat DAN simpan ke semua data.
      const confirmedNameRaw = (payload && payload.confirmedName) || "";
      const confirmedName = normalizeCertName(confirmedNameRaw);
      const userName = confirmedName || normalizeCertName(userDoc.data()?.displayName || "");
      const issuerName = 'IODA Academy';

      // Jalur peserta → nama WAJIB valid (cegah nama kosong / NIK / font fancy
      // yang tak ter-render). Tolak dengan pesan ramah-pengguna bila tak layak.
      try { validateCertName(userName); }
      catch (e: any) {
        return json(
          request,
          { error: e?.message || "Nama tidak valid. Isi nama lengkap sesuai KTP." },
          400
        );
      }

      // Sinkronkan nama ke users (displayName + profileData.nama_lengkap)
      // dan enrollments (displayName) agar semua data ikut nama sertifikat.
      if (confirmedName) {
        await userRef.set(
          {
            displayName: confirmedName,
            profileData: { nama_lengkap: confirmedName },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        await enrollmentRef.set(
          {
            displayName: confirmedName,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      
      const year = new Date().getFullYear();
      const randomHex = Math.random().toString(16).substr(2, 6).toUpperCase();
      const certId = enrollmentData.certificateId || `CERT-${year}-${randomHex}`;

      // (We already fetched settings at the top)
      const gasWebAppUrl = settings.gasWebAppUrl || "";
      const mainCertSlideTemplateId = settings.mainCertSlideTemplateId || "";
      
      const courseName = settings.mainCertTitle || 'Workshop Literasi Finansial';

      let driveUrl = enrollmentData.certificateDriveUrl || null;
      let driveFileId = enrollmentData.certificateDriveFileId || null;
      const syncToken = enrollmentData.studentCenterSyncToken || randomBytes(24).toString('hex');
      const stepProgress = mergeStepProgress(enrollmentData.stepProgress, payload.stepProgress);
      const hasDriveUrl = !!driveUrl;

      await enrollmentRef.set({
        ...(!enrollmentDoc.exists ? {
          id: enrollmentId,
          userId: userId,
          email: email,
          createdAt: FieldValue.serverTimestamp(),
        } : {}),
        displayName: userName,
        courseId: payload.courseId || enrollmentData.courseId || 'course-main',
        channelSource: payload.channelSource || userDoc.data()?.channelSource || enrollmentData.channelSource || 'beasiswa',
        detailChannel: payload.detailChannel || userDoc.data()?.detailChannel || enrollmentData.detailChannel || 'All Beasiswa - Facebook Instant Forms',
        beasiswaType: payload.beasiswaType || userDoc.data()?.beasiswaType || enrollmentData.beasiswaType || 'bootcamp',
        bulkEnrolled: enrollmentData.bulkEnrolled ?? true,
        currentStep: Math.max(Number(enrollmentData.currentStep || 1), 3),
        updatedAt: FieldValue.serverTimestamp(),
        status: 'certified',
        certificateClaimed: true,
        certificateClaimedAt: enrollmentData.certificateClaimedAt || FieldValue.serverTimestamp(),
        certificateCourseName: payload.certificateCourseName || courseName,
        certificateIssuer: payload.certificateIssuer || issuerName,
        certificateId: certId,
        certificateName: userName,
        certificateDriveUrl: driveUrl || "",
        certificateDriveFileId: driveFileId || "",
        certificateEmailSent: enrollmentData.certificateEmailSent ?? false,
        studentCenterSyncToken: syncToken,
        pdfPending: !hasDriveUrl,
        stepProgress,
        ...(payload.customFormResult ? { customFormResult: payload.customFormResult } : {}),
        ...(payload.quiz ? { quiz: payload.quiz } : {}),
        ...(payload.survey ? { survey: payload.survey } : {}),
      }, { merge: true });

      if (!gasWebAppUrl || !mainCertSlideTemplateId) {
        invalidateDashboardCache();
        syncStudentIndex(userId);
        return json(request, {
          success: true,
          message: 'Certificate recorded, PDF queued',
          certId,
          driveUrl: driveUrl || "",
          pdfPending: true,
          syncToken,
        });
      }

      if (gasWebAppUrl && !driveUrl) {
        try {
          const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
          const now = new Date();
          const claimDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

          const gasPayload = {
            action: "generate_main_cert",
            templateId: mainCertSlideTemplateId,
            certId,
            userName,
            courseName,
            claimDate,
            email: email,
          };

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 20000);
          const gasRes = await fetch(gasWebAppUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(gasPayload),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          const gasData = await gasRes.json().catch(() => ({}));

          if (gasRes.ok) {
            driveUrl = gasData.downloadUrl
              || gasData.pdfUrl
              || gasData.driveUrl
              || gasData.certificateDriveUrl
              || gasData.webViewLink
              || gasData.viewUrl
              || gasData.url
              || null;
            driveFileId = gasData.fileId
              || gasData.driveFileId
              || gasData.certificateDriveFileId
              || null;
          } else {
            console.error("GAS certificate failed:", gasData);
          }
        } catch (gasErr) {
          console.error("GAS error:", gasErr);
        }
      }

      await enrollmentRef.set({
        updatedAt: FieldValue.serverTimestamp(),
        certificateDriveUrl: driveUrl || "",
        certificateDriveFileId: driveFileId || "",
        pdfPending: !driveUrl,
      }, { merge: true });

      invalidateDashboardCache();
      syncStudentIndex(userId);

      return json(request, {
        success: true,
        message: driveUrl ? 'Certificate claimed' : 'Certificate recorded, PDF queued',
        certId,
        driveUrl: driveUrl || "",
        pdfPending: !driveUrl,
        syncToken,
      });
    }

    return json(request, { error: 'Invalid action' }, 400);

  } catch (error: any) {
    console.error('API Standalone Submit Error:', error);
    return json(request, { error: error.message || 'Internal Server Error' }, 500);
  }
}
