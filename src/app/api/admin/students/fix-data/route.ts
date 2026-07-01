/**
 * GET /api/admin/students/fix-data?mode=names|ages
 * Untuk halaman perbaikan data admin. Memindai SELURUH siswa (bukan 1 halaman)
 * lalu mengembalikan hanya yang perlu diperbaiki:
 *  - mode=names : nama terdeteksi aneh (isSuspiciousName)
 *  - mode=ages  : usia > 29 tahun
 *
 * Penting: pakai aggregateDashboard(includeStudents:true) agar dapat SEMUA siswa,
 * bukan endpoint stats (yang includeStudents:false → students kosong).
 */
import { NextRequest } from "next/server";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { aggregateDashboard } from "@/lib/dashboard-aggregator";
import { isSuspiciousName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const mode = req.nextUrl.searchParams.get("mode") || "names";
    const bypassCache = req.nextUrl.searchParams.get("refresh") === "1";

    const result = await aggregateDashboard({}, { includeStudents: true, bypassCache });
    const all = result.students || [];

    let filtered;
    if (mode === "ages") {
      filtered = all
        .filter((s) => {
          const age = parseInt(s.umur, 10);
          return !isNaN(age) && age > 29;
        })
        // Urutkan dari usia paling tua → termuda.
        .sort((a, b) => (parseInt(b.umur, 10) || 0) - (parseInt(a.umur, 10) || 0));
    } else {
      filtered = all.filter((s) => isSuspiciousName(s.namaLengkap));
    }

    // Hanya kirim field yang dibutuhkan halaman (payload kecil).
    const students = filtered.map((s) => ({
      uid: s.uid,
      email: s.email,
      namaLengkap: s.namaLengkap,
      tanggalLahir: s.tanggalLahir, // format dd/mm/yyyy dari aggregator
      umur: s.umur,
    }));

    return json({ students, total: students.length });
  } catch (e) {
    return handleError(e);
  }
}
