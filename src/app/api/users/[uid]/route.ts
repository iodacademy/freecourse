/**
 * GET  /api/users/[uid]  — ambil profil user
 * PATCH /api/users/[uid] — update profileData (dan set profileCompleted: true)
 */
import { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin, json, handleError } from "@/lib/api-helpers";
import { invalidateDashboardCache } from "@/lib/dashboard-aggregator";
import { syncStudentIndex, removeStudentIndex } from "@/lib/sync-student-index";
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
    const allowedFields = ["displayName", "photoURL", "channelSource", "eventId", "partnerCode"];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // set dengan merge:true → berfungsi sebagai upsert (create-or-update)
    await ref.set(updateData, { merge: true });
    const updated = await ref.get();
    invalidateDashboardCache();
    syncStudentIndex(uid);
    return json(updated.data());
  } catch (e) {
    console.error("[PATCH /api/users/[uid]] Error:", e);
    return handleError(e);
  }
}

// POST alias — Hostinger proxy blocks PATCH and PUT with 403
export const POST = PATCH;
export const PUT = PATCH;

/**
 * DELETE /api/users/[uid]
 * Hanya admin yang bisa. Menghapus user dari:
 * 1. Firebase Authentication
 * 2. Koleksi "users" di Firestore
 * 3. Koleksi "enrollments" (semua enrollment user tersebut)
 * 4. Koleksi "certificates" (jika ada)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    // Hanya admin yang boleh menghapus
    await requireAdmin(req);
    const { uid } = await params;

    const db = getAdminDb();
    const auth = getAdminAuth();

    // 1. Hapus dari Firebase Authentication
    try {
      await auth.deleteUser(uid);
    } catch (authErr: any) {
      // Jika user tidak ditemukan di Auth, lanjutkan saja hapus dari Firestore
      if (authErr.code !== "auth/user-not-found") {
        throw authErr;
      }
    }

    // 2. Hapus dokumen user dari koleksi "users"
    await db.collection("users").doc(uid).delete();

    // 3. Hapus semua enrollments milik user ini
    const enrollmentsSnap = await db
      .collection("enrollments")
      .where("userId", "==", uid)
      .get();
    const enrollBatch = db.batch();
    enrollmentsSnap.docs.forEach((doc) => enrollBatch.delete(doc.ref));
    await enrollBatch.commit();

    // 4. Hapus semua certificates milik user ini (jika koleksi ada)
    const certsSnap = await db
      .collection("certificates")
      .where("userId", "==", uid)
      .get();
    if (!certsSnap.empty) {
      const certBatch = db.batch();
      certsSnap.docs.forEach((doc) => certBatch.delete(doc.ref));
      await certBatch.commit();
    }

    invalidateDashboardCache();
    removeStudentIndex(uid);
    return json({ success: true, message: `User ${uid} berhasil dihapus sepenuhnya.` });
  } catch (e) {
    return handleError(e);
  }
}
