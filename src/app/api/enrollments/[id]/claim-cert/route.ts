/**
 * POST /api/enrollments/[id]/claim-cert
 * Klaim sertifikat: validasi syarat (assessment lulus & survei terisi), generate certId,
 * ubah status enrollment, lalu ke depannya akan manggil GAS.
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

    // Get user and course info for verification record
    const [userDoc, courseDoc] = await Promise.all([
      db.collection("users").doc(enrollData.userId).get(),
      db.collection("courses").doc(enrollData.courseId).get()
    ]);
    
    const userName = reqBody.customName || userDoc.data()?.displayName || "Peserta";
    const courseName = courseDoc.data()?.title || "Kursus";
    const issuerName = courseDoc.data()?.certificateConfig?.issuerName || "IODA Academy";

    // TO-DO: If reclaim, delete old Google Drive file using GAS
    // const oldDriveFileId = enrollData.certificateDriveFileId;
    // if (isReclaim && oldDriveFileId) { /* call GAS to delete old file */ }

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

    // TO-DO: Call Google Apps Script for PDF generation
    // When GAS is ready, it will return driveUrl which we pass back
    
    return json({ 
      success: true, 
      message: isReclaim 
        ? "Sertifikat berhasil di-generate ulang" 
        : "Sertifikat berhasil diklaim",
      certId,
      // driveUrl: "..." // Will be populated when GAS is integrated
    });
  } catch (e) {
    return handleError(e);
  }
}
