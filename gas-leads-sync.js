/**
 * ============================================================
 * GAS Script — Sinkronisasi Leads Meta Instant Form → Firestore
 *               + Kirim Email Ajakan Pelatihan
 * (Bound script / add-on di Google Sheet leads)
 * ============================================================
 *
 * FUNGSI:
 * 1) Membaca baris baru di Google Sheet (data dari Meta Instant Form),
 *    lalu mengirimkannya ke endpoint Next.js:
 *        POST {NEXTJS_URL}/api/public/leads/ingest
 *    Endpoint itu yang menulis ke Firestore collection `leads`.
 * 2) Mengirim email ajakan mengikuti pelatihan Financial Literacy +
 *    klaim bonus, dengan link ke halaman belajar.
 *
 * PENTING SOAL PENGIRIM EMAIL:
 * Email dikirim memakai GmailApp, sehingga email keluar dari AKUN GOOGLE
 * YANG MENJALANKAN & MENG-AUTHORIZE script ini. Agar email keluar dari
 * studentcenter@iodacademy.id, maka:
 *   - Project Apps Script ini HARUS dibuat & dijalankan dari akun
 *     studentcenter@iodacademy.id (lihat panduan SETUP di bawah).
 *   - Akun studentcenter@ harus punya akses (minimal Viewer) ke Google
 *     Sheet leads agar bisa membacanya.
 *
 * ------------------------------------------------------------
 * CARA SETUP (lakukan SEKALI, LOGIN sebagai studentcenter@iodacademy.id):
 *
 * A. PASTIKAN AKSES SHEET
 *    1. Login Google sebagai studentcenter@iodacademy.id.
 *    2. Pastikan akun ini bisa membuka Google Sheet leads (minta rama@
 *       men-share Sheet itu ke studentcenter@ sebagai Editor/Viewer).
 *
 * B. BUAT PROJECT APPS SCRIPT (dari akun studentcenter@):
 *    Pilihan 1 (paling mudah — bound ke Sheet):
 *       - Buka Google Sheet leads → menu Extensions → Apps Script.
 *         (Pastikan saat membuka, kamu sedang login sebagai studentcenter@.
 *          Cek pojok kanan atas Apps Script: foto/email harus studentcenter@.)
 *       - Hapus kode bawaan, PASTE seluruh isi file ini.
 *    Pilihan 2 (standalone):
 *       - Buka script.google.com (login studentcenter@) → New Project →
 *         PASTE isi file ini → set SHEET_ID di Script Properties.
 *
 * C. ISI SCRIPT PROPERTIES (ikon gerigi "Project Settings" → Script Properties):
 *       - NEXTJS_URL  = https://freecourse.iodacademy.id   (TANPA garis miring akhir)
 *       - SYNC_KEY    = (salin dari Admin > Pengaturan Dashboard > Sync Key)
 *       - SHEET_NAME  = (nama tab data leads, mis. "Sheet1")  [opsional]
 *       - SHEET_ID    = (ID Sheet, WAJIB hanya jika pakai Pilihan 2 standalone)
 *
 * D. OTORISASI & UJI:
 *       - Pilih fungsi "testKirimEmail" di atas → Run → saat diminta izin,
 *         LOGIN/SETUJUI sebagai studentcenter@ → cek inbox tujuan uji.
 *       - Lalu pilih "syncNewLeads" → Run sekali untuk uji penuh.
 *
 * E. PASANG TRIGGER (ikon jam "Triggers" → Add Trigger):
 *    Data Meta masuk lewat integrasi resmi (Conversions API for CRM), yang
 *    menulis ke Sheet via Google API — BUKAN ketikan manusia. Karena itu
 *    pasang DUA trigger agar sinkron instan TAPI tetap aman:
 *
 *    Trigger 1 — INSTAN (begitu ada data baru):
 *       - Function: onChangeSync
 *       - Event source: From spreadsheet → On change
 *
 *    Trigger 2 — JARING PENGAMAN (cadangan, menangkap yang terlewat):
 *       - Function: syncNewLeads
 *       - Event source: Time-driven → Minutes timer → Every minute (atau 5 menit)
 *
 *    Catatan: onChange dari Sheet TIDAK SELALU terpicu untuk perubahan dari
 *    API/otomatisasi luar — itu sebabnya Trigger 2 wajib sebagai pengaman.
 *    Kedua trigger aman dijalankan bersamaan karena ada penanda _synced/_emailed
 *    (tidak akan simpan/kirim email dobel).
 *
 * CATATAN KOLOM PENANDA (dibuat otomatis di Sheet, JANGAN dihapus):
 *   - "_synced"  : "OK" jika baris sudah tersimpan ke database.
 *   - "_emailed" : "OK" jika email ajakan sudah dikirim ke baris itu.
 * ============================================================
 */

