/**
 * POST /api/auth/admin-login
 * Admin login via code (no Firebase Auth).
 * 
 * Flow:
 * 1. Client sends accessCode to this endpoint
 * 2. We verify the code against the `admin` collection in Firestore
 * 3. If valid, return admin profile and code
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";

function normalizeCode(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const { accessCode } = await req.json();
    const normalizedCode = normalizeCode(accessCode);

    if (!normalizedCode) {
      return json({ error: "Kode akses wajib diisi" }, 400);
    }

    const db = getAdminDb();
    const adminDocs = await db.collection("admin").get();
    const adminDoc = adminDocs.docs.find((doc) => normalizeCode(doc.data().code) === normalizedCode);

    if (!adminDoc) {
      return json({ error: "Kode akses salah" }, 401);
    }

    const adminData = adminDoc.data();

    // Super Admin diidentifikasi lewat doc id "superadmin" di collection `admin`.
    const isSuperAdmin = adminDoc.id === "superadmin";

    // Default return payload
    const user = {
      uid: "admin",
      role: adminData.role || "admin",
      isSuperAdmin,
      email: "admin@ioda.id",
      displayName: "Admin IODA",
      profileCompleted: true
    };

    return json({ status: "success", user });
  } catch (e) {
    return handleError(e);
  }
}
