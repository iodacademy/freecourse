/**
 * Helper: hasilkan timestamp ACAK di dalam rentang [startMs, endMs].
 *
 * Dipakai saat import peserta supaya "Tanggal Daftar" tidak seragam — acak
 * sampai ke jam, menit, dan detik (Math.random() memberi pecahan milidetik).
 */

/** Acak satu nilai epoch-ms di antara dua batas (inklusif kira-kira). */
export function randomMillisBetween(startMs: number, endMs: number): number {
  if (endMs <= startMs) return startMs;
  return Math.floor(startMs + Math.random() * (endMs - startMs));
}

/**
 * Parse string tanggal dari form import menjadi epoch-ms.
 * Menerima "YYYY-MM-DD" (dianggap mulai 00:00 WIB) atau ISO penuh.
 * Mengembalikan null bila tidak valid.
 */
export function parseDateInput(input: string, endOfDay = false): number | null {
  if (!input) return null;
  const v = input.trim();
  // Hanya tanggal (YYYY-MM-DD) → set jam ke awal/akhir hari di zona WIB (+07:00).
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const time = endOfDay ? "23:59:59" : "00:00:00";
    const d = new Date(`${v}T${time}+07:00`);
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.getTime();
}
