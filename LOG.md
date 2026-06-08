# Log Aktivitas Pengembangan (Version Control)

## [VERSI 009] - 08 Juni 2026
**Deskripsi Perubahan:**
Mengimplementasikan validasi umur peserta di formulir profil untuk memastikan yang bisa mendaftar hanya yang berusia antara 18 hingga 29 tahun. Selain itu, mengubah logika Ekspor Excel di Dashboard agar data yang diunduh bersih (hanya memuat peserta wilayah Jabodetabek dan usia maksimal 29 tahun).

**Ringkasan Kode yang Diubah:**
1. **`src/lib/dashboard-aggregator.ts`**: Menambahkan flag opsional `cleanExport` yang bertugas menyaring (*filter*) deretan (*array*) peserta. Logika filter akan mengeliminasi peserta berstatus umur `>29` dan mengecek apakah kota peserta mengandung kata "jakarta", "bogor", "depok", "tangerang", atau "bekasi".
2. **`src/app/api/admin/dashboard/export-excel/route.ts` & `src/app/api/public/dashboard/export-excel/route.ts`**: Menyelipkan opsi `{ cleanExport: true }` ke fungsi `aggregateDashboard` yang dipanggil khusus saat _endpoint_ ini bekerja (tombol Unduh).
3. **`src/app/(student)/profile/page.tsx`**: Melengkapi aturan validasi di formulir yang mengecek input field `tanggal_lahir`. Algoritma kalkulasi umur akan dijalankan dari tanggal (*date*) yang diisi; jika jatuh di bawah 18 atau melampaui 29 tahun (termasuk tanggal di masa depan/tahun sangat jauh), notifikasi validasi merah akan mengunci tombol kelanjutan form.

## [VERSI 008] - 08 Juni 2026
**Deskripsi Perubahan:**
Menambahkan fitur Klaim Ulang Sertifikat Utama di Laci Profil (Profile Drawer). Tombol ini akan menghasilkan kembali file PDF sertifikat utama di Google Drive apabila file yang lama terhapus, dengan mempertahankan nomor seri sertifikat dan tanggal aslinya.

**Ringkasan Kode yang Diubah:**
1. **`src/components/ProfileDrawer/ProfileDrawer.tsx`**:
   - Menambahkan *state* `claimingMain` dan `mainClaimError` untuk menangani indikator pemrosesan dan pesan kesalahan.
   - Menambahkan fungsi `handleClaimMainCert` yang memanggil `POST /api/enrollments/[id]/claim-cert` dengan payload `{ reclaim: true }`.
   - Mengubah antarmuka UI di bagian "Sertifikat Financial Literacy" agar memunculkan dua buah tombol berjajar: "Unduh Ulang" dan "Klaim Ulang".

## [VERSI 007] - 04 Juni 2026
**Deskripsi Perubahan:**
Menambahkan metrik atau widget baru di halaman Dashboard untuk melacak jumlah siswa yang **LULUS** vs **GAGAL (Tidak Lulus)** kuis secara real-time.

**Ringkasan Kode yang Diubah:**
1. **`src/lib/dashboard-aggregator.ts`**: Menambahkan perhitungan agregasi `lulusKuis` dan `tidakLulusKuis` berdasarkan status kuis peserta. Menyisipkannya ke dalam tipe data `DashboardStats` yang dikembalikan oleh API. Diperbaiki juga bug dimana peserta dengan nilai di atas KKM 60 terbaca "TIDAK LULUS" karena data lama tidak memiliki field `passed` dari database.
2. **`src/components/dashboard/DashboardView.tsx` & `MetricCard.tsx`**: Menghapus kartu metrik kuis mandiri (yang membuat row jadi 4), lalu menggabungkannya ke dalam kotak `Rerata Nilai Peserta`. Angka kelulusan kini ditampilkan di dalam *highlight box* mungil bernada warna hijau/merah persis di bawah keterangan "Rata-rata nilai akhir pelatihan".
## [VERSI 006] - 04 Juni 2026
**Deskripsi Perubahan:**
Mengubah sistem kuis dari model "harus benar semua" menjadi sistem penilaian berbasis nilai berbobot (Score-Based Quiz) dengan KKM 60. Peserta kini bisa memperbaiki jawaban yang salah langsung tanpa reset semua, dan tombol berubah jadi HIJAU saat lulus.

