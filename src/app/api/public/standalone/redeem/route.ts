import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getScDb } from "@/lib/firebase-admin-sc";
import { FieldValue } from "firebase-admin/firestore";
import { sendEmailViaGAS } from "@/lib/gas-email";
import { bonusRedeemEmail } from "@/lib/email-templates/bonus-redeem-email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, topicId } = body;

    if (!email || !topicId) {
      return NextResponse.json({ error: "email and topicId required" }, { status: 400 });
    }

    const userId = email.toLowerCase();
    const enrollmentId = userId; // Standalone uses email as enrollment ID
    const db = getAdminDb();

    // Validasi Bonus Course Topic
    const topicDoc = await db.collection("bonusCourseTopics").doc(topicId).get();
    if (!topicDoc.exists || topicDoc.data()?.status !== "active") {
      return NextResponse.json({ error: "Topik kursus tidak valid atau tidak aktif" }, { status: 404 });
    }
    const topicData = topicDoc.data()!;
    const classCode = topicData.classCode as string;
    const kodeBasis = (topicData.Kode_Basis as string) ?? "";
    const namaKelas = topicData.name as string;

    // Validasi Enrollment Standalone
    const enrollRef = db.collection("enrollments").doc(enrollmentId);
    const enrollDoc = await enrollRef.get();
    
    if (!enrollDoc.exists) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }
    const enrollData = enrollDoc.data()!;
    if (enrollData.bonusCourseRedeemCode) {
      return NextResponse.json({ error: "Kode redeem sudah diklaim" }, { status: 400 });
    }

    // Ambil data user
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data() || {};
    // Fallback if emailUsername doesn't exist (since standalone only collects email)
    const emailUsername = email.split("@")[0] || "user";
    const namaLengkap = (userData.displayName as string) || "Peserta";

    // Generate Kode: emailUsername (lowercase) + ClassCode
    const emailUsernameClean = emailUsername.toLowerCase().replace(/[^a-z0-9.]/g, "");
    const classCodeClean = classCode.replace(/[^a-zA-Z0-9]/g, "");
    const redeemCode = `${emailUsernameClean}${classCodeClean}`;
    const redeemCodeUpper = redeemCode.toUpperCase();
    const now = new Date().toISOString();

    const category = topicData.category || "vl";
    const waGroupLink = topicData.groupLink || "";

    // Simpan ke enrollment
    await enrollRef.update({
      bonusCourseTopicId: topicId,
      bonusCourseRedeemCode: redeemCode,
      beasiswaType: category,
      waGroupLink: waGroupLink,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // ── Daftarkan ke student-center-ioda berdasarkan kategori ──
    try {
      const scDb = getScDb();
      const docId = `LITERASI_FINANSIAL_${redeemCodeUpper}`;
      
      const userWa = userData.profileData?.no_wa || userData.no_wa || userData.phone || userData.phoneNumber || "";

      if (category === "wpb") {
        await scDb.collection("users_wpb").doc(docId).set({
          Created_By_Admin:  false,
          Data_Source:       "free course literasi digital (standalone)",
          Email:             email,
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
          Data_Source:       "free course literasi digital (standalone)",
          Email:             email,
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
          Data_Source:       "free course literasi digital (standalone)",
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
      console.error("[standalone-redeem] Gagal daftar ke student-center-ioda:", scErr);
    }

    // Kirim email kode redeem ke user
    try {
      const { subject, htmlBody } = bonusRedeemEmail({
        recipientName: namaLengkap,
        redeemCode,
        topicName: namaKelas,
        portalUrl: topicData.portalUrl || undefined,
      });
      sendEmailViaGAS({ to: email, subject, htmlBody }).catch((err) =>
        console.error("[standalone-redeem] Gagal kirim email:", err)
      );
    } catch (emailErr) {
      console.error("[standalone-redeem] Error email:", emailErr);
    }

    return NextResponse.json({ 
      success: true, 
      redeemCode,
      topicName: namaKelas,
      category: category,
      portalUrl: topicData.portalUrl || "https://app.iodacademy.id/portal-belajar/",
      groupLink: waGroupLink
    });
  } catch (e: any) {
    console.error("Redeem Error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
