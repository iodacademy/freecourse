import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

// Helper function to fetch all admin users
async function fetchAdminUsers(db: FirebaseFirestore.Firestore) {
  const snapshot = await db.collection("admin").orderBy("createdAt", "desc").get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();
    const users = await fetchAdminUsers(db);
    return json(users);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const { code, role } = body;

    if (!code || !role) {
      return json({ error: "Kode akses dan role wajib diisi" }, 400);
    }

    const db = getAdminDb();
    
    // Cek apakah kode sudah dipakai
    const existing = await db.collection("admin").where("code", "==", code).get();
    if (!existing.empty) {
      return json({ error: "Kode akses sudah digunakan" }, 400);
    }

    const newAdminRef = db.collection("admin").doc();
    await newAdminRef.set({
      code,
      role,
      createdAt: FieldValue.serverTimestamp()
    });

    return json({ success: true, message: "Akses admin berhasil ditambahkan" });
  } catch (e) {
    return handleError(e);
  }
}
