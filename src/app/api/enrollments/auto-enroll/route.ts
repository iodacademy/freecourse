/**
 * POST /api/enrollments/auto-enroll
 * Enroll siswa ke kursus utama. Dipanggil otomatis setelah user baru dibuat.
 * Doc ID = email user (tanpa @/dot encoding).
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

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
      const settingsDoc = await db.collection("appSettings").doc("global").get();
      courseId = settingsDoc.data()?.mainCourseId;
    }

    if (!courseId) return json({ error: "Kursus utama belum diset" }, 404);

    // Doc ID = email
    const enrollId = email;
    const enrollRef = db.collection("enrollments").doc(enrollId);
    const existEnroll = await enrollRef.get();

    if (existEnroll.exists) {
      return json({ message: "Sudah terdaftar", enrollment: { id: enrollId, ...existEnroll.data() } });
    }

    // Ambil nama dari users collection
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    const displayName = userDoc.data()?.displayName || decoded.name || "";

    const data = {
      id: enrollId,
      userId: decoded.uid,
      email,
      displayName,
      courseId,
      eventId: body.eventId ?? null,
      channelSource: body.channelSource ?? null,
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

    await enrollRef.set(data);
    return json({ message: "Berhasil terdaftar", enrollment: data }, 201);
  } catch (e) {
    return handleError(e);
  }
}
