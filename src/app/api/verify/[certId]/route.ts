/**
 * GET /api/verify/[certId]
 * Public endpoint — verifikasi sertifikat berdasarkan certId.
 * Mengembalikan data sertifikat jika valid.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

type Ctx = { params: Promise<{ certId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { certId } = await params;
    const db = getAdminDb();

    // Cari di enrollments berdasarkan certificateId atau workshopCertificateId
    let snap = await db.collection("enrollments")
      .where("certificateId", "==", certId)
      .limit(1)
      .get();

    let isWorkshop = false;

    if (snap.empty) {
      // Coba cari sebagai workshop cert
      snap = await db.collection("enrollments")
        .where("workshopCertificateId", "==", certId)
        .limit(1)
        .get();
      isWorkshop = true;
    }

    if (snap.empty) {
      return Response.json({ valid: false, error: "Sertifikat tidak ditemukan" }, { status: 404 });
    }

    const doc = snap.docs[0];
    const data = doc.data();

    // Format tanggal klaim
    let claimedAt = "";
    const ts = isWorkshop ? data.workshopCertificateClaimedAt : data.certificateClaimedAt;
    if (ts) {
      const date = typeof ts === "object" && ts._seconds
        ? new Date(ts._seconds * 1000)
        : new Date(ts);
      if (!isNaN(date.getTime())) {
        claimedAt = date.toLocaleDateString("id-ID", {
          day: "numeric", month: "long", year: "numeric",
        });
      }
    }

    const result = {
      valid: true,
      certId,
      nama: isWorkshop
        ? (data.workshopCertificateName || data.certificateName || "Peserta")
        : (data.certificateName || "Peserta"),
      program: isWorkshop
        ? (data.workshopTitle || "Workshop YouRise")
        : "Modul Financial Literacy and Job Readiness",
      penyelenggara: "DBS Foundation dan Plan Indonesia",
      tanggalKlaim: claimedAt,
      isWorkshop,
    };

    return Response.json(result);
  } catch (e: any) {
    console.error("[verify]", e);
    return Response.json({ valid: false, error: "Terjadi kesalahan" }, { status: 500 });
  }
}
