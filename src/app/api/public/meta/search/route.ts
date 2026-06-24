import { NextRequest } from "next/server";
import { json, handleError } from "@/lib/api-helpers";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/meta/search?q=...
 *
 * Endpoint PUBLIK (tanpa login) untuk gerbang verifikasi peserta Meta.
 * Peserta mengetik email (lengkap/awalan) ATAU AWALAN nama → cari di `leads`.
 *
 * Pencarian memakai query TERINDEKS (bukan scan koleksi), jadi akurat berapa pun
 * besar koleksinya:
 *   1. email cocok PERSIS (doc id = email)            → menangkap email lengkap
 *   2. email AWALAN (prefix)                            → mis. "syamil" → "syamil...@gmail.com"
 *   3. nama AWALAN (prefix, butuh field `nama_lower`)   → mis. "budi" → "Budi Santoso"
 *
 * Catatan: pencarian nama hanya cocok dari AWAL nama (bukan tengah kata),
 * karena Firestore tidak mendukung substring. Untuk cari "Basayev" pada
 * "Syamil Basayev", peserta sebaiknya pakai email atau awalan namanya.
 *
 * Privasi:
 * - Minimal 3 karakter, hasil dibatasi maksimal 8.
 * - Email DISAMARKAN (mis. "ra***@gmail.com"); email asli TIDAK ditampilkan.
 * - verify tetap memvalidasi ulang ke Firestore sebelum membuat data.
 */

// Karakter unicode tertinggi → batas akhir range pencarian awalan (prefix).
// [q .. q+PREFIX_END] = semua dokumen yang diawali string q.
const PREFIX_END = "";

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const visible = user.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, user.length - 2))}@${domain}`;
}

type Hit = {
  leadId: string;
  nama: string;
  maskedEmail: string;
  verified: boolean;
};

function toHit(doc: FirebaseFirestore.DocumentSnapshot): Hit | null {
  const d = doc.data() || {};
  const email = String(d.email || doc.id || "").toLowerCase();
  if (!email) return null;
  const nama = String(d.nama || d.profileData?.nama_lengkap || "");
  return {
    leadId: email, // dipakai langkah verify; verify memvalidasi ulang
    nama: nama || "(Tanpa nama)",
    maskedEmail: maskEmail(email),
    // Tandai sudah diverifikasi → komponen menampilkan label "lanjutkan belajar".
    verified: d.verified === true,
  };
}

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

    if (q.length < 3) {
      return json({ results: [], message: "Ketik minimal 3 huruf." });
    }

    const db = getAdminDb();
    const leads = db.collection("leads");

    // Dedup berdasarkan email (doc id) supaya hasil email & nama tidak dobel.
    const byEmail = new Map<string, Hit>();
    const add = (hit: Hit | null) => {
      if (hit && !byEmail.has(hit.leadId)) byEmail.set(hit.leadId, hit);
    };

    // 1) Cocok PERSIS by email (doc id = email). Menangkap kasus orang mengetik
    //    email lengkap — apa pun posisinya di koleksi.
    //    (limit(500) versi lama membuat lead ke-501+ tak pernah terpindai.)
    const exact = await leads.doc(q).get();
    if (exact.exists) add(toHit(exact));

    // 2) Cocok AWALAN (prefix) by email. Query terindeks, bukan scan koleksi.
    const emailSnap = await leads
      .orderBy("__name__")
      .startAt(q)
      .endAt(q + PREFIX_END)
      .limit(8)
      .get();
    emailSnap.docs.forEach((doc) => add(toHit(doc)));

    // 3) Cocok AWALAN by nama (huruf kecil). Perlu field `nama_lower` —
    //    diisi otomatis saat ingest; data lama via backfill-nama-lower.
    if (byEmail.size < 8) {
      const namaSnap = await leads
        .orderBy("nama_lower")
        .startAt(q)
        .endAt(q + PREFIX_END)
        .limit(8)
        .get();
      namaSnap.docs.forEach((doc) => add(toHit(doc)));
    }

    return json({ results: Array.from(byEmail.values()).slice(0, 8) });
  } catch (e) {
    return handleError(e);
  }
}
