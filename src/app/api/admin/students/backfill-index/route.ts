import { NextRequest } from "next/server";
import { json, handleError, requireSuperAdmin } from "@/lib/api-helpers";
import { rebuildStudentsIndex } from "@/lib/dashboard-aggregator";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/admin/students/backfill-index  (Super Admin only) — SEKALI JALAN
 *
 * Mengisi collection `studentsIndex` (+ `studentsMeta/detailChannels`) untuk
 * SEMUA siswa lama, supaya pagination sejati di halaman Siswa bisa dipakai.
 * Jalankan sekali setelah deploy, lalu aktifkan env STUDENTS_INDEX_ENABLED=1.
 * Idempoten — aman dijalankan ulang.
 *
 * Auth: header Authorization: Bearer <kode super admin>.
 */
export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const result = await rebuildStudentsIndex();
    return json({ success: true, ...result });
  } catch (e) {
    return handleError(e);
  }
}
