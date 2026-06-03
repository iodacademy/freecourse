# Log Aktivitas Pengembangan (Version Control)

## [VERSI 005] - 03 Juni 2026
**Deskripsi Perubahan:**
Membedakan antarmuka *Landing Page* (Halaman Pendaftaran) secara dinamis agar khusus bagi kelas beasiswa berjenis WPB atau Bootcamp dapat menampilkan daftar Topik Pelatihan dan Jadwal yang relevan secara langsung dari pengaturan Admin. Menjadikan Nama Kelas sebagai *slug* URL.

**Ringkasan Kode yang Diubah:**
1. **`src/lib/types.ts`**: Menambahkan properti _array_ `topikList` (yang berisi objek `judul` dan `jadwal`) di dalam interface `beasiswaConfig`.
2. **`src/app/admin/events/page.tsx`**: Menambahkan antarmuka dinamis ("Tambah Topik Pelatihan") yang memungkinkan Admin untuk memasukkan beberapa Topik dan Jadwalnya secara dinamis ketika jenis beasiswanya diset ke WPB atau Bootcamp.
3. **`src/app/api/events/route.ts`**: Memodifikasi logika pembuatan Document ID di Firestore agar menggunakan hasil konversi `namaKelas` sebagai _slug_ URL khusus bagi pendaftaran kelas WPB/Bootcamp (misal `/beasiswa/legal`).
4. **`src/app/beasiswa/[eventId]/page.tsx`**: Mengubah *props* `setEventData` agar ikut membawa objek `beasiswaConfig` dan meneruskannya (passing down) ke dalam komponen `LandingTemplate`.
5. **`src/components/LandingTemplate/LandingTemplate.tsx`**: 
   - Memodifikasi teks *Call-to-Action* dan Subtitle di dalam "Tahap 4" Alur Program spesifik untuk WPB dan Bootcamp.
   - Mengubah bagian render "Topik Pelatihan" yang awalnya menggunakan *chips* statis (Digital Marketing, Legal, dll) menjadi desain UI *Grid/Card* responsif yang membaca secara dinamis dari `beasiswaConfig.topikList` buatan Admin.

## [VERSI 004] - 03 Juni 2026
**Deskripsi Perubahan:**
Menambahkan alur Beasiswa baru berjenis "WPB" dan "Bootcamp". Jalur ini tidak memerlukan peserta memilih topik Video Learning, melainkan langsung menghasilkan (generate) Kode Redeem khusus dan memberikan tautan (link) ke Grup WhatsApp setelah mereka mengklaim sertifikat.

**Ringkasan Kode yang Diubah:**
1. **`src/lib/types.ts`**: Menambahkan skema tipe data `beasiswaConfig` pada interface `Event` dan field `waGroupLink` serta `beasiswaType` pada `Enrollment`.
2. **`src/app/admin/events/page.tsx`**: Memodifikasi form pembuatan Event bertipe B2C Ads/Beasiswa dengan menambahkan dropdown Jenis Beasiswa (VL, WPB, Bootcamp) dan field baru (Kode Basis, Kode Kelas, Link Grup WA).
3. **`src/app/api/events/route.ts` & `src/app/api/events/[id]/route.ts`**: Menyesuaikan payload API POST dan PATCH agar dapat menerima dan menyimpan struktur `beasiswaConfig`.
4. **`src/app/api/enrollments/[id]/claim-cert/route.ts`**: Menyisipkan logika *auto-generate* Kode Redeem berdasarkan nama depan peserta + Kode Kelas. Menyinkronisasikan hasil pendaftaran tersebut langsung ke database `student-center-ioda` (pada koleksi `users_wpb` atau `users_bootcamp`).
5. **`src/app/learn/certificate/page.tsx`**: Mengganti kotak "Pilih Kursus Tambahan" menjadi tampilan *highlight* sukses yang memunculkan Kode Redeem dan tombol ajakan bergabung ke Grup WhatsApp untuk peserta Beasiswa WPB/Bootcamp.
6. **`src/app/learn/[step]/page.tsx`**: Menambahkan *banner* (pop-up statis) di bagian atas modul bagi peserta WPB/Bootcamp yang belum melakukan klaim sertifikat sebagai pengingat (Reminder).

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