// ── Ganti link di sini jika halaman belajar berubah ──
var ACCESS_URL = 'https://freecourse.iodacademy.id/financial-literacy';

function getSheet_() {
  var props = PropertiesService.getScriptProperties();
  var sheetName = props.getProperty('SHEET_NAME');
  var sheetId = props.getProperty('SHEET_ID');

  var ss = sheetId
    ? SpreadsheetApp.openById(sheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error('Spreadsheet tidak ditemukan. Untuk project standalone, isi SHEET_ID di Script Properties.');
  }
  var sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];
  if (!sheet) {
    throw new Error('Sheet/tab tidak ditemukan. Cek SHEET_NAME di Script Properties.');
  }
  return sheet;
}

// Pastikan kolom penanda ada; kembalikan index 0-based-nya.
function ensureColumn_(sheet, headers, name) {
  var idx = headers.indexOf(name);
  if (idx === -1) {
    var newCol = headers.length + 1;
    sheet.getRange(1, newCol).setValue(name);
    headers.push(name);
    idx = headers.length - 1;
  }
  return idx;
}

/**
 * Dipanggil oleh trigger "On change" — sinkron INSTAN begitu ada data baru.
 * Hanya melanjutkan untuk perubahan jenis penambahan baris / edit (mengabaikan
 * perubahan format dll), lalu menjalankan proses sync yang sama.
 */
function onChangeSync(e) {
  // e.changeType bisa: EDIT, INSERT_ROW, INSERT_GRID, REMOVE_ROW, dll.
  // Untuk aman, jalankan untuk semua jenis kecuali yang jelas tidak menambah data.
  if (e && e.changeType && (e.changeType === 'REMOVE_ROW' || e.changeType === 'REMOVE_COLUMN' || e.changeType === 'FORMAT')) {
    return;
  }
  syncNewLeads();
}

function syncNewLeads() {
  // Cegah dua proses (onChange + trigger waktu) jalan bersamaan agar tidak dobel.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('Proses sync lain sedang berjalan. Lewati eksekusi ini.');
    return;
  }
  try {
    _runSync();
  } finally {
    lock.releaseLock();
  }
}

