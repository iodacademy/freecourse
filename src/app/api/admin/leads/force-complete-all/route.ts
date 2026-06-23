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

    // ── action: list — kumpulkan email lead yang BENAR-BENAR belum selesai ──
    if (action === "list") {
      // Penting: yang dianggap "pending" adalah lead yang BELUM punya sertifikat,
      // bukan sekadar belum pernah di-auto-complete. Banyak lead sudah jadi siswa
      // dan menyelesaikan pelatihan secara normal (tanpa field autoCompleted di
      // dokumen `leads`), jadi mereka harus disaring berdasarkan enrollments.
      //
      // Strategi efisien: ambil sekali daftar email yang SUDAH certified, lalu
      // saring daftar lead terhadap set itu (hindari 1 get() per lead).
      const [leadsSnap, certSnap] = await Promise.all([
        db.collection("leads").get(),
        db.collection("enrollments").where("certificateClaimed", "==", true).get(),
      ]);

      const certifiedEmails = new Set<string>();
      certSnap.docs.forEach((d) => {
        const data = d.data();
        const em = String(data.email || data.userId || d.id || "").toLowerCase();
        if (em) certifiedEmails.add(em);
      });

      const pending = leadsSnap.docs
        .filter((d) => d.data().autoCompleted !== true)
        .map((d) => String(d.data().email || d.id || "").toLowerCase())
        .filter((em) => em && !certifiedEmails.has(em));

      const unique = Array.from(new Set(pending));
      return json({
        success: true,
        pending: unique,
        total: unique.length,
        totalLeads: leadsSnap.size,
        alreadyCertified: certifiedEmails.size,
      });
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
