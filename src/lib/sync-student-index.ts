/**
 * DINONAKTIFKAN. `studentsIndex` sudah tidak dibaca lagi untuk menampilkan data
 * (tabel /admin/students membaca langsung users + enrollments via cache snapshot).
 * Dulu fungsi ini menulis/menghapus dokumen index tiap ada mutasi siswa, tapi
 * karena index tak dipakai, itu hanya biaya write yang sia-sia.
 *
 * Fungsi dibuat NO-OP agar pemanggil di write path tidak perlu diubah dan tetap
 * aman. `invalidateDashboardCache()` yang biasa dipanggil bersamaan TETAP berjalan
 * (modul terpisah), jadi cache snapshot tetap ter-refresh.
 */
export function syncStudentIndex(_uid?: string | null): void {
  // no-op (lihat catatan di atas)
}

export function syncStudentIndexByEmail(_email?: string | null): void {
  // no-op (lihat catatan di atas)
}

export function removeStudentIndex(_uid?: string | null): void {
  // no-op (lihat catatan di atas)
}
