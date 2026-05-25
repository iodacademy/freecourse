/**
 * POST /api/enrollments/[id]/claim-cert
 * Klaim sertifikat: validasi syarat (assessment lulus & survei terisi), generate certId,
 * ubah status enrollment, lalu panggil GAS untuk generate PDF.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const decoded = await requireAuth(req);
    const { id } = await params;
    
    const db = getAdminDb();
    const enrollRef = db.collection("enrollments").doc(id);
    const enrollDoc = await enrollRef.get();

    if (!enrollDoc.exists) return json({ error: "Enrollment not found" }, 404);
    
    const enrollData = enrollDoc.data()!;
    if (enrollData.email !== decoded.email) return json({ error: "Forbidden" }, 403);

    let reqBody: any = {};
    try { reqBody = await req.json(); } catch(e) {}

    const isReclaim = reqBody.reclaim === true;

    // Sudah diklaim dan bukan reclaim → tolak
    if (enrollData.certificateClaimed && !isReclaim) {
      return json({ message: "Sertifikat sudah diklaim sebelumnya", certId: enrollData.certificateId });
    }

    // Cek syarat kelulusan (hanya untuk klaim pertama)
    if (!isReclaim) {
      const courseStepsSnap = await db.collection("courseSteps")
        .where("courseId", "==", enrollData.courseId)
        .get();
        
      const requiredSteps = courseStepsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const stepProgress = enrollData.stepProgress || {};

      let isEligible = true;
      for (const step of requiredSteps) {
        if (step.hasAssessment && step.assessment?.kkm) {
          const progress = stepProgress[step.id];
          const score = progress?.assessmentResult?.score;
          if (!progress || typeof score !== "number" || score < step.assessment.kkm) {
            isEligible = false;
            break;
          }
        }
        
        if (step.hasSurvey && step.survey) {
          const progress = stepProgress[step.id];
          if (!progress || !progress.surveyResult) {
            isEligible = false;
            break;
          }
        }
      }

      if (!isEligible) {
        return json({ error: "Syarat belum terpenuhi (belum lulus assessment / belum isi survei)" }, 400);
      }
    }

    // Generate Certificate ID (new one for reclaim too)
    const year = new Date().getFullYear();
    const randomHex = Math.random().toString(16).substr(2, 6).toUpperCase();
    const certId = `CERT-${year}-${randomHex}`;

    // Get user, course, and settings info
    const [userDoc, courseDoc, settingsDoc] = await Promise.all([
      db.collection("users").doc(enrollData.userId).get(),
      db.collection("courses").doc(enrollData.courseId).get(),
      db.collection("settings").doc("app").get()
    ]);
    
    const userName = reqBody.customName || userDoc.data()?.profileData?.namaLengkap || userDoc.data()?.displayName || "Peserta";
    const courseName = courseDoc.data()?.title || "Kursus";
    const issuerName = courseDoc.data()?.certificateConfig?.issuerName || "IODA Academy";

    const settings = settingsDoc.data() || {};
    const gasWebAppUrl: string = settings.gasWebAppUrl || "";
    const mainCertSlideTemplateId: string = settings.mainCertSlideTemplateId || "";

    // If reclaim, try delete old file via GAS
    if (isReclaim && enrollData.certificateDriveFileId && gasWebAppUrl) {
      try {
        await fetch(gasWebAppUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete_old_cert",
            fileId: enrollData.certificateDriveFileId,
          }),
        });
      } catch (delErr) {
        console.error("[claim-cert] Delete old file error:", delErr);
      }
    }

    // Update enrollment with certificate data
    await enrollRef.update({
      certificateClaimed: true,
      certificateClaimedAt: FieldValue.serverTimestamp(),
      certificateId: certId,
      certificateName: userName,
      certificateCourseName: courseName,
      certificateIssuer: issuerName,
      status: "certified",
      updatedAt: FieldValue.serverTimestamp()
    });

    // Call GAS for PDF generation
    let driveUrl: string | null = null;
    let driveFileId: string | null = null;

    if (gasWebAppUrl) {
      try {
        const now = new Date();
        const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
        const claimDate = `${now.getDate()} ${bulan[now.getMonth()]} ${now.getFullYear()}`;

        const gasPayload = {
          action: "generate_main_cert",
          templateId: mainCertSlideTemplateId,
          certId,
          userName,
          courseName,
          claimDate,
          email: decoded.email,
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

          // Save drive URL back to enrollment
          if (driveUrl) {
            await enrollRef.update({
              certificateDriveUrl: driveUrl,
              certificateDriveFileId: driveFileId || "",
            });
          }
        } else {
          console.error("[claim-cert] GAS response not ok:", gasRes.status);
        }
      } catch (gasErr) {
        console.error("[claim-cert] GAS error:", gasErr);
        // Tidak gagalkan proses, data sudah tersimpan di Firestore
      }
    }

    return json({ 
      success: true, 
      message: isReclaim 
        ? "Sertifikat berhasil di-generate ulang" 
        : "Sertifikat berhasil diklaim",
      certId,
      driveUrl,
    });
  } catch (e) {
    return handleError(e);
  }
}
