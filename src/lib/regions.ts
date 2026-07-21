/**
 * regions.ts — Definisi Area program YouRise (satu sumber kebenaran).
 *
 * Dipakai bersama oleh:
 *  - Card Per Area di dashboard publik
 *  - Filter "Data Clean" untuk agregasi
 *  - Penentuan "Data Tidak Sesuai" (komplemen Clean)
 *
 * Kenapa satu file: sebelumnya daftar Jabodetabek ditulis inline di
 * dashboard-aggregator dan tampilan publik. Begitu area bertambah, keduanya
 * gampang lepas sinkron.
 *
 * Pencocokan kota memakai pola KATA UTUH (word boundary), bukan substring
 * mentah, karena data tersimpan bervariasi ("Bogor" vs "Kab. Bogor",
 * "Sidoarjo" vs "Kab. Sidoarjo").
 *
 * Substring mentah TIDAK aman: `"kab. sumedang".includes("medan")` bernilai
 * true, sehingga Sumedang (Jawa Barat) akan terhitung sebagai area Medan.
 * Pola di bawah sudah diuji terhadap seluruh daftar kota di `wilayah.ts`:
 * nol false positive, nol tumpang tindih antar-area.
 */

export type AreaKey = "jabodetabek" | "medan" | "surabaya";

export type AreaDef = {
  key: AreaKey;
  /** Label yang tampil di card dashboard. */
  label: string;
  /** Keterangan singkat cakupan wilayah. */
  desc: string;
  /**
   * Nama kota/kabupaten (lowercase) penanda area ini. Dicocokkan sebagai
   * rangkaian kata utuh di dalam nama kota — lihat `matchesPattern`.
   */
  patterns: string[];
};

export const AREAS: AreaDef[] = [
  {
    key: "jabodetabek",
    label: "Jabodetabek",
    desc: "Jakarta (Selatan/Timur/Pusat/Barat), Bogor, Depok, Tangerang, Bekasi",
    // "tangerang" ikut menangkap "Tangerang Selatan" & "Kab. Tangerang".
    // "jakarta" di-spesifikkan agar "Jakarta Utara" / "Kepulauan Seribu" tidak masuk Data Clean.
    patterns: [
      "bekasi",
      "bogor",
      "jakarta selatan",
      "jakarta timur",
      "jakarta pusat",
      "jakarta barat",
      "depok",
      "tangerang",
    ],
  },
  {
    key: "surabaya",
    label: "Surabaya dan Sidoarjo",
    desc: "Surabaya, Sidoarjo",
    patterns: ["surabaya", "sidoarjo"],
  },
  {
    key: "medan",
    label: "Medan dan Sekitarnya",
    desc: "Medan, Deli Serdang, Binjai, Langkat, Serdang Bedagai",
    // "medan" sebagai kata utuh — jangan sampai menyeret "Kab. Sumedang".
    patterns: ["medan", "deli serdang", "binjai", "langkat", "serdang bedagai"],
  },
];

export const AREA_KEYS: AreaKey[] = AREAS.map((a) => a.key);

const AREA_BY_KEY = new Map<AreaKey, AreaDef>(AREAS.map((a) => [a.key, a]));

export function getArea(key: AreaKey): AreaDef | undefined {
  return AREA_BY_KEY.get(key);
}

export function isAreaKey(v: string): v is AreaKey {
  return AREA_BY_KEY.has(v as AreaKey);
}

/**
 * Ubah nama kota jadi token kata: lowercase, tanda baca ("Kab.", koma, tanda
 * hubung) jadi spasi, spasi ganda dirapikan. "Kab. Deli Serdang" →
 * " kab deli serdang ". Dibungkus spasi supaya pencocokan kata utuh cukup
 * dengan `includes(" pola ")`.
 */
function normalizeCity(kota: string): string {
  const cleaned = kota
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return ` ${cleaned} `;
}

/** Cocok bila `pattern` muncul sebagai rangkaian kata utuh di `normalized`. */
function matchesPattern(normalized: string, pattern: string): boolean {
  return normalized.includes(` ${pattern} `);
}

/**
 * Tentukan area sebuah kota. Mengembalikan `null` bila kota di luar
 * seluruh area program (atau kota kosong).
 *
 * Area pertama yang cocok yang menang. Antar-area tidak ada tumpang tindih
 * pola, jadi urutan tidak berpengaruh pada hasil.
 */
export function areaOfCity(kota: string | null | undefined): AreaKey | null {
  if (!kota) return null;
  const norm = normalizeCity(kota);
  if (norm.trim() === "") return null;
  for (const area of AREAS) {
    if (area.patterns.some((p) => matchesPattern(norm, p))) return area.key;
  }
  return null;
}

// ─── Aturan kelayakan usia ("Data Clean") ──────────────────────────────────
//
// Program menyasar usia 18–29. Penyandang disabilitas diberi kelonggaran
// batas atas sampai 35 tahun (keputusan program, bukan turunan dari data).
// Batas bawah 18 berlaku untuk SEMUA peserta, termasuk disabilitas.

export const MIN_AGE = 18;
export const MAX_AGE_DEFAULT = 29;
export const MAX_AGE_DISABILITAS = 35;

export function maxAgeFor(isDisabilitas: boolean): number {
  return isDisabilitas ? MAX_AGE_DISABILITAS : MAX_AGE_DEFAULT;
}

/** Rentang usia yang berlaku, mis. [18, 35] untuk penyandang disabilitas. */
export function ageRangeFor(isDisabilitas: boolean): [number, number] {
  return [MIN_AGE, maxAgeFor(isDisabilitas)];
}

/**
 * Apakah nilai jawaban field disabilitas berarti "ya"?
 * Menerima variasi yang beredar di data: "Ya" (form), "Penyandang Disabilitas"
 * (import lama). Dipakai bersama oleh dashboard & validasi form pendaftaran.
 */
export function isDisabilitasValue(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return s === "ya" || s === "penyandang disabilitas";
}

/**
 * Usia peserta memenuhi syarat? Rentang 18–29 (18–35 bila disabilitas).
 *
 * `umur` null/NaN (tanggal lahir kosong atau tak terbaca) → dianggap TIDAK
 * memenuhi, supaya baris bermasalah muncul di "Data Tidak Sesuai" dan
 * ketahuan, bukan diam-diam lolos ke Data Clean.
 *
 * Batas bawah wajib dicek: form pendaftaran memang menolak <18, tapi peserta
 * bisa masuk lewat jalur lain (import Excel, edit admin) tanpa validasi itu.
 */
export function isAgeEligible(umur: number | null, isDisabilitas: boolean): boolean {
  if (umur == null || !Number.isFinite(umur)) return false;
  return umur >= MIN_AGE && umur <= maxAgeFor(isDisabilitas);
}
