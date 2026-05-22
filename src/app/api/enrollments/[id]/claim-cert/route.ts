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
    if (enrollData.userId !== decoded.uid) return json({ error: "Forbidden" }, 403);
    if (enrollData.certificateClaimed) return json({ message: "Sertifikat sudah diklaim sebelumnya" });

    // Cek syarat kelulusan
    const courseStepsSnap = await db.collection("courseSteps")
      .where("courseId", "==", enrollData.courseId)
      .get();
      
    const requiredSteps = courseStepsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    const stepProgress = enrollData.stepProgress || {};

    let isEligible = true;
    for (const step of requiredSteps) {
      const progress = stepProgress[step.id];
      if (!progress?.completed) {
        isEligible = false;
        break;
      }
      
      // Jika ada assessment, cek apakah lulus
      if (step.companionType === "assessment" && step.assessment?.kkm) {
        if (!progress.assessmentResult?.passed) {
          isEligible = false;
          break;
        }
      }
      
      // Jika ada survey, cek apakah submitted
      if (step.companionType === "survey" && step.survey) {
        if (!progress.surveyResult?.submitted) {
          isEligible = false;
          break;
        }
      }
    }

    if (!isEligible) {
      return json({ error: "Syarat belum terpenuhi (belum lulus assessment / belum isi survei)" }, 400);
    }

    // Generate Certificate ID
    const year = new Date().getFullYear();
    const randomHex = Math.random().toString(16).substr(2, 6).toUpperCase();
    const certId = `CERT-${year}-${randomHex}`;

    // Get user and course info for verification record
    const [userDoc, courseDoc] = await Promise.all([
      db.collection("users").doc(enrollData.userId).get(),
      db.collection("courses").doc(enrollData.courseId).get()
    ]);
    
    const userName = userDoc.data()?.displayName || "Peserta";
    const courseName = courseDoc.data()?.title || "Kursus";
    const issuerName = courseDoc.data()?.certificateConfig?.issuerName || "IODA Academy";

    const batch = db.batch();

    // 1. Update enrollment
    batch.update(enrollRef, {
      certificateClaimed: true,
      certificateClaimedAt: FieldValue.serverTimestamp(),
      certificateId: certId,
      status: "certified",
      updatedAt: FieldValue.serverTimestamp()
    });

    // 2. Buat Verification Record
    const verifyRef = db.collection("certificateVerifications").doc(certId);
    batch.set(verifyRef, {
      certId,
      userId: enrollData.userId,
      userName,
      courseId: enrollData.courseId,
      courseName,
      claimedAt: FieldValue.serverTimestamp(),
      issuerName,
      isValid: true,
      verifyUrl: `https://freecourse.iodacademy.id/verify/${certId}`
    });

    await batch.commit();

    // TO-DO: Call Google Apps Script for PDF generation and Email sending
    // Karena GAS diskip untuk sprint ini, kita asumsikan sukses.
    
    return json({ 
      success: true, 
      message: "Sertifikat berhasil diklaim (Data tersimpan di Firestore)",
      certId 
    });
  } catch (e) {
    return handleError(e);
  }
}
