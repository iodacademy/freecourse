# Action Plan Deploy Public Clean + Internal Admin

Dokumen ini dipakai untuk memindahkan aplikasi Freecourse menjadi dua versi:

- Public URL utama: versi bersih untuk peserta, pihak luar, dan Admin.
- Internal admin URL: versi lengkap untuk operasional internal.

Status saat dokumen ini dibuat:

- Branch aktif lokal: `public-clean`
- Branch internal sudah dibuat: `internal-admin`
- Branch deploy lama Hostinger: kemungkinan `main`
- Domain utama tetap: `https://freecourse.iodacademy.id`

Prinsip penting:

- Jangan deploy branch `public-clean` ke domain utama sebelum internal admin URL siap dipakai.
- Jangan isi secret maintenance/admin/cron/sync di deploy public.
- Semua automation, cron, GAS, dan webhook private harus pindah ke URL internal.
- `/admin` di public hanya berisi dashboard agregat, bukan admin maintenance.

## 1. Struktur Akhir Yang Diinginkan

```txt
GitHub repo: freecourse

branch main
  -> deploy Hostinger domain utama
  -> isi kode public clean + Admin
  -> URL: https://freecourse.iodacademy.id

branch internal-admin
  -> deploy Hostinger app/subdomain baru
  -> isi kode lengkap admin lama
  -> URL contoh: https://internal-freecourse.iodacademy.id
```

Catatan:

- `public-clean` adalah branch kerja lokal untuk menyiapkan versi bersih.
- Setelah sudah yakin, isi `public-clean` akan digabung ke `main`.
- `internal-admin` jangan digabung ke `main`.

## 2. Urutan Action Yang Harus Dilakukan Sekarang

### Tahap A - Kunci snapshot internal dulu

Tujuannya supaya kode admin lengkap tidak hilang saat `main` dibuat clean.

Yang bisa dibantu AI:

- Cek branch lokal.
- Commit branch `public-clean`.
- Push branch `internal-admin`.
- Push branch `public-clean`.

Yang kamu lakukan sendiri:

- Pastikan GitHub repo yang dipakai benar.
- Approve login GitHub jika diminta.

Command:

```bash
git checkout internal-admin
git push origin internal-admin
```

Kalau belum pernah commit perubahan public clean:

```bash
git checkout public-clean
git add -A
git commit -m "Create public clean deployment"
git push origin public-clean
```

### Tahap B - Buat deploy internal di Hostinger

Tujuannya supaya admin tetap bisa dipakai setelah domain utama berubah clean.

Yang kamu lakukan sendiri di Hostinger:

1. Buka panel Hostinger.
2. Buat website/app/subdomain baru.
3. Hubungkan ke GitHub repo yang sama.
4. Pilih branch deploy: `internal-admin`.
5. Set domain/subdomain internal, contoh:
   - `internal-freecourse.iodacademy.id`
   - `admin-freecourse.iodacademy.id`
   - nama lain yang tidak terlalu mudah ditebak
6. Isi environment variables internal secara lengkap.
7. Deploy.
8. Test login admin dan fitur maintenance.

Yang bisa dibantu AI:

- Bikin checklist env internal.
- Bantu baca error build/deploy dari Hostinger.
- Bantu cek apakah route internal masih ada dari hasil build log.

### Tahap C - Ganti domain utama menjadi public clean

Ini dilakukan setelah internal URL sudah aman.

Yang bisa dibantu AI:

- Merge `public-clean` ke `main`.
- Push `main`.
- Jalankan build dan scan ulang.

Yang kamu lakukan sendiri:

- Pantau Hostinger auto deploy domain utama.
- Test URL utama dari browser.

Command:

```bash
git checkout main
git merge public-clean
git push origin main
```

Setelah push `main`, Hostinger domain utama akan otomatis deploy versi clean.

### Tahap D - Pindahkan cron, GAS, webhook ke internal URL

Semua automation yang dulu mengarah ke domain utama harus diarahkan ke internal.

Ganti pola lama:

```txt
https://freecourse.iodacademy.id/api/cron/...
https://freecourse.iodacademy.id/api/sync/...
https://freecourse.iodacademy.id/api/admin/...
```

Menjadi:

