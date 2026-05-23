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
    const body = await req.json();
    const code = body.code?.toUpperCase();
    if (!code) return json({ error: "code required" }, 400);

    const db = getAdminDb();
    
    // Cek di collection events (Event B2B Kampus)
    const eventSnap = await db.collection("events")
      .where("partnerCode", "==", code)
      .where("channelType", "==", "b2b_campus")
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (!eventSnap.empty) {
      const eventData = eventSnap.docs[0].data();
      return json({
        valid: true,
        partnerName: eventData.name, // Gunakan nama event sbg nama mitra
        eventId: eventSnap.docs[0].id,
        courseId: eventData.courseId || "",
      });
    }

    // Jika tidak ada, cek collection partnerCodes (legacy/manual)
    const snap = await db.collection("partnerCodes")
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
