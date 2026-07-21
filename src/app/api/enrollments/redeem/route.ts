/**
 * POST /api/enrollments/redeem
 * Generate kode redeem untuk kursus tambahan (Bonus Course).
 * Syarat: user sudah lulus main course dan belum claim redeem code.
 * Setelah generate: daftarkan ke student-center-ioda > users_vl
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getScDb } from "@/lib/firebase-admin-sc";
import { requireAuth, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";
import { sendEmailViaGAS } from "@/lib/gas-email";
import { bonusRedeemEmail } from "@/lib/email-templates/bonus-redeem-email";
import { workshopConfirmationEmail } from "@/lib/email-templates/workshop-emails";
import { detailChannelFromCategory } from "@/lib/beasiswa-channel";
import { isBenefitCategoryAllowed, resolveBenefitCategories } from "@/lib/benefit-categories";

export async function POST(req: NextRequest) {
  try {
    const decoded = await requireAuth(req);
    const body = await req.json();
    const { enrollmentId, topicId } = body;

    if (!enrollmentId || !topicId) {
      return json({ error: "enrollmentId and topicId required" }, 400);
    }

    const db = getAdminDb();

    // Validasi Bonus Course Topic
    const topicDoc = await db.collection("bonusCourseTopics").doc(topicId).get();
    if (!topicDoc.exists || topicDoc.data()?.status !== "active") {
      return json({ error: "Topik kursus tidak valid atau tidak aktif" }, 404);
    }
    const topicData = topicDoc.data()!;
    const classCode = topicData.classCode as string;
    const kodeBasis = (topicData.Kode_Basis as string) ?? "";
    const namaKelas = topicData.name as string;

    // Validasi Enrollment
    const enrollRef = db.collection("enrollments").doc(enrollmentId);
    const enrollDoc = await enrollRef.get();
    if (!enrollDoc.exists) return json({ error: "Enrollment not found" }, 404);
    const enrollData = enrollDoc.data()!;
    if (enrollData.userId !== decoded.uid) return json({ error: "Forbidden" }, 403);
    if (!enrollData.certificateClaimed) return json({ error: "Sertifikat harus diklaim dulu" }, 400);
    // Sudah klaim benefit? Cek flag eksplisit benefitClaimed ATAU jejak klaim lama
    // (bonusCourseRedeemCode). beasiswaType TIDAK dipakai sebagai bukti klaim — itu
    // hanya penanda kategori yang bisa diisi auto-complete admin tanpa peserta mengklaim.
    if (enrollData.benefitClaimed || enrollData.bonusCourseRedeemCode) {
      return json({ error: "Kamu sudah memilih benefit sebelumnya" }, 400);
    }

    // Ambil data user
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    const userData = userDoc.data() || {};
    const emailUsername = (userData.emailUsername as string) || "user";
    const namaLengkap =
      (userData.profileData?.namaLengkap as string) ||
      (userData.nama_lengkap as string) ||
      (userData.displayName as string) ||
      decoded.name ||
      "Peserta";
    const displayName = (userData.displayName as string) || namaLengkap;

    const category = topicData.category || "vl";
    if (enrollData.eventId) {
      const eventDoc = await db.collection("events").doc(enrollData.eventId).get();
      if (eventDoc.exists) {
        const allowedCategories = resolveBenefitCategories(eventDoc.data());
        if (!isBenefitCategoryAllowed(category, allowedCategories)) {
          return json({ error: "Benefit ini tidak tersedia untuk event kamu" }, 400);
        }
      }
    }

    // ── WORKSHOP: tidak generate redeem code portal. Kirim email konfirmasi
    //    workshop + tampilkan link grup WA. Sama seperti pendaftaran workshop event. ──
    if (category === "workshop") {
      const wd = topicData.workshopData || {};
      const waGroupLink = wd.waGroupLink || topicData.groupLink || "";
      const detailChannel = detailChannelFromCategory("workshop");
      await enrollRef.update({
        bonusCourseTopicId: topicId,
        beasiswaType: "workshop",
        benefitClaimed: true,
        benefitClaimedAt: FieldValue.serverTimestamp(),
        waGroupLink,
        detailChannel,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.collection("users").doc(decoded.uid).set(
        { detailChannel, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      try {
        const { subject, htmlBody } = workshopConfirmationEmail({
          recipientName: displayName,
          workshopTitle: namaKelas,
          date: wd.date || "",
          time: wd.time || "",
          platform: wd.platform || "",
          meetingLink: wd.meetingLink || "",
          waGroupLink,
          speakerName: "",
          speakerTitle: "",
        });
        sendEmailViaGAS({ to: decoded.email!, subject, htmlBody }).catch((err) =>
          console.error("[redeem] Gagal kirim email workshop:", err)
        );
      } catch (emailErr) {
        console.error("[redeem] Error email workshop:", emailErr);
      }
      return json({ success: true, category: "workshop", groupLink: waGroupLink });
    }

    // ── DOWNLOADABLE: tandai pilihan, tampilkan tombol download di UI. ──
    if (category === "downloadable") {
      const detailChannel = detailChannelFromCategory("downloadable");
      await enrollRef.update({
        bonusCourseTopicId: topicId,
        beasiswaType: "downloadable",
        benefitClaimed: true,
        benefitClaimedAt: FieldValue.serverTimestamp(),
        detailChannel,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.collection("users").doc(decoded.uid).set(
        { detailChannel, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      return json({
        success: true,
        category: "downloadable",
        downloadUrl: topicData.downloadUrl || "",
        topicName: namaKelas,
      });
    }
    // review_cv ditangani oleh /api/enrollments/review-cv (butuh upload file).

    // Generate Kode: emailUsername (lowercase) + ClassCode
    const emailUsernameClean = emailUsername.toLowerCase().replace(/[^a-z0-9.]/g, "");
    const classCodeClean = classCode.replace(/[^a-zA-Z0-9]/g, "");
    const redeemCode = `${emailUsernameClean}${classCodeClean}`;
    const redeemCodeUpper = redeemCode.toUpperCase();
    const now = new Date().toISOString();

    const waGroupLink = topicData.groupLink || "";

    // detailChannel mengikuti kategori yang dipilih — untuk SEMUA channel,
    // label selalu prefix "Beasiswa ..." (keputusan produk).
    const detailChannel = detailChannelFromCategory(category);
    const enrollUpdate: Record<string, unknown> = {
      bonusCourseTopicId: topicId,
      bonusCourseRedeemCode: redeemCode,
      beasiswaType: category,
      benefitClaimed: true,
      benefitClaimedAt: FieldValue.serverTimestamp(),
      waGroupLink: waGroupLink,
      detailChannel,
      updatedAt: FieldValue.serverTimestamp(),
    };
    // Samakan juga di dokumen users agar konsisten di dashboard.
    await db.collection("users").doc(decoded.uid).set(
      { detailChannel, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    // Simpan ke enrollment
    await enrollRef.update(enrollUpdate);

    // ── Daftarkan ke student-center-ioda berdasarkan kategori ──
    try {
      const scDb = getScDb();
      const docId = `LITERASI_FINANSIAL_${redeemCodeUpper}`;
      
      const userEmail = decoded.email || userData.email || "";
      const userWa = userData.no_wa || userData.phone || userData.phoneNumber || "";

      if (category === "wpb") {
        await scDb.collection("users_wpb").doc(docId).set({
          Created_By_Admin:  false,
          Data_Source:       "free course literasi digital",
          Email:             userEmail,
          Kode_Basis:        kodeBasis.toUpperCase(),
          Kode_Kelas:        classCode.toUpperCase(),
          Kode_Redeem:       redeemCodeUpper,
          Kode_Redeem_Lower: redeemCode,
          Nama_Kelas:        namaKelas,
          Nama_Kelas_Sertif: namaKelas,
          Nama_Lower:        namaLengkap.toLowerCase(),
          Nama_Peserta:      namaLengkap,
          No_WA:             userWa,
          Program:           "WPB",
          Project:           0,
          Role:              "student",
          Tanggal_Sesi_Terakhir: topicData.lastSessionDate || "",
          _syncedAt:         now,
          _syncedBy:         "Literacy Financial",
        });
      } else if (category === "bootcamp") {
        await scDb.collection("users_bootcamp").doc(docId).set({
          Created_By_Admin:  false,
          Data_Source:       "free course literasi digital",
          Email:             userEmail,
          Kode_Basis:        kodeBasis.toUpperCase(),
          Kode_Kelas:        classCode.toUpperCase(),
          Kode_Redeem:       redeemCodeUpper,
          Kode_Redeem_Lower: redeemCode,
          Nama_Kelas:        namaKelas,
          Nama_Kelas_Sertif: namaKelas,
          Nama_Lower:        namaLengkap.toLowerCase(),
          Nama_Peserta:      namaLengkap,
          No_WA:             userWa,
          Program:           "BOOTCAMP",
          Project:           0,
          Role:              "participant",
          Tanggal_Sesi_Terakhir: topicData.lastSessionDate || "",
          _syncedAt:         now,
          _syncedBy:         "Literacy Financial",
        });
      } else {
        // default: Video Learning (users_vl)
        await scDb.collection("users_vl").doc(docId).set({
          Created_By_Admin:  false,
          Data_Source:       "free course literasi digital",
          Kode_Basis:        kodeBasis.toUpperCase(),
          Kode_Redeem:       redeemCodeUpper,
          Kode_Redeem_Lower: redeemCode,
          Nama_Kelas:        namaKelas,
          Nama_Kelas_Sertif: namaKelas,
          Nama_Lower:        namaLengkap.toLowerCase(),
          Nama_Peserta:      namaLengkap,
          Program:           "Video Learning",
          Role:              "participant",
          Tanggal_Daftar:    now,
          _syncedAt:         now,
          _syncedBy:         "Literacy Financial",
        });
      }
    } catch (scErr) {
      // Log tapi jangan gagalkan seluruh request — kode sudah tersimpan di freecourse
      console.error("[redeem] Gagal daftar ke student-center-ioda:", scErr);
    }

    // Kirim email kode redeem ke user
    try {
      const { subject, htmlBody } = bonusRedeemEmail({
        recipientName: displayName,
        redeemCode,
        topicName: namaKelas,
        portalUrl: topicData.portalUrl || undefined,
      });
      sendEmailViaGAS({ to: decoded.email!, subject, htmlBody }).catch((err) =>
        console.error("[redeem] Gagal kirim email:", err)
      );
    } catch (emailErr) {
      console.error("[redeem] Error email:", emailErr);
    }

    return json({ success: true, redeemCode });
  } catch (e) {
    return handleError(e);
  }
}
