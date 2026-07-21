/**
 * Wrapper non-fatal untuk sinkronisasi studentsIndex dari write path.
 * Kegagalan sync TIDAK boleh menggagalkan request utama (cuma di-log) —
 * drift yang lolos akan ditambal oleh worker internal.
 *
 * Pakai di sebelah invalidateDashboardCache() di tiap titik mutasi.
 */
import {
  upsertStudentIndex,
  upsertStudentIndexByEmail,
  deleteStudentIndex,
} from "./dashboard-aggregator";

export function syncStudentIndex(uid: string | null | undefined): void {
  if (!uid) return;
  upsertStudentIndex(uid).catch((e) =>
    console.error("[studentsIndex] gagal upsert uid:", uid, e)
  );
}

export function syncStudentIndexByEmail(email: string | null | undefined): void {
  if (!email) return;
  upsertStudentIndexByEmail(email).catch((e) =>
    console.error("[studentsIndex] gagal upsert email:", email, e)
  );
}

export function removeStudentIndex(uid: string | null | undefined): void {
  if (!uid) return;
  deleteStudentIndex(uid).catch((e) =>
    console.error("[studentsIndex] gagal hapus uid:", uid, e)
  );
}