```txt
https://internal-freecourse.iodacademy.id/api/cron/...
https://internal-freecourse.iodacademy.id/api/sync/...
https://internal-freecourse.iodacademy.id/api/admin/...
```

Yang kamu lakukan sendiri:

- Buka Google Apps Script.
- Buka trigger/Script Properties.
- Update URL base dari domain utama ke domain internal.
- Update Hostinger env internal jika ada URL callback.
- Test satu automation kecil dulu.

Yang bisa dibantu AI:

- Baca isi script GAS kalau kamu paste atau upload.
- Tunjukkan string URL mana yang harus diganti.
- Bikin versi script yang sudah pakai URL internal.

## 3. Template Environment Variables

Jangan copy nilai rahasia ke chat publik. Simpan nilainya di Hostinger env.

### 3.1 Public deploy env untuk branch `main`

Public deploy hanya perlu env yang membuat flow peserta berjalan.

Template:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

NEXT_PUBLIC_APP_URL=https://freecourse.iodacademy.id
NEXT_PUBLIC_APP_NAME=Free Course IODA Academy

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=

GAS_EMAIL_WEBHOOK_URL=

SC_FIREBASE_PROJECT_ID=
SC_FIREBASE_CLIENT_EMAIL=
SC_FIREBASE_PRIVATE_KEY=
```

Catatan public:

- `FIREBASE_*` server-side masih dibutuhkan karena API peserta membaca/menulis Firestore lewat server.
- `GAS_EMAIL_WEBHOOK_URL` masih dibutuhkan jika public flow mengirim email atau generate sertifikat via GAS.
- `SC_FIREBASE_*` masih dibutuhkan jika benefit/redeem peserta harus sync ke Student Center.
- Jangan isi env khusus admin maintenance, sync key, cron key, atau automation private di public deploy.

### 3.2 Internal deploy env untuk branch `internal-admin`

Internal deploy boleh punya env lengkap untuk operasional.

Template:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

NEXT_PUBLIC_APP_URL=https://internal-freecourse.iodacademy.id
NEXT_PUBLIC_APP_NAME=Free Course IODA Academy Internal

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=

GAS_EMAIL_WEBHOOK_URL=

SC_FIREBASE_PROJECT_ID=
SC_FIREBASE_CLIENT_EMAIL=
SC_FIREBASE_PRIVATE_KEY=
```

Tambahkan env lain yang memang masih dipakai branch `internal-admin` jika ada di kode lama, misalnya:

```env
CRON_SECRET=
SYNC_KEY=
ADMIN_KEY=
```

Catatan:

- Nama env tambahan harus mengikuti kode di branch `internal-admin`.
- Kalau ragu, minta AI scan `process.env` di branch `internal-admin`.

## 4. Template Yang Harus Diganti

### 4.1 GitHub/Hostinger branch setting

Public app:

```txt
Repository: freecourse
Branch: main
Domain: freecourse.iodacademy.id
```

Internal app:

```txt
Repository: freecourse
Branch: internal-admin
Domain: internal-freecourse.iodacademy.id
```

### 4.2 Firebase Authentication authorized domains

Tambahkan domain internal di Firebase Console jika admin login pakai Firebase Auth.

Template domain:

```txt
freecourse.iodacademy.id
internal-freecourse.iodacademy.id
```

### 4.3 Google Apps Script properties

Cari property seperti ini:

```txt
NEXTJS_URL=https://freecourse.iodacademy.id
BASE_URL=https://freecourse.iodacademy.id
API_BASE=https://freecourse.iodacademy.id
```

Ganti untuk script internal:

```txt
NEXTJS_URL=https://internal-freecourse.iodacademy.id
BASE_URL=https://internal-freecourse.iodacademy.id
API_BASE=https://internal-freecourse.iodacademy.id
```

### 4.4 Cron URL

Jika ada cron di Hostinger, external cron, Google Apps Script, atau service lain, pindahkan ke internal.

Template lama:

```txt
https://freecourse.iodacademy.id/api/cron/auto-complete
https://freecourse.iodacademy.id/api/cron/rebuild-students-index
https://freecourse.iodacademy.id/api/cron/generate-pending-pdf
```

Template baru:

