/**
 * Penyusun dokumen riwayat ekspor dashboard publik.
 *
 * Dipisah dari route agar bisa diuji tanpa Firestore, dan agar aturan
 * "riwayat ini tidak menyimpan identitas" hidup di satu tempat: fungsi ini
 * hanya pernah menghasilkan enam kunci, apa pun yang dikirim pemanggil.
 *
 * Builder for public-dashboard export history documents.
 *
 * Kept apart from the route so it can be tested without Firestore, and so the
 * "this history stores no identity" rule lives in one place: this function
 * only ever produces six keys, whatever the caller passes in.
 */

export type ExportMode = "clean" | "raw" | "mismatch";

export interface ExportRecord {
  mode: ExportMode;
  filter: Record<string, unknown>;
  rowCount: number;
  filename: string;
  driveFileId: string;
  storeError: string;
}

const MODES: readonly ExportMode[] = ["clean", "raw", "mismatch"];

/**
 * Menentukan mode ekspor dari query string secara aman.
 * `mode` mengalir sampai ke header Content-Disposition, jadi ia wajib
 * divalidasi di sini, bukan sekadar di-cast — string sembarang (termasuk
 * yang mengandung CRLF) akan membuat `new Response()` melempar error
 * SETELAH berkas terlanjur diunggah ke Drive.
 *
 * Safely determines export mode from the query string.
 * `mode` flows all the way to the Content-Disposition header, so it must be
 * validated here, not merely cast — an arbitrary string (including one
 * containing CRLF) would make `new Response()` throw AFTER the file has
 * already been uploaded to Drive.
 */
export function resolveExportMode(input: { modeParam: string | null; rawParam: boolean }): ExportMode {
  if (input.modeParam && MODES.includes(input.modeParam as ExportMode)) {
    return input.modeParam as ExportMode;
  }
  return input.rawParam ? "raw" : "clean";
}

export function buildExportRecord(input: {
  mode: string;
  filter?: Record<string, unknown> | null;
  rowCount: number;
  filename: string;
  driveFileId?: string;
  storeError?: string;
}): ExportRecord {
  const mode = MODES.includes(input.mode as ExportMode) ? (input.mode as ExportMode) : "clean";
  const n = Number(input.rowCount);
  return {
    mode,
    filter: input.filter && typeof input.filter === "object" && !Array.isArray(input.filter) ? input.filter : {},
    rowCount: Number.isFinite(n) && n > 0 ? Math.floor(n) : 0,
    filename: String(input.filename || ""),
    driveFileId: String(input.driveFileId || ""),
    storeError: String(input.storeError || ""),
  };
}
