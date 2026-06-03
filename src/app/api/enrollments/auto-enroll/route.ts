/**
 * POST /api/enrollments/auto-enroll
 * Enroll siswa ke kursus utama. Dipanggil otomatis setelah user baru dibuat.
 * Doc ID = email user.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";
import { sendEmailViaGAS } from "@/lib/gas-email";
import { workshopConfirmationEmail } from "@/lib/email-templates/workshop-emails";

export async function POST(req: NextRequest) {
  try {
    const decoded = await requireAuth(req);
    const body = await req.json();
    const db = getAdminDb();

    const email = decoded.email;
    if (!email) return json({ error: "Email tidak tersedia" }, 400);

    // Cari kursus utama jika courseId tidak diberikan
    let courseId = body.courseId;
    if (!courseId) {
      const settingsDoc = await db.collection("settings").doc("app").get();
      courseId = settingsDoc.data()?.mainCourseId || "course-main";
    }

    if (!courseId) return json({ error: "Kursus utama belum diset" }, 404);

    const enrollId = email;
    const enrollRef = db.collection("enrollments").doc(enrollId);
    const existEnroll = await enrollRef.get();

    // Ambil data dari users collection (dibutuhkan di kedua branch)
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    const userData = userDoc.data() || {};
    const displayName = userData.displayName || decoded.name || "";
    const channelSource = body.channelSource ?? userData.channelSource ?? null;
    const eventId = body.eventId ?? userData.eventId ?? null;

    if (existEnroll.exists) {
      // Sudah terdaftar — update channelSource/eventId jika ada info baru dari profile submit
      const updates: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
      if (channelSource) updates.channelSource = channelSource;
      if (eventId) updates.eventId = eventId;
      if (displayName && !existEnroll.data()?.displayName) updates.displayName = displayName;
      await enrollRef.update(updates);
      return json({ message: "Sudah terdaftar", enrollment: { id: enrollId, ...existEnroll.data() } });
    }


    const data = {
      id: enrollId,
      userId: decoded.uid,
      email,
      displayName,
      courseId,
      eventId,
      channelSource,
      partnerCode: userData.partnerCode ?? null,
      status: "enrolled",
      currentStep: 1,
      stepProgress: {},
      certificateClaimed: false,
      certificateClaimedAt: null,
      certificateId: null,
      certificateDriveUrl: null,
      certificateEmailSent: false,
      bonusCourseTopicId: null,
      bonusCourseRedeemCode: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    try {
      // Gunakan create() agar atomic. Jika dipanggil bersamaan, request kedua akan error ALREADY_EXISTS
      await enrollRef.create(data);
    } catch (err: any) {
      if (err.code === 6 || String(err).includes("ALREADY_EXISTS")) {
        const checkAgain = await enrollRef.get();
        return json({ message: "Sudah terdaftar", enrollment: { id: enrollId, ...checkAgain.data() } });
      }
      throw err;
    }

    // ── Kirim email konfirmasi untuk channel Workshop ──
    if (channelSource === "workshop" && eventId) {
      try {
        const eventDoc = await db.collection("events").doc(eventId).get();
        if (eventDoc.exists) {
          const wd = eventDoc.data()?.workshopData;
          if (wd) {
            const { subject, htmlBody } = workshopConfirmationEmail({
              recipientName: displayName || email.split("@")[0],
              workshopTitle: wd.title || eventId,
              date: wd.date || "",
              dayLabel: wd.dayLabel || "",
              time: wd.time || "",
              platform: wd.platform || "",
              meetingLink: wd.meetingLink || "",
              waGroupLink: wd.waGroupLink || "",
              speakerName: wd.speakerName || "",
              speakerTitle: wd.speakerTitle || "",
              speakerPhoto: wd.speakerPhoto || "",
            });
            // Fire-and-forget — tidak block response
            sendEmailViaGAS({ to: email, subject, htmlBody }).catch((err) =>
              console.error("[auto-enroll] Gagal kirim email konfirmasi:", err)
            );
          }
        }
      } catch (emailErr) {
        console.error("[auto-enroll] Error email:", emailErr);
      }
    }

    return json({ message: "Berhasil terdaftar", enrollment: data }, 201);
  } catch (e) {
    return handleError(e);
  }
}
