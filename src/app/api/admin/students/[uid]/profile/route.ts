import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

type Ctx = { params: Promise<{ uid: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { uid } = await params;

    if (!uid) {
      return json({ error: "UID tidak valid" }, 400);
    }

    const body = await req.json();
    const { newName } = body;

    if (!newName || newName.trim().length < 3) {
      return json({ error: "Nama terlalu pendek" }, 400);
    }

    const db = getAdminDb();
    const ref = db.collection("users").doc(uid);
    const doc = await ref.get();

    if (!doc.exists) {
      return json({ error: "Peserta tidak ditemukan" }, 404);
    }

    const profileData = doc.data()?.profileData || {};
    profileData.namaLengkap = newName.trim();
    if (profileData.nama_lengkap !== undefined) {
      profileData.nama_lengkap = newName.trim();
    }

    await ref.update({
      displayName: newName.trim(),
      profileData,
      updatedAt: FieldValue.serverTimestamp()
    });

    return json({ success: true, message: "Nama berhasil diperbarui" });
  } catch (e) {
    return handleError(e);
  }
}