function _runSync() {
  var props = PropertiesService.getScriptProperties();
  var baseUrl = props.getProperty('NEXTJS_URL');
  var syncKey = props.getProperty('SYNC_KEY');

  if (!baseUrl || !syncKey) {
    throw new Error('Script Properties belum lengkap (butuh NEXTJS_URL dan SYNC_KEY).');
  }

  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('Tidak ada data (baris kurang dari 2).');
    return;
  }

  // Header (baris 1)
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var syncedIdx = ensureColumn_(sheet, headers, '_synced');
  var emailedIdx = ensureColumn_(sheet, headers, '_emailed');

  var lastCol = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var rowsToSend = [];
  var sendRowNumbers = [];   // baris yang perlu disimpan ke DB
  var emailTargets = [];     // { rowNumber, email, nama } yang perlu dikirimi email

  for (var i = 0; i < data.length; i++) {
    var rowArr = data[i];
    var rowNumber = i + 2; // nomor baris asli di Sheet

    // Susun objek { header: nilai }
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var key = headers[c];
      if (key === '_synced' || key === '_emailed') continue;
      obj[key] = rowArr[c];
    }

    var email = String(obj['Email'] || obj['email'] || '').trim().toLowerCase();
    if (!email) continue; // lewati baris tanpa email

    var nama = String(obj['Nama Lengkap'] || obj['nama_lengkap'] || obj['full_name'] || 'Calon Peserta').trim();

    // 1) Perlu kirim ke DB?
    if (String(rowArr[syncedIdx] || '').trim() !== 'OK') {
      rowsToSend.push(obj);
      sendRowNumbers.push(rowNumber);
    }

    // 2) Perlu kirim email? (belum ditandai _emailed)
    if (String(rowArr[emailedIdx] || '').trim() !== 'OK') {
      emailTargets.push({ rowNumber: rowNumber, email: email, nama: nama });
    }
  }

  // ── Kirim ke DB (batch) ──
  if (rowsToSend.length > 0) {
    var url = baseUrl.replace(/\/$/, '') + '/api/public/leads/ingest';
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-Sync-Key': syncKey },
      payload: JSON.stringify({ rows: rowsToSend }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    Logger.log('Ingest status: ' + code + ' | ' + res.getContentText());
    if (code !== 200) {
      throw new Error('Ingest gagal (HTTP ' + code + '): ' + res.getContentText());
    }
    // Tandai _synced = OK
    for (var s = 0; s < sendRowNumbers.length; s++) {
      sheet.getRange(sendRowNumbers[s], syncedIdx + 1).setValue('OK');
    }
    Logger.log('Tersimpan ke DB: ' + rowsToSend.length + ' baris.');
  } else {
    Logger.log('Tidak ada baris baru untuk DB.');
  }

  // ── Kirim email ajakan (satu per satu) ──
  var emailedCount = 0;
  for (var e = 0; e < emailTargets.length; e++) {
    var t = emailTargets[e];
    try {
      kirimEmailAjakan_(t.email, t.nama);
      sheet.getRange(t.rowNumber, emailedIdx + 1).setValue('OK');
      emailedCount++;
    } catch (mailErr) {
      Logger.log('Gagal kirim email ke ' + t.email + ': ' + mailErr);
      // Tidak menandai OK supaya dicoba lagi pada eksekusi berikutnya.
    }
  }
  Logger.log('Email ajakan terkirim: ' + emailedCount + ' dari ' + emailTargets.length);
}

// ── Kirim 1 email ajakan via GmailApp (pengirim = akun yang authorize script) ──
function kirimEmailAjakan_(toEmail, nama) {
  var subject = 'Akses Pelatihan Financial Literacy & Klaim Bonus Kamu!';
  var htmlBody = buildEmailHtml_(nama);
  GmailApp.sendEmail(toEmail, subject, '', {
    htmlBody: htmlBody,
    name: 'IODA Academy'   // nama tampilan pengirim
  });
}

