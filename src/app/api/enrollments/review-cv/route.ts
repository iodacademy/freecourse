/**
 * POST /api/enrollments/review-cv
 * Benefit "Review CV" (login-only).
 * Peserta upload CV (PDF) + nama & email (bisa diedit dari profil).
 * Alur:
 *  1. File dikirim ke GAS (action "submit_cv") → disimpan ke folder Drive
 *     & dicatat 1 baris ke Google Sheet (header otomatis + kolom
 *     "Sudah Direview" / "Status Email").
 *  2. Enrollment ditandai beasiswaType="review_cv" + detailChannel.
 *
 * Body: multipart/form-data — field "file", "enrollmentId", "namaLengkap", "email"
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";
import { callGAS } from "@/lib/gas-email";
import { detailChannelFromCategory } from "@/lib/beasiswa-channel";
import { isBenefitCategoryAllowed, isBenefitTopicAllowed, resolveBenefitCategories, resolveBenefitTopicIds } from "@/lib/benefit-categories";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const decoded = await requireAuth(req);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const enrollmentId = (formData.get("enrollmentId") as string) || "";
    const topicId = (formData.get("topicId") as string) || "";
    const namaLengkap = ((formData.get("namaLengkap") as string) || "").trim();
    const email = ((formData.get("email") as string) || "").trim();

    if (!file) return json({ error: "File CV wajib diupload" }, 400);
    if (!enrollmentId) return json({ error: "enrollmentId wajib diisi" }, 400);
    if (!topicId) return json({ error: "topicId wajib diisi" }, 400);
    if (!namaLengkap) return json({ error: "Nama lengkap wajib diisi" }, 400);
    if (!email) return json({ error: "Email wajib diisi" }, 400);

    if (file.size > MAX_SIZE) {
      return json({ error: "Ukuran file maksimal 5MB" }, 400);
    }
    const mimeType = file.type || "application/pdf";
    if (mimeType !== "application/pdf") {
      return json({ error: "Format CV harus PDF" }, 400);
    }

    const db = getAdminDb();

    // Validasi enrollment milik user & sertifikat sudah diklaim & belum pilih benefit.
    const enrollRef = db.collection("enrollments").doc(enrollmentId);
    const enrollDoc = await enrollRef.get();
    if (!enrollDoc.exists) return json({ error: "Enrollment not found" }, 404);
    const enrollData = enrollDoc.data()!;
    // Kepemilikan via uid ATAU email (peserta jalur Meta punya userId = email).
    const enrollEmail = String(enrollData.email || "").toLowerCase();
    const authEmail = String(decoded.email || "").toLowerCase();
    // Jalur email HANYA untuk record Meta (userId disimpan sebagai email) dan
    // wajib email terverifikasi — tanpa itu enrollment uid-owned bisa dibajak
    // oleh siapa pun yang punya token dengan email yang sama.
    const isMetaOwned =
      !!enrollEmail && String(enrollData.userId || "").toLowerCase() === enrollEmail;
    const ownedByEmail =
      isMetaOwned && decoded.email_verified === true && authEmail === enrollEmail;
    if (enrollData.userId !== decoded.uid && !ownedByEmail) {
      return json({ error: "Forbidden" }, 403);
    }
    // Lolos guard → userId pasti uid pemilik atau email pemilik (record Meta).
    const userDocId = String(enrollData.userId);
    if (!enrollData.certificateClaimed) return json({ error: "Sertifikat harus diklaim dulu" }, 400);
    // Bukti klaim = benefitClaimed (flag baru) ATAU bonusCourseRedeemCode (jejak lama).
    // beasiswaType TIDAK dipakai — itu hanya penanda kategori (bisa diisi auto-complete admin).
    if (enrollData.benefitClaimed || enrollData.bonusCourseRedeemCode) {
      return json({ error: "Kamu sudah memilih benefit sebelumnya" }, 400);
    }

    const topicDoc = await db.collection("bonusCourseTopics").doc(topicId).get();
    if (!topicDoc.exists || topicDoc.data()?.status !== "active" || topicDoc.data()?.category !== "review_cv") {
      return json({ error: "Benefit Review CV tidak valid atau tidak aktif" }, 404);
    }
    if (enrollData.eventId) {
      const eventDoc = await db.collection("events").doc(enrollData.eventId).get();
      if (eventDoc.exists) {
        const allowedCategories = resolveBenefitCategories(eventDoc.data());
        const allowedTopicIds = resolveBenefitTopicIds(eventDoc.data());
        if (!isBenefitCategoryAllowed("review_cv", allowedCategories) ||
            !isBenefitTopicAllowed(topicId, allowedTopicIds)) {
          return json({ error: "Benefit ini tidak tersedia untuk event kamu" }, 400);
        }
      }
    }

    // Baca file → base64
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileBase64 = buffer.toString("base64");
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";

    // Kirim ke GAS: simpan Drive + catat Sheet
    const gasRes = await callGAS<{ success: boolean; fileUrl?: string; error?: string }>({
      action: "submit_cv",
      fileBase64,
      mimeType,
      ext,
      namaLengkap,
      email,
      timestamp: new Date().toISOString(),
    });

    if (!gasRes?.success) {
      return json({ error: gasRes?.error || "Gagal menyimpan CV. Coba lagi." }, 502);
    }

    const detailChannel = detailChannelFromCategory("review_cv");

    // Tandai enrollment
    await enrollRef.update({
      beasiswaType: "review_cv",
      benefitClaimed: true,
      benefitClaimedAt: FieldValue.serverTimestamp(),
      bonusCourseTopicId: topicId,
      detailChannel,
      reviewCvName: namaLengkap,
      reviewCvEmail: email,
      reviewCvFileUrl: gasRes.fileUrl || "",
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Samakan di dokumen users untuk konsistensi dashboard.
    await db.collection("users").doc(userDocId).set(
      { detailChannel, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    return json({ success: true, fileUrl: gasRes.fileUrl });
  } catch (e) {
    return handleError(e);
  }
}
