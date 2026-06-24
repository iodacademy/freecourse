import { NextRequest } from "next/server";
import { json, handleError, requireSuperAdmin } from "@/lib/api-helpers";
import { importStudent, type ImportRow } from "@/lib/import-student";
import { randomMillisBetween, parseDateInput } from "@/lib/random-date";
import { invalidateDashboardCache } from "@/lib/dashboard-aggregator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/students/import  (Super Admin only)
 *
 * Import peserta dari file (rows sudah di-parse di client). Tiap peserta dibuat
 * langsung berstatus SELESAI/tersertifikasi, dengan "Tanggal Daftar" ACAK di
 * dalam rentang [startDate, endDate] (acak sampai jam/menit/detik).
 *
 * PDF sertifikat TIDAK dibuat di sini — ditandai pdfPending lalu digenerate di
 * latar belakang oleh cron /api/cron/generate-pending-pdf.
 *
 * Diproses per-batch agar tidak timeout. Frontend memanggil berulang dengan
 * potongan rows (mis. 25 per panggilan) sampai habis.
 *
 * body: {
 *   rows: ImportRow[],          // potongan baris untuk batch ini
 *   startDate: "YYYY-MM-DD",    // batas bawah tanggal daftar acak
 *   endDate: "YYYY-MM-DD"       // batas atas
 * }
 *
 * Auth: header Authorization: Bearer <kode super admin>.
 */

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req);

    const body = await req.json().catch(() => ({}));
    const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length === 0) return json({ error: "rows kosong" }, 400);
    if (rows.length > 50) return json({ error: "Maksimal 50 baris per batch" }, 400);

    const startMs = parseDateInput(String(body?.startDate || ""), false);
    const endMs = parseDateInput(String(body?.endDate || ""), true);
    if (startMs === null || endMs === null) {
      return json({ error: "startDate / endDate tidak valid (format YYYY-MM-DD)" }, 400);
    }
    if (endMs < startMs) {
      return json({ error: "endDate harus >= startDate" }, 400);
    }

    const results = [];
    for (const row of rows) {
      const createdAtMs = randomMillisBetween(startMs, endMs);
      const r = await importStudent(row, createdAtMs);
      results.push(r);
    }

    const completed = results.filter((r) => r.status === "completed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error");

    if (completed > 0) invalidateDashboardCache();

    return json({
      success: true,
      completed,
      skipped,
      errors: errors.length,
      errorDetail: errors.slice(0, 20),
    });
  } catch (e) {
    return handleError(e);
  }
}
