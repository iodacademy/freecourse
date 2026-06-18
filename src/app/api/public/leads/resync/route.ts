import { NextRequest } from "next/server";
import { requireSyncKey, json, handleError } from "@/lib/api-helpers";
import { getAdminDb } from "@/lib/firebase-admin";
import { syncUserFromLead } from "@/lib/leads-sync";

export const dynamic = "force-dynamic";

/**
 * POST /api/public/leads/resync
 *
 * Perbaikan MASSAL: menyamakan SEMUA dokumen `users` & `enrollments` peserta
 * yang sudah terverifikasi dengan data terbaru (rapi) di collection `leads`.
 *
 * Berguna untuk membereskan data lama yang terlanjur tersimpan mentah di `users`
 * sebelum logika perapian data diterapkan.
 *
 * Hanya memperbarui identitas (profileData + displayName). TIDAK menyentuh
 * progres belajar, kuis, survei, sertifikat, atau bonus.
 *
 * Auth: header X-Sync-Key (sama dengan settings.app.syncKey).
 *
 * Cara memanggil (contoh, dari terminal/Postman):
 *   POST https://freecourse.iodacademy.id/api/public/leads/resync
 *   Header: X-Sync-Key: <sync key dari Admin>
 */
export async function POST(req: NextRequest) {
  try {
    await requireSyncKey(req);

    const db = getAdminDb();
    const snap = await db.collection("leads").get();

    let total = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const doc of snap.docs) {
      total++;
      const d = doc.data();
      const email = String(d.email || doc.id || "").toLowerCase();
      if (!email) {
        skipped++;
        continue;
      }
      try {
        const result = await syncUserFromLead(
          email,
          d.profileData || {},
          String(d.nama || d.profileData?.nama_lengkap || "Peserta")
        );
        if (result === "updated") updated++;
        else skipped++;
      } catch (e: any) {
        errors.push(`${email}: ${e?.message || e}`);
      }
    }

    return json({
      success: true,
      totalLeads: total,
      usersUpdated: updated,
      skipped, // belum verifikasi (tidak ada users) atau email kosong
      errors: errors.length,
      errorDetail: errors.slice(0, 20),
    });
  } catch (e) {
    return handleError(e);
  }
}
