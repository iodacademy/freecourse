/**
 * GET /api/public/mitra/export-excel?token=xxxx
 * Ekspor SELURUH peserta mitra (event B2B) sebagai Excel. Publik, divalidasi
 * lewat dashboardToken event — sama seperti /api/public/mitra/stats. Kolom &
 * baris identik dengan export admin (SHEET_HEADERS + studentToRow).
 */
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";
import { aggregatePartnerDashboard, SHEET_HEADERS, studentToRow } from "@/lib/dashboard-aggregator";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = (req.nextUrl.searchParams.get("token") || "").trim();
    if (!token) return json({ error: "Not found" }, 404);

    const db = getAdminDb();
    const snap = await db.collection("events").where("dashboardToken", "==", token).limit(1).get();
    if (snap.empty) return json({ error: "Not found" }, 404);

    const ev = snap.docs[0].data() as any;
    const partnerCode = ev.partnerCode || "";
    if (!partnerCode) return json({ error: "Not found" }, 404);

    const { students, generatedAt } = await aggregatePartnerDashboard(
      partnerCode,
      { channel: "kemitraan", source: partnerCode },
      { includeStudents: true }
    );

    const rows = students
      .filter((s) => s.partnerCode === partnerCode)
      .map(studentToRow);
    const aoa: (string | number)[][] = [Array.from(SHEET_HEADERS), ...rows];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = SHEET_HEADERS.map((h) => ({ wch: Math.max(12, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Peserta Mitra");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `Data_Peserta_Mitra_${partnerCode}_${generatedAt.replace(/[: ]/g, "-")}.xlsx`;

    return new Response(buf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
