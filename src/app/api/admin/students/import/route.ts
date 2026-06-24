import { NextRequest } from "next/server";
import { json, handleError, requireSuperAdmin } from "@/lib/api-helpers";
import { importStudent, type ImportRow } from "@/lib/import-student";
import { randomTimestampDaytime, parseDateInput } from "@/lib/random-date";
import { invalidateDashboardCache } from "@/lib/dashboard-aggregator";
import { syncStudentIndex } from "@/lib/sync-student-index";

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
      // Tanggal daftar acak, tapi jam dibatasi 10:00–20:00 WIB (tidak malam).
      const createdAtMs = randomTimestampDaytime(startMs, endMs);
      const r = await importStudent(row, createdAtMs);
      results.push(r);
    }

    const completed = results.filter((r) => r.status === "completed").length;
    const skippedList = results.filter((r) => r.status === "skipped");
    const errors = results.filter((r) => r.status === "error");

    if (completed > 0) invalidateDashboardCache();
    // Sync index untuk peserta yang baru dibuat (userId = email).
    results.filter((r) => r.status === "completed").forEach((r) => syncStudentIndex(r.email));

    return json({
      success: true,
      completed,
      skipped: skippedList.length,
      errors: errors.length,
      // Detail lengkap email yang dilewati/gagal (untuk diunduh admin).
      skippedDetail: skippedList.map((r) => ({ email: r.email, reason: r.reason || "" })),
      errorDetail: errors.map((r) => ({ email: r.email, reason: r.reason || "" })),
    });
  } catch (e) {
    return handleError(e);
  }
}
