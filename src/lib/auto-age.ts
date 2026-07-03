/**
 * Auto-koreksi usia untuk lead dari Facebook Instant Form.
 *
 * Konteks: banyak lead salah input tahun lahir sehingga usianya tampak tua
 * (>29). Program menargetkan peserta muda, jadi tahun lahir diacak agar usia
 * jadi <29 dengan aturan:
 *   - Usia > 60 tahun  → SELALU diacak jadi muda.
 *   - Usia 30–60 tahun → 50% diacak (setengahnya dibiarkan apa adanya).
 *   - Usia <= 29       → tidak disentuh.
 *
 * Prinsip:
 *   - HANYA tahun yang diganti; tanggal & bulan asli dipertahankan.
 *   - Deterministik berbasis email → hasil STABIL walau lead di-sync berulang
 *     (tidak berubah-ubah tiap ingest).
 */

// Rentang tahun lahir target (usia ~20–28 pada 2026).
const YEAR_MIN = 1998;
const YEAR_MAX = 2005;

// Hash string sederhana & stabil (FNV-1a-ish) → unsigned 32-bit.
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

// Umur (perkiraan) dari ISO "YYYY-MM-DD". null bila tak terbaca.
export function ageFromIso(iso: string, now = new Date()): number | null {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--;
  return age >= 0 && age < 150 ? age : null;
}

/**
 * Terapkan aturan auto-usia pada tanggal lahir ISO ("YYYY-MM-DD").
 * Mengembalikan tanggal lahir baru (ISO) bila diubah, atau nilai asli bila tidak.
 *
 * @param isoDob  tanggal lahir ISO "YYYY-MM-DD" (hasil normalizeDob)
 * @param email   dipakai sebagai seed deterministik
 */
export function applyAutoAge(isoDob: string, email: string, now = new Date()): string {
  const m = String(isoDob || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDob; // tak terbaca → biarkan
  const mm = m[2];
  let dd = m[3];

  const age = ageFromIso(isoDob, now);
  if (age == null) return isoDob;
  if (age <= 29) return isoDob; // sudah muda → tidak disentuh

  const seed = hashStr((email || "").toLowerCase().trim() || isoDob);

  // Usia 30–60: hanya 50% yang diubah (deterministik: bit paling bawah seed).
  if (age <= 60) {
    const shouldChange = (seed & 1) === 0;
    if (!shouldChange) return isoDob;
  }
  // Usia >60: selalu diubah (tidak ada guard).

  // Pilih tahun target deterministik dari seed.
  const span = YEAR_MAX - YEAR_MIN + 1;
  const year = YEAR_MIN + ((seed >>> 1) % span);

  // Clamp 29 Feb pada tahun non-kabisat.
  if (mm === "02" && dd === "29" && !isLeap(year)) dd = "28";

  return `${year}-${mm}-${dd}`;
}
