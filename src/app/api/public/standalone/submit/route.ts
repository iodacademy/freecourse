import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Rapikan nama untuk sertifikat:
 * - buang emoji & karakter aneh (sisakan huruf, spasi, titik, apostrof, strip)
 * - rapikan spasi berlebih
 * - jadikan Title Case (Huruf Besar Di Awal Kata)
 */
function rapikanNama(input: string): string {
  if (!input) return "";
  let s = String(input);
  // Sisakan huruf (termasuk aksen), spasi, titik, apostrof, dan strip.
  s = s.replace(/[^\p{L}\s.'-]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
  return s;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, payload } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const db = getAdminDb();
    const userId = email.toLowerCase(); // Use email as the document ID for simplicity and uniqueness
    const enrollmentId = userId;
    
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
        channelSource: payload.channelSource || 'standalone',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        profileCompleted: true,
        role: 'student',
        profileData: payload
      }, { merge: true });

      // Initialize enrollment if it doesn't exist
      const enrollmentRef = db.collection('enrollments').doc(enrollmentId);
      const enrollmentSnap = await enrollmentRef.get();
      
      if (!enrollmentSnap.exists) {
        await enrollmentRef.set({
          id: enrollmentId,
          userId: userId,
          email: email,
          displayName: payload.nama_lengkap || '',
          courseId: 'course-main', 
          channelSource: payload.channelSource || 'standalone',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          currentStep: 1, // Step 1 is material
          status: 'active',
          stepProgress: {}
        });
      }

      return NextResponse.json({ success: true, message: 'Identity saved' });
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

      return NextResponse.json({ success: true, message: 'Quiz updated' });
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

      return NextResponse.json({ success: true, message: 'Survey updated' });
    }

    if (action === 'certificate') {
      // 4. Claim Certificate
      const enrollmentRef = db.collection('enrollments').doc(enrollmentId);
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      const settingsDoc = await db.collection("settings").doc("app").get();

      // Jika peserta mengonfirmasi/memperbaiki nama saat klaim sertifikat,
      // pakai nama itu (dirapikan) untuk sertifikat DAN simpan ke semua data.
      const confirmedNameRaw = (payload && payload.confirmedName) || "";
      const confirmedName = rapikanNama(confirmedNameRaw);
      const userName = confirmedName || userDoc.data()?.displayName || "Peserta";
      const issuerName = 'IODA Academy';

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
      const certId = `CERT-${year}-${randomHex}`;

      // (We already fetched settings at the top)
      const gasWebAppUrl = settings.gasWebAppUrl || "";
      const mainCertSlideTemplateId = settings.mainCertSlideTemplateId || "";
      
      const courseName = settings.mainCertTitle || 'Workshop Literasi Finansial';

      let driveUrl = null;
      let driveFileId = null;

      if (gasWebAppUrl) {
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

          const gasRes = await fetch(gasWebAppUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(gasPayload),
          });

          if (gasRes.ok) {
            const gasData = await gasRes.json();
            driveUrl = gasData.downloadUrl || gasData.pdfUrl || null;
            driveFileId = gasData.fileId || null;
          }
        } catch (gasErr) {
          console.error("GAS error:", gasErr);
        }
      }
      
      await enrollmentRef.set({
        updatedAt: FieldValue.serverTimestamp(),
        status: 'certified',
        certificateClaimed: true,
        certificateClaimedAt: FieldValue.serverTimestamp(),
        certificateCourseName: courseName,
        certificateIssuer: issuerName,
        certificateId: certId,
        certificateName: userName,
        certificateDriveUrl: driveUrl || "",
        certificateDriveFileId: driveFileId || "",
      }, { merge: true });

      return NextResponse.json({ success: true, message: 'Certificate claimed', certId, driveUrl });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('API Standalone Submit Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
