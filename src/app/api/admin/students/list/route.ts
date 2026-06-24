import { NextRequest } from "next/server";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { queryStudents, queryStudentsPaged, type StudentsQuery } from "@/lib/dashboard-aggregator";

export const dynamic = "force-dynamic";

// Feature flag: pakai pagination sejati (studentsIndex) bila diaktifkan.
// Default OFF supaya aman saat deploy sebelum backfill & index dibuat.
// Aktifkan dengan env STUDENTS_INDEX_ENABLED=1 setelah backfill selesai.
const USE_INDEX = process.env.STUDENTS_INDEX_ENABLED === "1";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const sp = req.nextUrl.searchParams;
    const num = (k: string, def: number) => {
      const v = parseInt(sp.get(k) || "", 10);
      return isNaN(v) ? def : v;
    };

    const q: StudentsQuery = {
      page: num("page", 1),
      pageSize: num("pageSize", 20),
      channel: sp.get("channel") || "all",
      detailChannel: sp.get("detailChannel") || "all",
      statusKuis: sp.get("statusKuis") || "all",
      status: sp.get("status") || "all",
      search: sp.get("search") || "",
      sortUsia: sp.get("sortUsia") || "default",
      bypassCache: sp.get("refresh") === "1",
    };

    // Jalur baru (pagination sejati) hanya untuk kasus yang didukung index.
    // Saat refresh=1 (bypass cache) tetap pakai jalur lama agar admin dapat data
    // paling fresh langsung dari sumber (index bisa sedikit telat dari cron/upsert).
    const result = USE_INDEX && !q.bypassCache
      ? await queryStudentsPaged(q)
      : await queryStudents(q);
    return json(result);
  } catch (e) {
    return handleError(e);
  }
}
