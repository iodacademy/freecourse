/**
 * GET  /api/enrollments          — daftar enrollments (admin: semua, siswa: milik sendiri)
 * POST /api/enrollments/auto-enroll — lihat route terpisah
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, json, handleError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const decoded = await requireAuth(req);
    const db = getAdminDb();

    const email = decoded.email;
    if (!email) return json([], 200);

    const query = db.collection("enrollments").where("email", "==", email);

    const snap = await query.get();
    const enrollments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Catatan: blok "self-healing" yang dulu menulis beasiswaType/waGroupLink ke
    // dokumen saat GET sengaja dihapus. Menulis beasiswaType di sini membuat peserta
    // beasiswa legacy terlihat "sudah klaim benefit" padahal belum. Sekarang benefit
    // (termasuk waGroupLink) hanya diisi saat peserta mengklaim sendiri via /learn/bonus.

    return json(enrollments);
  } catch (e) {
    return handleError(e);
  }
}