// ── Template HTML email ajakan ──
function buildEmailHtml_(nama) {
  var safeNama = nama || 'Calon Peserta';
  return ''
    + '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0"></head>'
    + '<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">'
    + '<div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">'
    +   '<div style="background:#CC0000;padding:32px 40px;text-align:center;">'
    +     '<div style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">IODA ACADEMY &times; PLAN INDONESIA</div>'
    +     '<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:800;">Pelatihan Financial Literacy Kamu Siap!</h1>'
    +   '</div>'
    +   '<div style="padding:40px;">'
    +     '<p style="color:#333;font-size:16px;margin:0 0 20px;">Halo <strong>' + safeNama + '</strong>,</p>'
    +     '<p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 28px;">'
    +       'Terima kasih sudah mendaftar! Kamu kini berhak mengakses pelatihan '
    +       '<strong>Financial Literacy</strong> dari IODA Academy secara <strong>gratis</strong>, '
    +       'lengkap dengan <strong>sertifikat</strong> dan <strong>bonus kelas tambahan</strong>. '
    +       'Yuk mulai belajar sekarang!'
    +     '</p>'
    +     '<div style="margin-bottom:32px;">'
    +       '<div style="font-size:14px;font-weight:700;color:#333;margin-bottom:12px;">Cara Mengakses Pelatihan:</div>'
    +       '<table style="width:100%;">'
    +         '<tr><td style="padding:6px 0;vertical-align:top;width:24px;"><div style="background:#CC0000;color:#fff;border-radius:50%;width:20px;height:20px;text-align:center;font-size:11px;font-weight:700;line-height:20px;">1</div></td>'
    +         '<td style="padding:6px 0 6px 10px;font-size:14px;color:#555;">Klik tombol di bawah untuk membuka halaman pelatihan.</td></tr>'
    +         '<tr><td style="padding:6px 0;vertical-align:top;"><div style="background:#CC0000;color:#fff;border-radius:50%;width:20px;height:20px;text-align:center;font-size:11px;font-weight:700;line-height:20px;">2</div></td>'
    +         '<td style="padding:6px 0 6px 10px;font-size:14px;color:#555;">Cari data kamu dengan mengetik <strong>email</strong> atau <strong>nama</strong> yang kamu pakai saat mendaftar, lalu klik "Ini Saya".</td></tr>'
    +         '<tr><td style="padding:6px 0;vertical-align:top;"><div style="background:#CC0000;color:#fff;border-radius:50%;width:20px;height:20px;text-align:center;font-size:11px;font-weight:700;line-height:20px;">3</div></td>'
    +         '<td style="padding:6px 0 6px 10px;font-size:14px;color:#555;">Tonton video, kerjakan kuis &amp; survei singkat, lalu klaim <strong>sertifikat</strong> dan <strong>bonus kelas</strong> kamu.</td></tr>'
    +       '</table>'
    +     '</div>'
    +     '<a href="' + ACCESS_URL + '" style="display:block;background:#CC0000;color:#ffffff;text-decoration:none;padding:16px 24px;border-radius:8px;font-weight:700;font-size:15px;text-align:center;margin-bottom:16px;">Mulai Pelatihan Financial Literacy &rarr;</a>'
    +     '<p style="color:#888;font-size:12px;line-height:1.6;margin:0 0 24px;text-align:center;">Jika tombol tidak berfungsi, salin dan tempel link berikut di browser:<br>'
    +       '<a href="' + ACCESS_URL + '" style="color:#CC0000;word-break:break-all;">' + ACCESS_URL + '</a></p>'
    +     '<p style="color:#888;font-size:13px;line-height:1.6;margin:0;border-top:1px solid #eee;padding-top:24px;">'
    +       'Catatan: jika baru saja mendaftar dan datamu belum muncul, tunggu beberapa saat lalu coba lagi. '
    +       'Jika ada pertanyaan, balas email ini atau hubungi admin kami.</p>'
    +   '</div>'
    +   '<div style="background:#222;padding:24px 40px;text-align:center;">'
    +     '<div style="color:#ffffff;font-weight:700;font-size:14px;margin-bottom:4px;">IODA Academy</div>'
    +     '<div style="color:#aaa;font-size:12px;">Program Literasi Finansial &middot; Plan Indonesia &times; DBS Foundation</div>'
    +   '</div>'
    + '</div></body></html>';
}

/**
 * Uji koneksi penyimpanan DB (kirim 1 baris dummy ke endpoint ingest).
 */
function testIngestDummy() {
  var props = PropertiesService.getScriptProperties();
  var baseUrl = props.getProperty('NEXTJS_URL');
  var syncKey = props.getProperty('SYNC_KEY');

  var dummy = {
    rows: [{
      'id': 'TEST-001',
      'created_time': new Date().toISOString(),
      'campaign_name': 'Tes Kampanye',
      'form persetujuan': 'Ya',
      'status disabilitas': 'Tidak',
      'kategori disabilitas': '',
      'Domisili': 'Jakarta Selatan',
      'Minat Pelatihan': 'Desain Grafis',
      'Nama Lengkap': 'Peserta Uji Coba',
      'Email': 'rohmatramadhan07@gmail.com',
      'phone_number': '81234567890',
      'gender': 'male',
      'date_of_birth': '01/15/2000',
      'lead_status': 'complete'
    }]
  };

  var url = baseUrl.replace(/\/$/, '') + '/api/public/leads/ingest';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Sync-Key': syncKey },
    payload: JSON.stringify(dummy),
    muteHttpExceptions: true
  });
  Logger.log('Status: ' + res.getResponseCode() + ' | Response: ' + res.getContentText());
}

/**
 * Uji kirim email — ganti alamat tujuan ke email kamu sendiri dulu untuk cek tampilan.
 * Saat Run pertama kali, setujui izin sebagai studentcenter@iodacademy.id.
 */
function testKirimEmail() {
  kirimEmailAjakan_('studentcenter@iodacademy.id', 'Peserta Uji');
  Logger.log('Email uji terkirim. Cek inbox tujuan.');
}
