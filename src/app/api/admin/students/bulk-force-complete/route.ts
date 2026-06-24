import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { invalidateDashboardCache } from "@/lib/dashboard-aggregator";
import { syncStudentIndex } from "@/lib/sync-student-index";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();

    let reqBody: any = {};
    try { reqBody = await req.json(); } catch(e) {}
    
    const userIds: string[] = reqBody.userIds || [];
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return json({ error: "Daftar userIds kosong atau tidak valid." }, 400);
    }

    const enrollmentsSnap = await db.collection("enrollments")
      .where("courseId", "==", "course-main")
      .get();

    if (enrollmentsSnap.empty) {
      return json({ message: "Tidak ada pendaftar sama sekali." });
    }

    // Filter secara lokal untuk yang belum diklaim DAN id-nya ada di daftar userIds
    const targets = enrollmentsSnap.docs.filter(d => {
      const data = d.data();
      return !data.certificateClaimed && userIds.includes(data.userId); 
    });

    if (targets.length === 0) {
      return json({ message: "Peserta yang dipilih sudah memiliki sertifikat atau tidak ditemukan." });
    }

    // Ambil info course untuk nama sertifikat
    const courseDoc = await db.collection("courses").doc("course-main").get();
    const courseTitle = courseDoc.data()?.title || "Literasi Finansial Dasar";
    const issuerName = courseDoc.data()?.certificateConfig?.issuerName || "IODA Academy";

    const year = new Date().getFullYear();
    const batch = db.batch();
    let updatedCount = 0;

    for (const doc of targets) {
      const data = doc.data();
      const randomHex = Math.random().toString(16).substr(2, 6).toUpperCase();
      const certId = `CERT-${year}-${randomHex}`;

      // Ambil nama dari user
      let certName = data.displayName || "Peserta";
      try {
        const uDoc = await db.collection("users").doc(data.userId).get();
        if (uDoc.exists) {
          certName = uDoc.data()?.profileData?.namaLengkap || uDoc.data()?.displayName || certName;
        }
      } catch (e) {
        // Abaikan jika error ambil user
      }

      // Hardcode Step Progress sesuai dengan instruksi
      const hardcodedStepProgress = {
        "new-1779462139521": {
          completed: true,
          completedAt: FieldValue.serverTimestamp(),
          assessmentResult: {
            passed: true,
            score: 100,
            attempts: 1,
            lastAttemptAt: FieldValue.serverTimestamp(),
            answers: {
              "q-1779462169465": "A",
              "q-1779462319546": "A",
              "q-1779462400362": "B"
            }
          },
          surveyResult: {
            "sq-1779462786725": 5,
            submittedAt: FieldValue.serverTimestamp()
          }
        },
        "new-1779478025717": {
          completed: true,
          completedAt: FieldValue.serverTimestamp(),
          surveyResult: {
            "sq-1779478038912": 5,
            submittedAt: FieldValue.serverTimestamp()
          }
        }
      };

      const updatePayload = {
        certificateClaimed: true,
        certificateClaimedAt: FieldValue.serverTimestamp(),
        certificateCourseName: courseTitle,
        certificateId: certId,
        certificateIssuer: issuerName,
        certificateName: certName,
        status: "certified",
        currentStep: 2,
        updatedAt: FieldValue.serverTimestamp(),
        stepProgress: hardcodedStepProgress,
        // PDF dibuat di latar belakang oleh cron /api/cron/generate-pending-pdf.
        certificateDriveUrl: "",
        certificateDriveFileId: "",
        pdfPending: true,
      };

      batch.update(doc.ref, updatePayload);
      updatedCount++;

      // Commit tiap 400 doc (Firestore limit 500 per batch)
      if (updatedCount % 400 === 0) {
        await batch.commit();
      }
    }

    // Commit sisanya
    if (updatedCount % 400 !== 0) {
      await batch.commit();
    }

    invalidateDashboardCache();
    // Sync index hanya untuk peserta yang benar-benar diluluskan.
    targets.forEach((d) => syncStudentIndex(d.data().userId));

    return json({
      success: true,
      message: `Berhasil meluluskan ${updatedCount} peserta secara massal.`,
      updatedCount
    });

  } catch (e) {
    return handleError(e);
  }
}
