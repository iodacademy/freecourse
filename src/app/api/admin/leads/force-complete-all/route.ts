import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError, requireSuperAdmin } from "@/lib/api-helpers";
import { autoCompleteLead } from "@/lib/auto-complete-lead";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/leads/force-complete-all  (Super Admin only)
 *
 * Versi MANUAL & DIPERCEPAT dari /api/cron/auto-complete: memproses lead dari
 * Facebook Instant Form yang belum selesai TANPA menunggu batas 5 hari.
 *
 * Karena tiap lead butuh generate sertifikat (lambat) dan bisa banyak, endpoint
 * ini dibuat agar TIDAK pernah timeout: satu panggilan = satu langkah kecil.
 *
 *   body { action: "list" }      → kembalikan daftar email lead yang masih pending
 *                                  ({ pending: string[], total }). Tidak memproses.
 *   body { action: "process",    → proses SATU lead, kembalikan hasilnya.
 *          email }                 ({ result: { email, status, reason } })
 *
 * Frontend memanggil "list" sekali, lalu "process" satu per satu sambil
 * menampilkan progress (X dari N). Ini membuat tiap request sangat cepat.
 *
 * Auth: header Authorization: Bearer <kode super admin>.
 */

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req);

    const body = await req.json().catch(() => ({}));
    const action = body?.action || "list";
    const db = getAdminDb();

    // ── action: list — kumpulkan email lead yang BELUM VERIFIKASI ──
    if (action === "list") {
      // Fokus tombol ini: lead Instant Form yang BELUM jadi siswa (belum punya
      // dokumen users/enrollments). Penanda: field `verified` di dokumen leads,
      // di-set saat peserta mengisi identitas (verifikasi awal).
      //
      // Lead yang SUDAH verifikasi tapi belum selesai/belum sertif diurus oleh
      // tombol "Luluskan Massal", bukan di sini.
      //
      // Ringan & stabil: daftar pending hanya bergantung jumlah lead yang belum
      // verifikasi (menyusut tiap diproses), bukan total seluruh leads/users.
      const leadsSnap = await db
        .collection("leads")
        .where("verified", "==", false)
        .get();

      const pending = leadsSnap.docs
        .filter((d) => d.data().autoCompleted !== true)
        .map((d) => String(d.data().email || d.id || "").toLowerCase())
        .filter(Boolean);

      const unique = Array.from(new Set(pending));
      return json({ success: true, pending: unique, total: unique.length });
    }

    // ── action: process — proses satu lead berdasarkan email ──
    if (action === "process") {
      const email = String(body?.email || "").toLowerCase();
      if (!email) return json({ error: "email wajib diisi" }, 400);

      const leadDoc = await db.collection("leads").doc(email).get();
      if (!leadDoc.exists) {
        return json({ result: { email, status: "skipped", reason: "lead_not_found" } });
      }
      const lead = leadDoc.data()!;
      if (lead.autoCompleted === true) {
        return json({ result: { email, status: "skipped", reason: "already_done" } });
      }

      // Tanpa cek umur 5 hari — itu inti fitur ini.
      const result = await autoCompleteLead(email, lead);
      return json({ result });
    }

    return json({ error: "action tidak dikenal" }, 400);
  } catch (e) {
    return handleError(e);
  }
}
