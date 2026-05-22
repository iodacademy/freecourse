/**
 * GET  /api/users/[uid]  — ambil profil user
 * PATCH /api/users/[uid] — update profileData (dan set profileCompleted: true)
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const decoded = await requireAuth(req);
    const { uid } = await params;

    // Hanya bisa akses profil sendiri atau admin
    if (decoded.uid !== uid) {
      await requireAdmin(req);
    }

    const doc = await getAdminDb().collection("users").doc(uid).get();
    if (!doc.exists) return json({ error: "User not found" }, 404);

    return json(doc.data());
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const decoded = await requireAuth(req);
    const { uid } = await params;

    if (decoded.uid !== uid) {
      await requireAdmin(req);
    }

    const body = await req.json();
    const db = getAdminDb();
    const ref = db.collection("users").doc(uid);

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Update profileData fields
    if (body.profileData) {
      updateData.profileData = body.profileData;
      updateData.profileCompleted = true;
    }

    // Allow updating other allowed fields
    const allowedFields = ["displayName", "photoURL", "channelSource", "eventId"];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    await ref.update(updateData);
    const updated = await ref.get();
    return json(updated.data());
  } catch (e) {
    return handleError(e);
  }
}
