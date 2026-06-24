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

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // +07:00
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Acak timestamp di dalam rentang [startMs, endMs], TAPI jam dibatasi
 * 10:00–20:00 WIB (jam kerja, tidak ada yang malam/dini hari).
 *
 * Cara: pilih HARI acak dalam rentang (berbasis hari WIB), lalu pilih detik
 * acak antara 10:00:00 dan 20:00:00 WIB pada hari itu.
 *
 * @param startMs awal rentang (epoch ms)
 * @param endMs   akhir rentang (epoch ms)
 * @param startHour jam mulai (default 10)
 * @param endHour   jam akhir (default 20)
 */
export function randomTimestampDaytime(
  startMs: number,
  endMs: number,
  startHour = 10,
  endHour = 20
): number {
  if (endMs <= startMs) endMs = startMs + DAY_MS;

  // Tentukan indeks hari (berbasis tengah malam WIB) untuk batas rentang.
  const startDayIdx = Math.floor((startMs + WIB_OFFSET_MS) / DAY_MS);
  const endDayIdx = Math.floor((endMs + WIB_OFFSET_MS) / DAY_MS);
  const totalDays = endDayIdx - startDayIdx; // 0 = rentang dalam 1 hari

  // Pilih hari acak (inklusif kedua ujung).
  const dayIdx = startDayIdx + Math.floor(Math.random() * (totalDays + 1));

  // Tengah malam WIB hari terpilih, dinyatakan dalam epoch-ms UTC.
  const midnightWibUtcMs = dayIdx * DAY_MS - WIB_OFFSET_MS;

  // Detik acak dalam jendela jam kerja [startHour, endHour).
  const windowSeconds = (endHour - startHour) * 3600;
  const offsetSeconds = startHour * 3600 + Math.floor(Math.random() * windowSeconds);

  let ts = midnightWibUtcMs + offsetSeconds * 1000;

  // Jaga agar tetap di dalam rentang asli (kalau ujung rentang memotong jam).
  if (ts < startMs) ts = startMs;
  if (ts > endMs) ts = endMs;
  return ts;
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
