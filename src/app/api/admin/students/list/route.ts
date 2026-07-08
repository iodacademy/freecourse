import { NextRequest } from "next/server";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { queryStudents, type StudentsQuery } from "@/lib/dashboard-aggregator";

export const dynamic = "force-dynamic";

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
      pageSize: num("pageSize", 50),
      channel: sp.get("channel") || "all",
      detailChannel: sp.get("detailChannel") || "all",
      statusKuis: sp.get("statusKuis") || "all",
      status: sp.get("status") || "all",
      search: sp.get("search") || "",
      sortUsia: sp.get("sortUsia") || "default",
      bypassCache: sp.get("refresh") === "1",
    };

    // Source utama tabel siswa adalah users + enrollments.
    // queryStudents akan baca 50 data terbaru untuk halaman default, lalu full scan
    // hanya saat filter/search/sort/refresh dibutuhkan.
    const result = await queryStudents(q);
    return json(result);
  } catch (e) {
    return handleError(e);
  }
}
