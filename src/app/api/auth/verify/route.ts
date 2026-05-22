/**
 * POST /api/auth/verify
 * Dipanggil setelah login Google SSO di client.
 * - Verifikasi ID Token
 * - Buat dokumen user baru jika belum ada
 * - Auto-enroll ke kursus utama
 * - Return: userProfile + status
 */
import { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const { idToken, channelSource, eventId, partnerCode, utmData } =
      await req.json();

    if (!idToken) return json({ error: "idToken required" }, 400);

    // 1. Verifikasi token
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const { uid, email, name: displayName, picture: photoURL } = decoded;
    const db = getAdminDb();

    // 2. Cek apakah user sudah ada
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // 3a. User baru — buat dokumen
      const emailUsername = email?.split("@")[0] ?? "";
      const newUser = {
        uid,
        email: email ?? "",
        emailUsername,
        displayName: displayName ?? "",
        photoURL: photoURL ?? null,
        role: "student",
        profileCompleted: false,
        profileData: {},
        channelSource: channelSource ?? null,
        eventId: eventId ?? null,
        partnerCode: partnerCode ?? null,
        utmData: utmData ?? null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      await userRef.set(newUser);

      // 3b. Auto-enroll ke kursus utama
      const settingsDoc = await db.collection("appSettings").doc("global").get();
      const mainCourseId = settingsDoc.data()?.mainCourseId;
      if (mainCourseId) {
        const enrollId = `${uid}_${mainCourseId}`;
        const enrollRef = db.collection("enrollments").doc(enrollId);
        const existEnroll = await enrollRef.get();
        if (!existEnroll.exists) {
          await enrollRef.set({
            id: enrollId,
            userId: uid,
            courseId: mainCourseId,
            eventId: eventId ?? null,
            channelSource: channelSource ?? null,
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
          });
        }
      }

      return json({
        status: "new",
        profileCompleted: false,
        user: newUser,
      });
    } else {
      // 3c. User lama
      const data = userDoc.data()!;
      return json({
        status: "existing",
        profileCompleted: data.profileCompleted ?? false,
        user: data,
      });
    }
  } catch (e) {
    return handleError(e);
  }
}
