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
    if (enrollData.bonusCourseRedeemCode) return json({ error: "Kode redeem sudah diklaim" }, 400);

    // Ambil data user
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    const userData = userDoc.data() || {};
    const emailUsername = (userData.emailUsername as string) || "user";
    const namaLengkap = (userData.nama_lengkap as string) || (userData.displayName as string) || decoded.name || "Peserta";
    const displayName = (userData.displayName as string) || namaLengkap;

    // Generate Kode: emailUsername (lowercase) + ClassCode
    const emailUsernameClean = emailUsername.toLowerCase().replace(/[^a-z0-9.]/g, "");
    const classCodeClean = classCode.replace(/[^a-zA-Z0-9]/g, "");
    const redeemCode = `${emailUsernameClean}${classCodeClean}`;
    const redeemCodeUpper = redeemCode.toUpperCase();
    const now = new Date().toISOString();

    // Simpan ke enrollment
    await enrollRef.update({
      bonusCourseTopicId: topicId,
      bonusCourseRedeemCode: redeemCode,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // ── Daftarkan ke student-center-ioda > users_vl ──
    try {
      const scDb = getScDb();
      const docId = `LITERASI_FINANSIAL_${redeemCodeUpper}`;
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
