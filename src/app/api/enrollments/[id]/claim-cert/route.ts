/**
 * POST /api/enrollments/[id]/claim-cert
 * Klaim sertifikat: validasi syarat (assessment lulus & survei terisi), generate certId,
 * ubah status enrollment, lalu panggil GAS untuk generate PDF.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getScDb } from "@/lib/firebase-admin-sc";
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

    // Certificate ID: reuse existing on reclaim, generate new on first claim
    let certId: string;
    if (isReclaim && enrollData.certificateId) {
      certId = enrollData.certificateId;
    } else {
      const year = new Date().getFullYear();
      const randomHex = Math.random().toString(16).substr(2, 6).toUpperCase();
      certId = `CERT-${year}-${randomHex}`;
    }

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

    // If reclaim, try delete old file via GAS (mungkin sudah dihapus oleh cleanup)
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
        console.error("[claim-cert] Delete old file error (mungkin sudah dihapus):", delErr);
      }
    }

    // Update enrollment — on reclaim, keep original claimedAt
    if (isReclaim) {
      await enrollRef.update({
        certificateName: userName,
        updatedAt: FieldValue.serverTimestamp()
      });
    } else {
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
    }

    // Call GAS for PDF generation
    let driveUrl: string | null = null;
    let driveFileId: string | null = null;

    if (gasWebAppUrl) {
      try {
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        
        // On reclaim: use original claim date; on first claim: use now
        let claimDate: string;
        if (isReclaim && enrollData.certificateClaimedAt) {
          const origDate = typeof enrollData.certificateClaimedAt === "object" && enrollData.certificateClaimedAt._seconds
            ? new Date(enrollData.certificateClaimedAt._seconds * 1000)
            : new Date(enrollData.certificateClaimedAt);
          claimDate = `${origDate.getDate()} ${months[origDate.getMonth()]} ${origDate.getFullYear()}`;
        } else {
          const now = new Date();
          claimDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
        }

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

    // ── Logika Khusus WPB & Bootcamp Beasiswa ──
    // Generate kode redeem secara otomatis saat sertifikat diklaim perdana (atau reclaim jika belum tergenerate)
    let redeemCode: string | null = enrollData.bonusCourseRedeemCode || null;
    let waGroupLink: string | null = enrollData.waGroupLink || null;
    let beasiswaType: string | null = enrollData.beasiswaType || null;

    if (enrollData.channelSource === "beasiswa" && enrollData.eventId && !enrollData.bonusCourseRedeemCode) {
      try {
        const eventDoc = await db.collection("events").doc(enrollData.eventId).get();
        if (eventDoc.exists) {
          const bc = eventDoc.data()?.beasiswaConfig;
          if (bc && (bc.type === "wpb" || bc.type === "bootcamp")) {
            beasiswaType = bc.type;
            waGroupLink = bc.waGroupLink || "";
            const kodeKelas = bc.kodeKelas || "";
            const kodeBasis = bc.kodeBasis || "";
            const emailUsername = userDoc.data()?.emailUsername || decoded.email?.split("@")[0] || "user";
            
            const emailUsernameClean = emailUsername.toLowerCase().replace(/[^a-z0-9.]/g, "");
            const classCodeClean = kodeKelas.replace(/[^a-zA-Z0-9]/g, "");
            const newRedeemCode = `${emailUsernameClean}${classCodeClean}`;
            const redeemCodeUpper = newRedeemCode.toUpperCase();
            
            redeemCode = newRedeemCode;

            // Simpan ke student-center-ioda
            const scDb = getScDb();
            const docId = `LITERASI_FINANSIAL_${redeemCodeUpper}`;
            const collectionName = bc.type === "wpb" ? "users_wpb" : "users_bootcamp";
            
            const nowStr = new Date().toISOString();
            const userEmail = decoded.email || userDoc.data()?.email || "";
            const userWa = userDoc.data()?.no_wa || userDoc.data()?.phone || userDoc.data()?.phoneNumber || "";

            await scDb.collection(collectionName).doc(docId).set({
              Created_By_Admin: false,
              Data_Source: "free course literasi digital",
              Email: userEmail,
              Kode_Basis: kodeBasis.toUpperCase(),
              Kode_Kelas: kodeKelas.toUpperCase(),
              Kode_Redeem: redeemCodeUpper,
              Kode_Redeem_Lower: newRedeemCode,
              Nama_Kelas: bc.namaKelas || courseName,
              Nama_Kelas_Sertif: bc.namaKelas || courseName,
              Nama_Lower: userName.toLowerCase(),
              Nama_Peserta: userName,
              No_WA: userWa,
              Program: bc.type === "wpb" ? "WPB" : "Bootcamp",
              Role: "participant",
              Tanggal_Daftar: nowStr,
              _syncedAt: nowStr,
              _syncedBy: "Literacy Financial",
            });

            // Update ke enrollment
            await enrollRef.update({
              bonusCourseTopicId: enrollData.eventId,
              bonusCourseRedeemCode: newRedeemCode,
              waGroupLink: waGroupLink,
              beasiswaType: beasiswaType,
            });
          }
        }
      } catch (err) {
        console.error("[claim-cert] Error generating WPB/Bootcamp code:", err);
      }
    }

    return json({ 
      success: true, 
      message: isReclaim 
        ? "Sertifikat berhasil di-generate ulang" 
        : "Sertifikat berhasil diklaim",
      certId,
      driveUrl,
      redeemCode,
      waGroupLink,
      beasiswaType,
    });
  } catch (e) {
    return handleError(e);
  }
}
