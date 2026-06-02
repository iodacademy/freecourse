# Log Aktivitas Pengembangan (Version Control)

## [VERSI 003] - 02 Juni 2026
**Deskripsi Perubahan:**
Pembaruan fitur "Luluskan Semua (Massal)" untuk mengelompokkan siswa berdasarkan Tanggal Pendaftaran dan menambahkan sistem antrean (Queue) pembuatan PDF dengan jeda pendinginan server (3 detik). 

**Ringkasan Kode yang Diubah:**
1. **`src/app/admin/students/page.tsx`**: Mengubah antarmuka pop-up konfirmasi menjadi format *checkbox* yang dikelompokkan berdasarkan tanggal (`tanggalDaftar`). Menambahkan *Progress Bar* untuk memantau status pemanggilan Google Apps Script secara *looping* dengan jeda waktu (`setTimeout` 3000ms).
2. **`src/app/api/admin/students/bulk-force-complete/route.ts`**: Dimodifikasi agar menerima _payload_ `userIds` berupa *array*. Sistem tidak lagi meluluskan semua siswa secara membabi-buta, melainkan hanya menyasar spesifik pada _ID_ yang diteruskan dari sisi _frontend_.
3. **`src/app/api/admin/students/generate-pdf/route.ts` (BARU)**: API mandiri spesifik untuk memanggil *Webhook* Google Apps Script untuk satu *user* dan memperbarui _field_ `certificateDriveUrl` mereka di dalam Firestore secara *real-time*.

## [VERSI 002] - 02 Juni 2026
**Deskripsi Perubahan:**
Pembuatan fitur "Luluskan Semua (Massal) / Bulk Force Complete" di halaman admin. Fitur ini memungkinkan admin meluluskan secara otomatis seluruh peserta yang belum mendapatkan sertifikat, serta menyuntikkan nilai kuis dan survei bawaan ke dalam *database* agar statistik Dashboard tetap seimbang.

**Ringkasan Kode yang Diubah:**
1. **`src/app/admin/students/page.tsx`**: Menambahkan tombol *Luluskan Semua (Massal)* berwarna merah di samping menu Export ke Excel, serta menyematkan modal pop-up untuk mencegah eksekusi tanpa disengaja.
2. **`src/app/api/admin/students/bulk-force-complete/route.ts` (BARU)**: Merancang *endpoint* API baru yang membaca koleksi `enrollments`, menyaring siswa yang belum `certified`, lalu menerapkan injeksi *hardcode* nilai Kuis (100) dan isian Survei (5) menggunakan fungsi `batch()` Firestore untuk performa tinggi.
3. **`src/app/learn/page.tsx`**: Menambahkan instruksi `router.replace('/learn/certificate')` agar pengguna yang sudah lulus langsung diarahkan ke halaman Sertifikat tanpa harus melewati modul pertama.

## [VERSI 001] - 02 Juni 2026
**Deskripsi Perubahan:**
Perbaikan bug materi yang tidak termuat (Loading Terkendala / Race Condition) saat login menggunakan Google SSO.

**Ringkasan Kode yang Diubah:**
1. **`src/contexts/AuthContext.tsx`**: Menghapus pemanggilan sinkronisasi profil ganda (`fetchOrCreateProfile`) dan menambahkan state `setLoading(true)` saat proses `signInWithPopup` berlangsung. Sinkronisasi diserahkan sepenuhnya ke listener `onAuthStateChanged`.
2. **`src/app/learn/page.tsx`**: Menghapus logika pendaftaran kursus ganda (`auto-enroll`). Halaman ini sekarang murni berfungsi membaca database dan me-redirect.
3. **`src/app/learn/[step]/page.tsx`**: Menghapus logika pendaftaran kursus ganda (`auto-enroll`). Pendaftaran (enroll) secara penuh disentralisasi saat peserta mengirimkan data dirinya di halaman Profil (`src/app/(student)/profile/page.tsx`).

Dengan perubahan ini, proses pendaftaran tidak lagi saling bertabrakan, menghindari gagal muat di awal yang selama ini memaksa peserta untuk me-_refresh_ halaman.
