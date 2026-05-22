/**
 * POST /api/enrollments/redeem
 * Generate kode redeem untuk kursus tambahan (Bonus Course).
 * Syarat: user sudah lulus main course dan belum claim redeem code.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

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
    const classCode = topicDoc.data()?.classCode;

    // Validasi Enrollment
    const enrollRef = db.collection("enrollments").doc(enrollmentId);
    const enrollDoc = await enrollRef.get();
    
    if (!enrollDoc.exists) return json({ error: "Enrollment not found" }, 404);
    const enrollData = enrollDoc.data()!;
    
    if (enrollData.userId !== decoded.uid) return json({ error: "Forbidden" }, 403);
    if (!enrollData.certificateClaimed) return json({ error: "Sertifikat harus diklaim dulu" }, 400);
    if (enrollData.bonusCourseRedeemCode) return json({ error: "Kode redeem sudah diklaim" }, 400);

    // Ambil Username
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    const emailUsername = userDoc.data()?.emailUsername || "user";
    
    // Generate Kode: Username + ClassCode (e.g. jondoebhr30)
    const redeemCode = `${emailUsername}${classCode}`.toLowerCase().replace(/[^a-z0-9]/g, "");

    await enrollRef.update({
      bonusCourseTopicId: topicId,
      bonusCourseRedeemCode: redeemCode,
      updatedAt: FieldValue.serverTimestamp()
    });

    return json({ success: true, redeemCode });
  } catch (e) {
    return handleError(e);
  }
}
