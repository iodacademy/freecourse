/**
 * format-helpers.ts — pure formatting utilities (client-safe).
 * Tidak mengandung server-side imports (firebase-admin) supaya aman
 * di-import dari komponen client.
 */

/** Format angka pakai locale id-ID (thousands `.`) */
export function fmtIntID(n: number): string {
  return Math.round(n).toLocaleString("id-ID");
}

/** Format decimal id-ID (e.g. 4.85 → "4,9") */
export function fmtDecID(n: number, digits = 1): string {
  return Number(n).toFixed(digits).replace(".", ",");
}

/** Hitung persentase, return 0 kalau target ≤ 0 */
export function pctOf(n: number, target: number): number {
  return target > 0 ? Math.round((n / target) * 100) : 0;
}