```txt
https://internal-freecourse.iodacademy.id/api/cron/auto-complete
https://internal-freecourse.iodacademy.id/api/cron/rebuild-students-index
https://internal-freecourse.iodacademy.id/api/cron/generate-pending-pdf
```

### 4.5 Meta/lead sync URL

Jika masih dipakai di internal, ganti base URL ke internal.

Template lama:

```txt
https://freecourse.iodacademy.id/api/public/leads/ingest
```

Template baru:

```txt
https://internal-freecourse.iodacademy.id/api/public/leads/ingest
```

Catatan:

- Endpoint ini sudah tidak ada di public-clean.
- Kalau masih dibutuhkan, endpoint tersebut harus hidup di branch `internal-admin`.

## 5. Checklist Test Public URL

Test setelah `main` deploy ke domain utama:

```txt
[ ] Buka https://freecourse.iodacademy.id
[ ] Landing tampil normal
[ ] /beasiswa/[eventId] tampil normal
[ ] /workshop/[eventId] tampil normal
[ ] /partner/[partnerCode] tampil normal
[ ] Login peserta jalan
[ ] Profile form jalan
[ ] Learn/course jalan
[ ] Quiz/survey jalan
[ ] Claim/redeem certificate jalan
[ ] Verify certificate jalan
[ ] Dashboard public hanya agregat, tidak ada export data siswa
```

Test route private harus gagal:

```txt
[ ] /admin -> login Admin, bukan admin maintenance
[ ] /admin/students -> 404
[ ] /admin/students/fix-names -> 404
[ ] /admin/students/fix-ages -> 404
[ ] /api/admin/students/list -> 404/blocked
[ ] /api/cron/auto-complete -> 404
[ ] /api/sync/sheet-data -> 404
[ ] /api/public/leads/ingest -> 404
[ ] /api/public/dashboard/export-excel -> 404
```

## 6. Checklist Test Internal URL

Test setelah branch `internal-admin` deploy:

```txt
[ ] Buka internal URL
[ ] Login admin jalan
[ ] /admin bisa dibuka
[ ] /admin/students bisa dibuka
[ ] Fix names jalan
[ ] Fix ages jalan
[ ] Import/purge hanya untuk user internal
[ ] Dashboard admin jalan
[ ] Export internal jalan jika masih dibutuhkan
[ ] Cron internal jalan
[ ] GAS/webhook internal jalan
[ ] Generate certificate jalan
```

## 7. Proteksi Internal URL

Internal URL jangan hanya mengandalkan nama subdomain yang sulit ditebak.

Minimal pilih salah satu:

```txt
[ ] Hostinger password protection
[ ] Cloudflare Access
[ ] IP allowlist
[ ] Basic auth di reverse proxy
[ ] VPN/internal network
```

Rekomendasi praktis:

1. Paling cepat: aktifkan password protection di Hostinger kalau tersedia.
2. Lebih aman: pakai Cloudflare Access dengan email allowlist internal.
3. Untuk vendor luar: jangan berikan internal URL.

## 8. Mana Yang Bisa Dibantu AI

AI bisa membantu:

```txt
[ ] Commit perubahan public-clean
[ ] Push branch public-clean dan internal-admin
[ ] Merge public-clean ke main
[ ] Scan source untuk string sensitif
[ ] Scan build output .next
[ ] Membaca error build/deploy Hostinger
[ ] Membuat template env dari process.env di kode
[ ] Membantu edit Google Apps Script jika script diberikan
[ ] Membuat checklist QA public/internal
[ ] Membantu rollback via git jika deploy public bermasalah
```

AI tidak bisa melakukan sendiri tanpa akses/approval kamu:

```txt
[ ] Login Hostinger
[ ] Klik setting deployment branch di Hostinger
[ ] Isi secret environment variables asli
[ ] Login Firebase Console
[ ] Tambah authorized domain di Firebase
[ ] Login Google Apps Script
[ ] Mengubah DNS/subdomain
[ ] Mengaktifkan Cloudflare Access/password protection
```

## 9. Prompt Template Untuk Pakai AI

### 9.1 Minta AI push branch internal

```txt
Tolong push branch internal-admin ke GitHub. Jangan merge ke main. Setelah push, tampilkan remote branch yang berhasil dibuat.
```

### 9.2 Minta AI commit public clean

