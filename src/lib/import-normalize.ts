/**
 * Perapian (normalisasi) data mentah dari file import sebelum disimpan, agar
 * konsisten dengan peserta asli & terbaca benar oleh dashboard.
 *
 * - Nomor WA  → simpan DIGIT LOKAL tanpa 0/62 di depan (mis. "81234567890").
 *               Dashboard sendiri yang menambah prefiks "+62" saat menampilkan,
 *               jadi format penyimpanannya harus tanpa 62/0 (lihat
 *               dashboard-aggregator: `+62${raw.replace(/^0+/, "")}`).
 * - Tanggal Lahir → seragamkan ke "YYYY-MM-DD". Asumsi format ambigu = DD/MM/YYYY
 *               (Indonesia), tapi pintar: bila angka pertama > 12 → itu hari;
 *               bila angka KEDUA > 12 → angka pertama dianggap bulan (MM/DD).
 *               Tahun 2 digit di-ekspansi (00–25 → 20xx, selebihnya → 19xx).
 */

/** Rapikan nomor telepon: ambil digit, buang 62/0 di depan. "" bila tak ada digit. */
export function normalizePhone(raw: string): string {
  let v = (raw || "").replace(/\D/g, ""); // hanya digit
  if (!v) return "";
  v = v.replace(/^62/, "").replace(/^0+/, "");
  return v;
}

/** Ekspansi tahun 2 digit. <= tahun ini (2 digit) → 20xx, sisanya 19xx. */
function expandYear(yy: string): string {
  if (yy.length === 4) return yy;
  const n = parseInt(yy, 10);
  if (isNaN(n)) return yy;
  // Ambang sederhana: 00–25 → 2000-an, 26–99 → 1900-an.
  return n <= 25 ? `20${String(n).padStart(2, "0")}` : `19${String(n).padStart(2, "0")}`;
}

/**
 * Seragamkan tanggal lahir ke "YYYY-MM-DD". Mengembalikan "" bila tak bisa
 * di-parse (lebih baik kosong daripada salah).
 *
 * Didukung:
 *   2026-05-15 / 2026/05/15         (sudah ISO)
 *   15-05-1999 / 15/05/1999         (DD-MM-YYYY, asumsi default)
 *   15-05-99   / 15/05/99           (DD-MM-YY)
 *   05/15/1999                      (terdeteksi MM/DD karena 15 > 12)
 */
export function normalizeDob(raw: string): string {
  const v = (raw || "").trim();
  if (!v) return "";

  // Sudah ISO (YYYY-MM-DD atau YYYY/MM/DD).
  const iso = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Pola d?d <sep> d?d <sep> yy(yy).
  const m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (!m) return "";

  let a = parseInt(m[1], 10); // kandidat hari (asumsi DD/MM)
  let b = parseInt(m[2], 10); // kandidat bulan
  const year = expandYear(m[3]);

  let day: number, month: number;
  if (a > 12 && b <= 12) {
    // 25/06 → jelas DD/MM
    day = a; month = b;
  } else if (b > 12 && a <= 12) {
    // 06/25 → jelas MM/DD
    month = a; day = b;
  } else {
    // Ambigu (keduanya <= 12) → asumsi DD/MM (Indonesia).
    day = a; month = b;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  const yyyy = year.padStart(4, "0");
  return `${yyyy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Normalkan jenis kelamin ke label yang dipakai komponen ("Laki-laki"/"Perempuan"). */
export function normalizeGender(raw: string): string {
  const v = (raw || "").toLowerCase().trim();
  if (!v) return "";
  if (["male", "laki-laki", "laki laki", "pria", "l", "m"].includes(v)) return "Laki-laki";
  if (["female", "perempuan", "wanita", "p", "f"].includes(v)) return "Perempuan";
  return raw.trim(); // biarkan apa adanya bila tak dikenali
}
