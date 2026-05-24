import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

// Helper function to fetch all admin users
async function fetchAdminUsers(db: FirebaseFirestore.Firestore) {
  const snapshot = await db.collection("admin").get();
  const docs = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as any[];

  // superadmin selalu paling atas, sisanya urut createdAt desc
  docs.sort((a, b) => {
    if (a.id === "superadmin") return -1;
    if (b.id === "superadmin") return 1;
    const ta = a.createdAt?._seconds ?? 0;
    const tb = b.createdAt?._seconds ?? 0;
    return tb - ta;
  });

  return docs;
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