```txt
Tolong cek status repo, commit perubahan public-clean dengan message "Create public clean deployment", lalu push branch public-clean. Jangan push main dulu.
```

### 9.3 Minta AI merge ke main setelah internal siap

```txt
Internal admin URL sudah siap. Tolong merge public-clean ke main, jalankan build dan scan string sensitif dulu, lalu push main kalau semua lulus.
```

### 9.4 Minta AI scan env yang dibutuhkan

```txt
Tolong scan semua process.env di branch ini dan buat daftar env yang harus diisi untuk Hostinger public dan internal. Jangan tampilkan nilai secret, hanya nama variabel dan kegunaannya.
```

### 9.5 Minta AI bantu update GAS

```txt
Ini isi Google Apps Script saya. Tolong cari semua URL freecourse.iodacademy.id dan ganti yang berkaitan dengan cron/admin/sync ke internal-freecourse.iodacademy.id. Jangan ubah flow peserta public.
```

### 9.6 Minta AI diagnosis deploy error

```txt
Ini log deploy Hostinger. Tolong diagnosis errornya, sebutkan file penyebab, dan berikan patch yang aman. Jangan ubah fitur public yang sudah jalan.
```

## 10. Rencana Rollback

Kalau domain utama bermasalah setelah deploy public clean:

1. Jangan panik, jangan hapus deploy internal.
2. Rollback Hostinger ke deployment sebelumnya jika panel menyediakan.
3. Atau restore `main` ke commit sebelum merge public-clean.
4. Setelah rollback, test domain utama lagi.

Command rollback hanya dilakukan setelah kamu yakin commit targetnya benar:

```bash
git checkout main
git log --oneline
```

Setelah tahu commit lama yang aman, minta AI bantu rollback dengan menyebut commit hash.

## 11. Urutan Paling Aman

Checklist final:

```txt
[ ] Push branch internal-admin ke GitHub
[ ] Buat deploy internal dari branch internal-admin
[ ] Isi env lengkap di deploy internal
[ ] Test admin internal
[ ] Update GAS/cron/webhook ke internal URL
[ ] Commit dan push public-clean
[ ] Merge public-clean ke main
[ ] Push main sehingga domain utama deploy clean
[ ] Test domain utama
[ ] Scan route private di domain utama
[ ] Aktifkan proteksi internal URL
```

Urutan ini menghindari kondisi admin hilang sebelum URL internal siap.

## 12. Pre-Push Checklist Untuk Public Main

Jawaban pendek: kode `public-clean` sudah aman dari fitur admin/private, tetapi jangan push ke `main` sebelum checklist operasional ini siap. Kalau env/settings di bawah kurang, siswa bisa tetap masuk tetapi proses belajar, klaim sertifikat, email, atau redeem benefit bisa tidak mulus.

### 12.1 Wajib ada di Hostinger public env

Public deploy tetap butuh server credentials karena API peserta membaca dan menulis Firestore dari backend.

```txt
[ ] NEXT_PUBLIC_FIREBASE_API_KEY
[ ] NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
[ ] NEXT_PUBLIC_FIREBASE_PROJECT_ID
[ ] NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
[ ] NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
[ ] NEXT_PUBLIC_FIREBASE_APP_ID

[ ] FIREBASE_PROJECT_ID
[ ] FIREBASE_CLIENT_EMAIL
[ ] FIREBASE_PRIVATE_KEY
[ ] FIREBASE_STORAGE_BUCKET

[ ] GAS_EMAIL_WEBHOOK_URL
[ ] SC_FIREBASE_PROJECT_ID
[ ] SC_FIREBASE_CLIENT_EMAIL
[ ] SC_FIREBASE_PRIVATE_KEY
```

Catatan:

- `GAS_EMAIL_WEBHOOK_URL` dipakai untuk email benefit, email workshop, upload/review CV, dan beberapa action GAS.
- `SC_FIREBASE_*` dipakai saat peserta memilih benefit VL/WPB/Bootcamp supaya kode redeem juga tercatat di Student Center.
- Jika `SC_FIREBASE_*` bermasalah, kode redeem masih bisa tersimpan di Freecourse, tetapi sync ke Student Center gagal di background. Ini bisa bikin redeem di portal belajar tidak ditemukan.

