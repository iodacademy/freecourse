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

export async function POST(req: NextRequest) {
  try {
    const { accessCode } = await req.json();

    if (!accessCode) {
      return json({ error: "Kode akses wajib diisi" }, 400);
    }

    const db = getAdminDb();
    const adminDocs = await db.collection("admin").where("code", "==", accessCode).get();

    if (adminDocs.empty) {
      return json({ error: "Kode akses salah" }, 401);
    }

    const adminData = adminDocs.docs[0].data();

    // Default return payload
    const user = {
      uid: "admin",
      role: adminData.role || "admin",
      email: "admin@ioda.id",
      displayName: "Admin IODA",
      profileCompleted: true
    };

    return json({ status: "success", user });
  } catch (e) {
    return handleError(e);
  }
}
