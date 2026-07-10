import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin, handleError } from "@/lib/api-helpers";
import {
  aggregateDashboard,
  parseAreasFromSearchParams,
  parseFilterFromSearchParams,
  SHEET_HEADERS,
  studentToRow,
} from "@/lib/dashboard-aggregator";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const filter = parseFilterFromSearchParams(req.nextUrl.searchParams);
    // mode: clean (default) | raw | mismatch. Param lama ?raw=1 tetap didukung.
    const rawParam = req.nextUrl.searchParams.get("raw") === "1";
    const mode = (req.nextUrl.searchParams.get("mode") || (rawParam ? "raw" : "clean")) as
      | "clean"
      | "raw"
      | "mismatch";
    // ?areas=jabodetabek,medan — hanya berlaku untuk mode clean.
    const areas = parseAreasFromSearchParams(req.nextUrl.searchParams);
    const { students, generatedAt } = await aggregateDashboard(filter, {
      includeStudents: true,
      // Clean: hanya Tersertifikasi, di area terpilih & usia memenuhi syarat
      //        (≤29 th; ≤35 th untuk penyandang disabilitas).
      // Raw: Selesai + Tersertifikasi, semua daerah & semua usia.
      // Mismatch: Selesai + Tersertifikasi, di luar area program ATAU usia lewat batas.
      rawExport: mode === "raw",
      mismatchExport: mode === "mismatch",
      exportOnlyCertified: mode === "clean",
      cleanExport: mode === "clean",
      areas: mode === "clean" ? areas : undefined,
    });

    const rows = students.map(studentToRow);
    const aoa: (string | number)[][] = [Array.from(SHEET_HEADERS), ...rows];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Column widths
    ws["!cols"] = SHEET_HEADERS.map((h) => ({ wch: Math.max(12, h.length + 2) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Dashboard");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    // Sisipkan area di nama file agar beberapa unduhan Clean tidak tertukar.
    const areaTag = mode === "clean" && areas ? `-${areas.join("_")}` : "";
    const filename = `dashboard-yourise-${mode}${areaTag}-${generatedAt.replace(/[: ]/g, "-")}.xlsx`;

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
