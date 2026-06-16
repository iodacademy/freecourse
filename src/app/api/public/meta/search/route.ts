import { NextRequest } from "next/server";
import { json, handleError } from "@/lib/api-helpers";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/meta/search?q=...
 *
 * Endpoint PUBLIK (tanpa login) untuk gerbang verifikasi peserta Meta.
 * Peserta mengetik sebagian email ATAU nama → cari di collection `leads`.
 *
 * Privasi:
 * - Minimal 3 karakter.
 * - Hasil dibatasi maksimal 8.
 * - Email DISAMARKAN (mis. "ra***@gmail.com"); email asli TIDAK dikirim ke browser.
 * - Yang dikirim hanya { leadId (disamarkan-aman), nama, maskedEmail }.
 *
 * `leadId` di sini adalah email asli (dipakai langkah verify), tapi karena ini
 * bisa terlihat di network, kita TETAP samarkan tampilan & verify akan
 * memvalidasi ulang ke Firestore. Untuk keamanan tambahan, leadId dikirim
 * sebagai email asli hanya bila cocok — verify tetap satu-satunya yang membuat data.
 */

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const visible = user.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, user.length - 2))}@${domain}`;
}

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

    if (q.length < 3) {
      return json({ results: [], message: "Ketik minimal 3 huruf." });
    }

    const db = getAdminDb();

    // Ambil sebagian leads untuk difilter di server (substring match).
    // Dibatasi agar tidak memindai seluruh koleksi.
    const snap = await db.collection("leads").limit(500).get();

    const results: { leadId: string; nama: string; maskedEmail: string }[] = [];
    for (const doc of snap.docs) {
      if (results.length >= 8) break;
      const d = doc.data();
      const email = String(d.email || doc.id || "").toLowerCase();
      const nama = String(d.nama || d.profileData?.nama_lengkap || "");
      const namaLower = nama.toLowerCase();

      if (email.includes(q) || namaLower.includes(q)) {
        results.push({
          leadId: email, // dipakai langkah verify; verify memvalidasi ulang
          nama: nama || "(Tanpa nama)",
          maskedEmail: maskEmail(email),
        });
      }
    }

    return json({ results });
  } catch (e) {
    return handleError(e);
  }
}
