import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError, requireSuperAdmin } from "@/lib/api-helpers";
import { autoCompleteLead } from "@/lib/auto-complete-lead";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/leads/force-complete-all  (Super Admin only)
 *
 * Versi MANUAL & DIPERCEPAT dari /api/cron/auto-complete:
 * memproses lead yang belum selesai TANPA menunggu batas 5 hari.
 *
 * Karena jumlah lead bisa banyak, satu panggilan memproses paling banyak
 * MAX_PER_RUN peserta lalu mengembalikan `remaining`. Frontend memanggil
 * ulang sampai `remaining` = 0 (progress bar).
 *
 * Auth: header Authorization: Bearer <kode super admin>.
 */

const MAX_PER_RUN = 15;

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req);

    const db = getAdminDb();

    // Ambil kandidat lead (urut terlama dulu). Saring autoCompleted di server
    // karena lead lama belum tentu punya field tsb.
    const snap = await db
      .collection("leads")
      .orderBy("createdAt", "asc")
      .limit(500)
      .get();

    const pending = snap.docs.filter((d) => d.data().autoCompleted !== true);
    const totalPending = pending.length;

    const results: Array<{ email: string; status: string; reason?: string }> = [];
    let processed = 0;

    for (const doc of pending) {
      if (processed >= MAX_PER_RUN) break;

      const lead = doc.data();
      const email = String(lead.email || doc.id || "").toLowerCase();
      if (!email) continue;

      // Tanpa cek umur 5 hari — itu inti fitur ini.
      const r = await autoCompleteLead(email, lead);
      results.push(r);
      if (r.status === "completed") processed++;
    }

    const completed = results.filter((r) => r.status === "completed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error");
    // Sisa = total pending dikurangi yang baru selesai (skip tidak mengurangi
    // jatah karena memang sudah certified — tapi tetap hilang dari pending pada
    // panggilan berikutnya setelah lead ditandai autoCompleted).
    const remaining = Math.max(0, totalPending - results.length);

    return json({
      success: true,
      totalPending,
      checked: results.length,
      completed,
      skipped,
      errors: errors.length,
      errorDetail: errors.slice(0, 10),
      remaining,
      done: remaining === 0,
    });
  } catch (e) {
    return handleError(e);
  }
}
