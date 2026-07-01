import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { invalidateDashboardCache } from "@/lib/dashboard-aggregator";
import { syncStudentIndex } from "@/lib/sync-student-index";
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
    const { newName, tanggalLahir } = body;

    // Minimal salah satu field yang diubah.
    if (newName === undefined && tanggalLahir === undefined) {
      return json({ error: "Tidak ada perubahan" }, 400);
    }

    const db = getAdminDb();
    const ref = db.collection("users").doc(uid);
    const doc = await ref.get();

    if (!doc.exists) {
      return json({ error: "Peserta tidak ditemukan" }, 404);
    }

    const profileData = doc.data()?.profileData || {};
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    // ── Ubah nama ──
    if (newName !== undefined) {
      if (!newName || newName.trim().length < 3) {
        return json({ error: "Nama terlalu pendek" }, 400);
      }
      profileData.namaLengkap = newName.trim();
      if (profileData.nama_lengkap !== undefined) {
        profileData.nama_lengkap = newName.trim();
      }
      update.displayName = newName.trim();
    }

    // ── Ubah tanggal lahir (format ISO "YYYY-MM-DD") ──
    if (tanggalLahir !== undefined) {
      const iso = String(tanggalLahir).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        return json({ error: "Format tanggal lahir harus YYYY-MM-DD" }, 400);
      }
      // Tulis ke key kanonik + key snake_case bila sudah ada, agar konsisten
      // dengan cara aggregator membaca (mencari key mengandung "tanggal"+"lahir").
      profileData.tanggalLahir = iso;
      if (profileData.tanggal_lahir !== undefined) {
        profileData.tanggal_lahir = iso;
      }
    }

    update.profileData = profileData;
    await ref.update(update);

    invalidateDashboardCache();
    syncStudentIndex(uid);
    return json({ success: true, message: "Data berhasil diperbarui" });
  } catch (e) {
    return handleError(e);
  }
}
