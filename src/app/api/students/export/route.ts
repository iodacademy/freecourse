/**
 * GET /api/students/export
 * Export data siswa ke Excel (.xlsx) menggunakan SheetJS.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, handleError } from "@/lib/api-helpers";
import * as xlsx from "xlsx";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();
    
    // Ambil data siswa
    const snap = await db.collection("users").where("role", "==", "student").get();
    
    const rows = snap.docs.map(doc => {
      const data = doc.data();
      return {
        UID: doc.id,
        "Nama Lengkap": data.profileData?.namaLengkap || data.displayName || "",
        "Email": data.email || "",
        "No HP": data.profileData?.nomorWA || "",
        "Channel": data.channelSource || "",
        "Event ID": data.eventId || "",
        "Partner Code": data.partnerCode || "",
        "Gender": data.profileData?.jenisKelamin || "",
        "Provinsi": data.profileData?.provinsi || "",
        "Selesai Profil": data.profileCompleted ? "Ya" : "Tidak",
      };
    });

    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Students");

    const buf = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Disposition": 'attachment; filename="data_siswa.xlsx"',
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
