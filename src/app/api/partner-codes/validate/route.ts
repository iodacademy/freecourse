/**
 * POST /api/partner-codes/validate
 * Validasi Kode Mitra saat registrasi Channel 1.
 * Tidak perlu auth — dipanggil sebelum login.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) return json({ error: "code required" }, 400);

    const snap = await getAdminDb().collection("partnerCodes")
      .where("code", "==", code)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (snap.empty) {
      return json({ valid: false, error: "Kode Mitra tidak ditemukan atau sudah nonaktif" });
    }

    const data = snap.docs[0].data();
    return json({
      valid: true,
      partnerName: data.partnerName,
      eventId: data.eventId,
      courseId: data.courseId,
    });
  } catch (e) {
    return handleError(e);
  }
}
