/**
 * Mapping kategori bonus course (vl / wpb / bootcamp) → label detailChannel
 * yang tampil di dashboard.
 *
 * Alur:
 *  - Saat peserta dari Facebook Instant Form diverifikasi, detailChannel
 *    default = "All Beasiswa - Facebook Instant Forms" (belum pilih kategori).
 *  - Begitu peserta MEMILIH kategori bonus (saat redeem di akhir journey),
 *    detailChannel di-update sesuai kategori yang dipilih.
 *  - Untuk peserta yang diselesaikan otomatis/manual (auto-complete), kategori
 *    di-RANDOM dari ketiga pilihan agar distribusinya natural.
 */

// Pool kategori untuk auto-complete acak (HANYA kategori "course" klasik).
// review_cv & downloadable TIDAK ikut di-random.
export const BEASISWA_CATEGORIES = ["vl", "wpb", "bootcamp"] as const;
export type BeasiswaCategory = (typeof BEASISWA_CATEGORIES)[number];

export const DEFAULT_BEASISWA_CHANNEL =
  "All Beasiswa - Facebook Instant Forms";

const CATEGORY_LABEL: Record<string, string> = {
  vl: "Video Learning",
  wpb: "WPB",          // data lama — tetap ditangani agar tidak error
  bootcamp: "Bootcamp",
  workshop: "Workshop",
  review_cv: "Review CV",
  downloadable: "Downloadable Konten",
};

/** Ubah kategori → label detailChannel. Kategori tak dikenal → default.
 *  Label SELALU prefix "Beasiswa ..." untuk semua channel (keputusan produk). */
export function detailChannelFromCategory(category?: string | null): string {
  const key = String(category || "").toLowerCase();
  const label = CATEGORY_LABEL[key];
  if (!label) return DEFAULT_BEASISWA_CHANNEL;
  return `Beasiswa ${label} - Facebook Instant Forms`;
}

/**
 * Pilih kategori "acak" secara DETERMINISTIK berbasis seed (mis. email),
 * agar hasilnya stabil bila proses auto-complete diulang untuk peserta sama.
 */
export function pickRandomCategory(seed: string): BeasiswaCategory {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return BEASISWA_CATEGORIES[h % BEASISWA_CATEGORIES.length];
}
