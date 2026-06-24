/**
 * POST /api/profile/update
 * Update profil user. Endpoint ini menghindari:
 * - Dynamic URL path (Hostinger WAF block /api/users/[uid])
 * - PATCH/PUT method (Hostinger proxy block dengan 403)
 * - Authorization header (Hostinger strip header ini)
 * 
 * Token dikirim di body sebagai `idToken` (sama seperti /api/auth/verify)
 */
import { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";
import { invalidateDashboardCache } from "@/lib/dashboard-aggregator";
import { syncStudentIndex } from "@/lib/sync-student-index";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken, ...profilePayload } = body;

    if (!idToken) {
      return json({ error: "idToken required" }, 400);
    }

    // Verifikasi token langsung (tanpa header, tanpa middleware)
    let uid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (tokenErr) {
      console.error("[profile/update] Token verification failed:", tokenErr);
      return json({ error: "Invalid token" }, 401);
    }

    const db = getAdminDb();
    const ref = db.collection("users").doc(uid);

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Update profileData fields
    if (profilePayload.profileData) {
      updateData.profileData = profilePayload.profileData;
      updateData.profileCompleted = true;
    }

    // Allow updating other allowed fields
    const allowedFields = ["displayName", "photoURL", "channelSource", "eventId", "partnerCode", "profileCompleted"];
    for (const field of allowedFields) {
      if (profilePayload[field] !== undefined) {
        updateData[field] = profilePayload[field];
      }
    }

    await ref.set(updateData, { merge: true });
    const updated = await ref.get();

    invalidateDashboardCache();
    syncStudentIndex(uid);

    return json(updated.data());
  } catch (e) {
    console.error("[POST /api/profile/update] Error:", e);
    return handleError(e);
  }
}
