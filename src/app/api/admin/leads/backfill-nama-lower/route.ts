import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError, requireSuperAdmin } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/leads/backfill-nama-lower  (Super Admin only) — SEKALI JALAN
 *
 * Mengisi field `nama_lower` (nama huruf kecil) pada lead lama supaya pencarian
 * AWALAN nama di gerbang verifikasi (/api/public/meta/search) bisa terindeks.
 * Lead baru sudah otomatis punya `nama_lower` saat ingest.
 *
 * Idempoten — hanya menulis lead yang `nama_lower`-nya belum cocok.
 *
 * Auth: header Authorization: Bearer <kode super admin>.
 */
export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const db = getAdminDb();

    const leadsSnap = await db.collection("leads").get();

    let updated = 0;
    let batch = db.batch();
    let ops = 0;

    for (const doc of leadsSnap.docs) {
      const data = doc.data();
      const nama = String(data.nama || data.profileData?.nama_lengkap || "");
      const want = nama.toLowerCase();
      if (data.nama_lower === want) continue; // sudah benar

      batch.update(doc.ref, { nama_lower: want });
      ops++;
      updated++;
      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    return json({ success: true, totalLeads: leadsSnap.size, updated });
  } catch (e) {
    return handleError(e);
  }
}