**Ringkasan Kode yang Diubah:**
1. **`src/lib/types.ts`**: Menambahkan field `points?: number` ke `AssessmentQuestion` (bobot nilai per soal), serta `firstPassScore` dan `totalAttempts` ke `StepProgress.assessmentResult` (untuk menyimpan nilai pertama kali lulus).
2. **`src/app/globals.css`**: Menambahkan class CSS baru `.lms-btn-green` (tombol hijau untuk tombol Isi Survei & Kirim Jawaban setelah lulus kuis).
3. **`src/components/LMSPlayer/LMSPlayer.tsx`**:
   - Menambahkan field `points?: number` ke interface lokal `QuizQuestion`.
   - Menambahkan fungsi `calcWeightedScore()` yang menghitung nilai berbobot berdasarkan poin per soal (jika tidak diset, otomatis bagi rata).
   - Mengubah `qzPassed` dari "semua soal benar" menjadi "nilai ≥ KKM".
   - Mengubah banner hasil kuis: sekarang menampilkan nilai angka + jumlah soal benar.
   - Mengubah tombol footer dari `lms-btn-red` menjadi `lms-btn-green` saat kuis lulus.
   - Mengubah tombol Survey dari merah menjadi hijau.
4. **`src/app/api/enrollments/[id]/progress/route.ts`**: Logika baru penyimpanan nilai kuis — `firstPassScore` hanya disimpan satu kali (pertama kali nilainya ≥ KKM), kuis terkunci setelah lulus (menolak update dengan HTTP 403), dan `attempts` dihitung secara kumulatif.
5. **`src/app/learn/[step]/page.tsx`**: Menyertakan nilai `kkm` saat mengirim `assessmentResult` ke API backend, agar backend bisa memvalidasi apakah peserta lulus atau tidak.
6. **`src/lib/dashboard-aggregator.ts`**:
   - Menambahkan field `statusKuis: "LULUS" | "TIDAK LULUS" | "-"` ke tipe `DashboardStudent`.
   - Logika penentuan status: LULUS jika `firstPassScore` ada atau `passed === true`, TIDAK LULUS jika pernah mengerjakan tapi belum lulus, `-` jika belum pernah kuis.
   - Menambahkan kolom "Status Kuis" di `SHEET_HEADERS` dan `studentToRow()` untuk export Excel.
7. **`src/app/admin/students/page.tsx`**:
   - Menambahkan kolom "Status Kuis" di tabel daftar siswa dengan badge berwarna hijau (✓ LULUS) atau merah (✕ TIDAK LULUS).
   - Menambahkan baris "Status Kuis" di modal detail siswa.
8. **`src/app/admin/courses/page.tsx`**:
   - Menambahkan input **Poin** (angka) di setiap kotak soal kuis di halaman editor kursus admin.
   - Menambahkan banner ringkasan poin: jika poin diisi → hijau "Total poin: XX, sistem berbobot"; jika belum → kuning "Poin belum diisi, sistem bagi rata otomatis".
   - Default poin saat buat soal baru = 0 (bagi rata otomatis).

**Cara Undo (jika ingin kembali ke versi sebelumnya):**
- Kembalikan `qzPassed` di `LMSPlayer.tsx` ke: `quizSubmitted && qzCorrectCount === shuffledQuestions.length`
- Hapus fungsi `calcWeightedScore()` dari `LMSPlayer.tsx`
- Ganti semua `lms-btn-green` kembali ke `lms-btn-red` di `LMSPlayer.tsx`
- Kembalikan logika `assessmentResult` di `progress/route.ts` ke versi sebelumnya
- Hapus field `statusKuis` dari `DashboardStudent` dan `SHEET_HEADERS`

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
