import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";
import { autoCompleteLead } from "@/lib/auto-complete-lead";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/auto-complete
 *
 * Menyelesaikan otomatis peserta (lead) yang sudah 5 hari sejak mendaftar
 * tapi belum menyelesaikan pelatihan (belum punya sertifikat). Termasuk:
 *  - lead yang BELUM verifikasi (belum ada users/enrollments), dan
 *  - peserta yang sudah verifikasi tapi MANDEK (belum klaim sertifikat).
 *
 * Untuk tiap peserta: buat users+enrollment, isi kuis (skor 60/70/100),
 * isi survei, lalu klaim sertifikat (PDF via GAS) TANPA email.
 *
 * Batas 10 peserta per panggilan. Sisanya diproses pada panggilan berikutnya
 * (atur cron-job.org agar memanggil endpoint ini berkala, mis. tiap 5 menit).
 *
 * Auth: query ?key=ADMIN_ACCESS_CODE  ATAU header Authorization: Bearer <key>.
 */

const DAYS_THRESHOLD = 5;
const MAX_PER_RUN = 10;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const queryKey = req.nextUrl.searchParams.get("key");
    const expectedKey = process.env.ADMIN_ACCESS_CODE || "ADMINFL26";
    if (authHeader !== `Bearer ${expectedKey}` && queryKey !== expectedKey) {
      return json({ error: "Unauthorized" }, 401);
    }

    const db = getAdminDb();

    // Ambang waktu: lead yang createdAt-nya lebih lama dari 5 hari lalu.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DAYS_THRESHOLD);

    // Ambil kandidat lead. Tidak memakai where("autoCompleted","!=",true)
    // karena Firestore akan MELEWATI dokumen yang belum punya field tsb
    // (lead lama belum punya field ini). Jadi kita saring di server.
    const snap = await db
      .collection("leads")
      .orderBy("createdAt", "asc")
      .limit(300)
      .get();

    const results: any[] = [];
    let processed = 0;

    for (const doc of snap.docs) {
      if (processed >= MAX_PER_RUN) break;

      const lead = doc.data();
      if (lead.autoCompleted === true) continue; // sudah pernah diproses

      const email = String(lead.email || doc.id || "").toLowerCase();
      if (!email) continue;

      // Cek umur lead (>= 5 hari).
      let createdAt: Date | null = null;
      if (lead.createdAt?._seconds) createdAt = new Date(lead.createdAt._seconds * 1000);
      else if (lead.createdAt) createdAt = new Date(lead.createdAt);
      // Fallback: pakai created_time form bila createdAt tidak ada.
      if (!createdAt && lead.createdTime) {
        const d = new Date(lead.createdTime);
        if (!isNaN(d.getTime())) createdAt = d;
      }
      if (!createdAt || isNaN(createdAt.getTime())) continue;
      if (createdAt > cutoff) continue; // belum 5 hari → lewati

      // Proses (helper akan skip kalau sudah certified).
      const r = await autoCompleteLead(email, lead);
      results.push(r);
      // Hitung sebagai "diproses" hanya jika benar-benar menyelesaikan,
      // supaya yang di-skip (sudah certified) tidak memakan jatah 10.
      if (r.status === "completed") processed++;
    }

    const completed = results.filter((r) => r.status === "completed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error");

    return json({
      success: true,
      checked: results.length,
      completed,
      skipped,
      errors: errors.length,
      errorDetail: errors.slice(0, 10),
    });
  } catch (e) {
    return handleError(e);
  }
}
