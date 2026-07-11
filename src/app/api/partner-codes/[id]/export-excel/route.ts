import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin, handleError } from "@/lib/api-helpers";
import {
  aggregateDashboard,
  SHEET_HEADERS,
  studentToRow,
} from "@/lib/dashboard-aggregator";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const db = getAdminDb();
    const eventDoc = await db.collection("events").doc(id).get();
    
    if (!eventDoc.exists) {
      throw new Error("Event not found");
    }
    
    const eventData = eventDoc.data() as any;
    const partnerCode = eventData.partnerCode;
    
    if (!partnerCode) {
      throw new Error("Partner code not found for this event");
    }

    // Ambil parameter filter status dari URL (misal: ?status=inProgress)
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status") || "all";

    // Gunakan fungsi aggregasi dari dashboard utama agar format kolom dan perhitungannya SAMA PERSIS
    const { students, generatedAt } = await aggregateDashboard(
      { channel: "kemitraan", source: partnerCode },
      { rawExport: true } // Export raw untuk mendapatkan semua data yang sesuai
    );

    // Pastikan kita hanya mengambil siswa dengan partner code yang persis sama
    let filteredStudents = students.filter((s) => s.partnerCode === partnerCode);

    // Apply filter tambahan dari UI jika ada
    if (statusFilter === "inProgress") {
      filteredStudents = filteredStudents.filter(p => p.profileCompleted && p.certStatus !== "ready" && p.certStatus !== "processing");
    } else if (statusFilter === "certified") {
      filteredStudents = filteredStudents.filter(p => p.certStatus === "ready" || p.certStatus === "processing" || p.status === "Tersertifikasi");
    }

    // Gunakan mapper studentToRow untuk menjamin output per baris SAMA PERSIS dengan database utama
    const rows = filteredStudents.map(studentToRow);
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
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
