import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin, handleError } from "@/lib/api-helpers";
import {
  aggregateDashboard,
  parseFilterFromSearchParams,
  SHEET_HEADERS,
  studentToRow,
} from "@/lib/dashboard-aggregator";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const filter = parseFilterFromSearchParams(req.nextUrl.searchParams);
    const { students, generatedAt } = await aggregateDashboard(filter, { includeStudents: true, exportOnlyCertified: true });

    const rows = students.map(studentToRow);
    const aoa: (string | number)[][] = [Array.from(SHEET_HEADERS), ...rows];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Column widths
    ws["!cols"] = SHEET_HEADERS.map((h) => ({ wch: Math.max(12, h.length + 2) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Dashboard");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `dashboard-yourise-${generatedAt.replace(/[: ]/g, "-")}.xlsx`;

    return new Response(buf as any, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