### 12.2 Wajib ada di Firestore `settings/app`

Flow klaim sertifikat membaca konfigurasi dari dokumen:

```txt
collection: settings
document: app
```

Field penting:

```txt
[ ] mainCourseId
[ ] gasWebAppUrl
[ ] mainCertSlideTemplateId
[ ] mainCertTitle
[ ] workshopCertSlideTemplateId
[ ] publicDashboardEnabled
[ ] publicDashboardToken
```

Catatan:

- `mainCourseId` default-nya `course-main`, tapi sebaiknya tetap dicek.
- `gasWebAppUrl` dan `mainCertSlideTemplateId` wajib untuk generate PDF sertifikat utama.
- Kalau `gasWebAppUrl` kosong, klaim bisa menandai enrollment sebagai certified, tetapi file PDF bisa tidak langsung jadi.

### 12.2.1 Wajib ada untuk `/admin` publik

Domain utama tetap punya:

```txt
https://freecourse.iodacademy.id/admin
```

Tetapi ini hanya Admin dengan fitur terbatas:

```txt
[ ] Login pakai kode akses admin
[ ] Kode divalidasi ke collection admin
[ ] Dashboard agregat clean
[ ] Tanpa tabel siswa
[ ] Tanpa export Excel
[ ] Tanpa import/purge
[ ] Tanpa fix name/fix age
[ ] Tanpa cron/sync/GAS diagnostics
```

Cara memberi akses:

```txt
collection: admin
document: bebas, misalnya public-dashboard
field: code
value: kode akses yang dipakai login
```

Field opsional:

```txt
role: admin
displayName: Admin IODA
```

Jangan pakai kode yang dibagikan ke pihak luar. Walaupun fiturnya terbatas, kode tetap harus diperlakukan sebagai credential internal.

### 12.3 Wajib ada di Firestore data course

Flow belajar butuh:

```txt
[ ] courses/course-main
[ ] courseSteps dengan courseId = course-main
[ ] step quiz punya assessment + kkm
[ ] step survey punya survey
```

Kalau `courseSteps` kosong, siswa bisa masuk learn tetapi konten belajar/kelulusan tidak valid.

### 12.4 Wajib ada untuk benefit/redeem

Flow pilih benefit membaca collection:

```txt
bonusCourseTopics
```

Minimal untuk tiap benefit aktif:

```txt
[ ] status = active
[ ] name
[ ] category: vl / wpb / bootcamp / workshop / downloadable / review_cv
[ ] classCode untuk vl, wpb, bootcamp
[ ] Kode_Basis untuk wpb/bootcamp jika dibutuhkan portal
[ ] portalUrl jika bukan default
[ ] groupLink atau workshopData.waGroupLink untuk workshop/WPB/Bootcamp
[ ] downloadUrl untuk downloadable
```

Catatan:

- Endpoint public-clean hanya mengembalikan topic `status = active`.
- Topic nonaktif tidak akan tampil ke peserta.

### 12.5 Wajib test sebelum push `main`

Lakukan test di local atau preview deploy:

```txt
[ ] Login peserta test
[ ] Isi profile sampai lengkap
[ ] Auto-enroll ke course-main
[ ] Buka /learn
[ ] Selesaikan quiz dan survey
[ ] Claim certificate
[ ] Pastikan certificateDriveUrl terisi
[ ] Pilih benefit VL/WPB/Bootcamp
[ ] Pastikan redeem code muncul di UI
[ ] Cek dokumen enrollment punya bonusCourseRedeemCode
[ ] Cek Student Center punya dokumen users_vl/users_wpb/users_bootcamp
[ ] Cek email benefit masuk
```

### 12.6 Keputusan push

```txt
Push public ke main sekarang aman kalau:
[ ] internal-admin sudah dipush atau minimal aman di branch lokal
[ ] public env sudah lengkap
[ ] settings/app sudah lengkap
[ ] course-main dan courseSteps tersedia
[ ] bonusCourseTopics aktif tersedia
[ ] test claim certificate sukses
[ ] test redeem benefit sukses
```

Kalau belum sempat test sertifikat dan redeem, jangan push ke `main` dulu. Push `public-clean` ke branch GitHub terpisah dulu, lalu deploy preview/staging dari branch itu.
