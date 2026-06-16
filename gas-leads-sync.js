/**
 * ============================================================
 * GAS Script — Sinkronisasi Leads Meta Instant Form → Firestore
 * (Bound script / add-on di Google Sheet leads)
 * ============================================================
 *
 * FUNGSI:
 * Membaca baris baru di Google Sheet (data dari Meta Instant Form),
 * lalu mengirimkannya ke endpoint Next.js:
 *   POST {NEXTJS_URL}/api/public/leads/ingest
 * Endpoint itu yang menulis ke Firestore collection `leads`.
 *
 * ------------------------------------------------------------
 * CARA SETUP (lakukan SEKALI):
 * 1. Buka file Google Sheet leads Anda.
 * 2. Menu atas: Extensions (Ekstensi) → Apps Script.
 * 3. Hapus semua kode bawaan di Code.gs, lalu PASTE seluruh isi file ini.
 * 4. Klik ikon gerigi (Project Settings / Setelan Proyek) di kiri →
 *    scroll ke "Script Properties" → klik "Add script property" dan isi:
 *       - NEXTJS_URL  = https://freecourse.iodacademy.id   (TANPA garis miring di akhir)
 *       - SYNC_KEY    = (salin dari Admin > Pengaturan Dashboard > Sync Key)
 *       - SHEET_NAME  = (nama tab Sheet yang berisi data leads, mis. "Sheet1")
 * 5. Klik ikon jam (Triggers / Pemicu) di kiri → "Add Trigger" dengan pengaturan:
 *       - Choose which function to run: syncNewLeads
 *       - Deployment: Head
 *       - Event source: Time-driven
 *       - Type of time based trigger: Minutes timer → Every 5 minutes
 *    (Trigger berkala ini aman dipakai untuk Sheet yang diisi otomatis oleh Meta.)
 * 6. (Opsional) Untuk uji manual: pilih fungsi "syncNewLeads" di atas lalu klik Run.
 *    Saat pertama kali Run, Google akan minta izin akses → klik Allow.
 *
 * CATATAN PENTING:
 * - Script ini menandai baris yang sudah terkirim dengan menulis "OK" di
 *   kolom paling kanan berjudul "_synced". Kolom ini dibuat otomatis.
 *   JANGAN hapus / ubah kolom "_synced" agar tidak terjadi kirim ganda.
 * - Header (baris ke-1) harus tetap ada. Nama kolom mengikuti Meta Instant Form.
 * ============================================================
 */

function syncNewLeads() {
  var props = PropertiesService.getScriptProperties();
  var baseUrl = props.getProperty('NEXTJS_URL');
  var syncKey = props.getProperty('SYNC_KEY');
  var sheetName = props.getProperty('SHEET_NAME');

  if (!baseUrl || !syncKey) {
    throw new Error('Script Properties belum lengkap (butuh NEXTJS_URL dan SYNC_KEY).');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];
  if (!sheet) {
    throw new Error('Sheet tidak ditemukan. Cek SHEET_NAME di Script Properties.');
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) {
    Logger.log('Tidak ada data (baris kurang dari 2).');
    return;
  }

  // Ambil header (baris 1)
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // Pastikan ada kolom penanda "_synced"
  var syncedColIndex = headers.indexOf('_synced'); // 0-based
  if (syncedColIndex === -1) {
    syncedColIndex = lastCol;          // tambah kolom baru di paling kanan
    sheet.getRange(1, lastCol + 1).setValue('_synced');
    lastCol = lastCol + 1;
    headers.push('_synced');
  }
  var syncedColNumber = syncedColIndex + 1; // 1-based untuk getRange

  // Ambil semua data
  var dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
  var data = dataRange.getValues();

  var rowsToSend = [];
  var rowNumbers = [];

  for (var i = 0; i < data.length; i++) {
    var rowArr = data[i];
    var alreadySynced = String(rowArr[syncedColIndex] || '').trim();
    if (alreadySynced === 'OK') continue; // lewati yang sudah terkirim

    // Susun objek { header: nilai }
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var key = headers[c];
      if (key === '_synced') continue;
      obj[key] = rowArr[c];
    }

    // Lewati baris kosong (tanpa email)
    var emailVal = obj['Email'] || obj['email'] || '';
    if (!String(emailVal).trim()) continue;

    rowsToSend.push(obj);
    rowNumbers.push(i + 2); // nomor baris asli di Sheet (1-based, +1 untuk header)
  }

  if (rowsToSend.length === 0) {
    Logger.log('Tidak ada baris baru untuk dikirim.');
    return;
  }

  // Kirim ke endpoint (batch sekaligus)
  var url = baseUrl.replace(/\/$/, '') + '/api/public/leads/ingest';
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Sync-Key': syncKey },
    payload: JSON.stringify({ rows: rowsToSend }),
    muteHttpExceptions: true
  };

  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  var bodyText = res.getContentText();
  Logger.log('Status: ' + code + ' | Response: ' + bodyText);

  if (code !== 200) {
    throw new Error('Ingest gagal (HTTP ' + code + '): ' + bodyText);
  }

  // Tandai baris yang berhasil dikirim dengan "OK"
  for (var r = 0; r < rowNumbers.length; r++) {
    sheet.getRange(rowNumbers[r], syncedColNumber).setValue('OK');
  }

  Logger.log('Sukses kirim ' + rowsToSend.length + ' baris leads ke Firestore.');
}

/**
 * Fungsi uji manual — kirim 1 baris dummy ke endpoint untuk cek koneksi.
 * Pilih fungsi ini lalu Run untuk memastikan NEXTJS_URL & SYNC_KEY benar.
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
      'Email': 'uji.coba@example.com',
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
