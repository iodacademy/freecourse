/**
 * ============================================================
 * GAS Script - All-in-One
 * (Email, Reminder, Certificate Generator)
 * ============================================================
 *
 * CARA SETUP:
 * 1. Buka script.google.com → buka project GAS kamu
 * 2. Paste seluruh kode ini ke Code.gs (replace semua)
 * 3. Deploy → New Deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy URL deployment → masukkan di Admin Settings > Sertifikat
 *
 * FITUR:
 * - Kirim email (action: "send_email")
 * - Generate sertifikat utama (action: "generate_main_cert")
 * - Generate sertifikat workshop (action: "generate_workshop_cert")
 * - Hapus file sertifikat lama (action: "delete_old_cert")
 * - Reminder workshop H-1 (triggerReminderOtomatis via Time Trigger)
 *
 * ============================================================
 */

// === KONFIGURASI ===
var CERT_FOLDER_ID         = "11CGGPpHDYBrC2Vfm14BRICnBhOF1O5pB";
var MAIN_TEMPLATE_ID       = "1E7qirTYtP79RcmM7uwdH9gevaNtutCETZfAsLhx6hfc";
var WORKSHOP_TEMPLATE_ID   = "1DAMmG7d9c4XXHdAP9EJhD8pVl1mXkW1ADj3mDS-scNk";

// === KONFIGURASI REVIEW CV (Benefit "Review CV") ===
// Folder Drive tujuan simpan CV & Google Sheet tempat mencatat data submit.
var CV_FOLDER_ID           = "1SlYAO_dC_r9wx773-nzBvkK_bB6taZdH";
var CV_SHEET_ID            = "1KuNb0fzM_SEFc-O8cHaaIXI9j_prTuiW1c3HkCkjKU0";
var CV_SHEET_NAME          = "Review CV";
var CV_SHEET_HEADERS       = ["Timestamp", "Nama Lengkap", "Email", "Link CV", "Sudah Direview", "Status Email"];

var NEXT_API_URL = "https://freecourse.iodacademy.id/api/cron/workshop-reminder";
var ADMIN_KEY    = "ADMINFL26";

// === HELPER: Format date to "25 May 2026" ===
var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function formatTanggal(date) {
  if (typeof date === "string") date = new Date(date);
  return date.getDate() + " " + MONTHS[date.getMonth()] + " " + date.getFullYear();
}

// Helper untuk menterjemahkan Hari & Bulan ke Bahasa Inggris
function translateToEnglish(text) {
  if (!text) return "";
  var map = {
    // Hari
    "senin": "Monday",
    "selasa": "Tuesday",
    "rabu": "Wednesday",
    "kamis": "Thursday",
    "jum'at": "Friday",
    "jumat": "Friday",
    "sabtu": "Saturday",
    "minggu": "Sunday",
    
    // Bulan
    "januari": "January",
    "februari": "February",
    "maret": "March",
    "april": "April",
    "mei": "May",
    "juni": "June",
    "juli": "July",
    "agustus": "August",
    "september": "September",
    "oktober": "October",
    "november": "November",
    "desember": "December"
  };

  var translated = text.toString();
  for (var key in map) {
    var regex = new RegExp("\\b" + key + "\\b", "gi");
    translated = translated.replace(regex, map[key]);
  }
  return translated;
}

// ═══════════════════════════════════════════════════════════════
// WEB APP ENTRY POINT
// ═══════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || "";

    var result;

    switch (action) {
      case "generate_main_cert":
        result = generateMainCert(data);
        break;

      case "generate_workshop_cert":
        result = generateWorkshopCert(data);
        break;

      case "delete_old_cert":
        result = deleteOldCert(data);
        break;

      case "send_email":
        result = sendEmail(data);
        break;

      case "upload_cv":
        result = uploadCv(data);
        break;

      case "append_cv_row":
        result = appendCvRow(data);
        break;

      case "submit_cv":
        // Gabungan: upload file + tulis baris sheet dalam satu panggilan.
        result = submitCv(data);
        break;

      default:
        // Backward compat: jika ada field to/subject/htmlBody tanpa action → kirim email
        if (data.to && data.subject && data.htmlBody) {
          result = sendEmail(data);
        } else {
          result = { error: "Unknown action: " + action };
        }
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("ERROR doPost: " + err.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ═══════════════════════════════════════════════════════════════
// 1. KIRIM EMAIL
// ═══════════════════════════════════════════════════════════════

function sendEmail(data) {
  var to = data.to;
  var subject = data.subject;
  var htmlBody = data.htmlBody;

  if (!to || !subject || !htmlBody) {
    return { error: "Missing fields: to, subject, htmlBody" };
  }

  GmailApp.sendEmail(to, subject, "", { htmlBody: htmlBody });
  return { success: true, to: to };
}


// ═══════════════════════════════════════════════════════════════
// 1b. REVIEW CV — Upload ke Drive & catat ke Google Sheet
// ═══════════════════════════════════════════════════════════════

// Bersihkan string agar aman untuk nama file
function sanitizeFileName_(s) {
  return String(s || "").replace(/[\\/:*?"<>|]/g, "-").trim();
}

// Upload file CV (base64) ke folder Drive. Return { success, fileUrl, fileId }.
function uploadCv(data) {
  var base64    = data.fileBase64 || data.base64 || "";
  var mimeType  = data.mimeType || "application/pdf";
  var namaLengkap = data.namaLengkap || data.name || "Peserta";
  var email     = data.email || "";
  var ext       = data.ext || "pdf";

  if (!base64) return { success: false, error: "fileBase64 kosong" };

  var bytes = Utilities.base64Decode(base64);
  var baseName = sanitizeFileName_(namaLengkap) + (email ? " - " + sanitizeFileName_(email) : "");
  var fileName = "CV - " + baseName + "." + ext;

  var blob = Utilities.newBlob(bytes, mimeType, fileName);
  var folder = DriveApp.getFolderById(CV_FOLDER_ID);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileUrl = "https://drive.google.com/file/d/" + file.getId() + "/view";
  Logger.log("CV uploaded: " + fileName + " → " + fileUrl);
  return { success: true, fileUrl: fileUrl, fileId: file.getId() };
}

// Ambil / buat sheet Review CV, pastikan header ada di baris pertama.
function getCvSheet_() {
  var ss = SpreadsheetApp.openById(CV_SHEET_ID);
  var sheet = ss.getSheetByName(CV_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CV_SHEET_NAME);

  // Tulis header otomatis bila sheet kosong / baris 1 kosong.
  var needHeader = sheet.getLastRow() === 0;
  if (!needHeader) {
    var firstCell = sheet.getRange(1, 1).getValue();
    if (!firstCell) needHeader = true;
  }
  if (needHeader) {
    sheet.getRange(1, 1, 1, CV_SHEET_HEADERS.length).setValues([CV_SHEET_HEADERS]);
    sheet.getRange(1, 1, 1, CV_SHEET_HEADERS.length).setFontWeight("bold").setBackground("#FFE5E5");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Tambah 1 baris data CV ke sheet. Kolom penanda default: Belum / Belum Dikirim.
function appendCvRow(data) {
  var namaLengkap = data.namaLengkap || data.name || "";
  var email     = data.email || "";
  var fileUrl   = data.fileUrl || "";
  var timestamp = data.timestamp || (new Date()).toISOString();

  var sheet = getCvSheet_();
  sheet.appendRow([
    timestamp,
    namaLengkap,
    email,
    fileUrl,
    "Belum",         // Sudah Direview
    "Belum Dikirim", // Status Email
  ]);
  Logger.log("CV row appended: " + email);
  return { success: true };
}

// Gabungan upload + append dalam satu request (dipakai app).
function submitCv(data) {
  var up = uploadCv(data);
  if (!up.success) return up;
  var appendRes = appendCvRow({
    namaLengkap: data.namaLengkap || data.name,
    email: data.email,
    fileUrl: up.fileUrl,
    timestamp: data.timestamp,
  });
  return { success: true, fileUrl: up.fileUrl, fileId: up.fileId, appended: appendRes.success };
}

// ── TEST akses: klik Run fungsi ini di editor GAS untuk memastikan akun GAS
//    punya akses ke folder Drive & Sheet CV. Tidak butuh argumen.
//    Sukses → ada file "CV - Test Akses ....pdf" di folder Drive + 1 baris baru
//    di tab "Review CV". Gagal permission → error jelas di Logger. ──
function testSubmitCv() {
  // File PDF minimal valid (base64) — cukup untuk cek izin tulis ke Drive.
  var dummyPdfBase64 =
    "JVBERi0xLjEKJcOkw7zDtsOfCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBSPj4KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzMgMCBSXS9Db3VudCAxPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMTAwIDEwMF0+PgplbmRvYmoKdHJhaWxlcgo8PC9Sb290IDEgMCBSPj4KJSVFT0Y=";

  var res = submitCv({
    fileBase64: dummyPdfBase64,
    mimeType: "application/pdf",
    ext: "pdf",
    namaLengkap: "Test Akses",
    email: "test-akses@example.com",
    timestamp: new Date().toISOString(),
  });

  Logger.log(JSON.stringify(res));

  if (res && res.success) {
    Logger.log("[OK] Akses Drive & Sheet BERHASIL. Cek file di folder Drive & baris baru di tab '" + CV_SHEET_NAME + "'.");
    Logger.log("[OK] File uji: " + res.fileUrl);
    Logger.log("CATATAN: hapus file & baris uji ini secara manual bila tidak diperlukan.");
  } else {
    Logger.log("[GAGAL] Cek pesan error di atas. Biasanya karena akun GAS belum di-share sebagai Editor ke folder/sheet CV.");
  }
  return res;
}


// ═══════════════════════════════════════════════════════════════
// 2. SERTIFIKAT UTAMA (Financial Literacy)
// ═══════════════════════════════════════════════════════════════

function generateMainCert(data) {
  var certId      = data.certId || "CERT-XXXX";
  var userName    = data.userName || "Peserta";
  var courseName  = data.courseName || "Kursus";
  var claimDate   = translateToEnglish(data.claimDate || formatTanggal(new Date()));
  var templateId  = data.templateId || MAIN_TEMPLATE_ID;

  // 1. Copy template
  var templateFile = DriveApp.getFileById(templateId);
  var fileName = userName + " - Sertifikat Financial Literasi";
  var folder = DriveApp.getFolderById(CERT_FOLDER_ID);
  var copy = templateFile.makeCopy(fileName, folder);
  var slideId = copy.getId();

  // 2. Replace placeholder
  var presentation = SlidesApp.openById(slideId);
  var slides = presentation.getSlides();

  for (var i = 0; i < slides.length; i++) {
    var slide = slides[i];
    slide.replaceAllText("{{NAMA_PESERTA}}", userName);
    slide.replaceAllText("{{NAMA}}", userName);
    slide.replaceAllText("{{nama}}", userName);
    slide.replaceAllText("{{TANGGAL}}", claimDate);
    slide.replaceAllText("{{CERT_ID}}", certId);
  }

  presentation.saveAndClose();

  // 3. Export ke PDF
  var pdfBlob = DriveApp.getFileById(slideId)
    .getAs("application/pdf")
    .setName(fileName + ".pdf");

  var pdfFile = folder.createFile(pdfBlob);

  // 4. Set sharing: anyone with link can view
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // 5. Hapus file Slides (hanya simpan PDF)
  copy.setTrashed(true);

  var downloadUrl = "https://drive.google.com/file/d/" + pdfFile.getId() + "/view";
  Logger.log("Main cert: " + fileName + " → " + downloadUrl);

  return {
    success: true,
    pdfUrl: downloadUrl,
    downloadUrl: downloadUrl,
    fileId: pdfFile.getId(),
    certId: certId
  };
}


// ═══════════════════════════════════════════════════════════════
// 3. SERTIFIKAT WORKSHOP
// ═══════════════════════════════════════════════════════════════

function generateWorkshopCert(data) {
  var userName       = data.userName || "Peserta";
  var certId         = data.certId || "WS-CERT-XXXX";
  var claimDate      = translateToEnglish(data.claimDate || formatTanggal(new Date()));
  var workshopTitle  = data.workshopTitle || "Workshop IODA Academy";
  var workshopDate   = translateToEnglish(data.workshopDate || "");
  var workshopDay    = translateToEnglish(data.workshopDay || "");
  var workshopTime   = data.workshopTime || "";
  var speakerName    = data.speakerName || "";
  var speakerTitle   = data.speakerTitle || "";
  var templateId     = data.templateId || WORKSHOP_TEMPLATE_ID;

  // 1. Copy template
  var templateFile = DriveApp.getFileById(templateId);
  var fileName = "Workshop - " + userName + " - " + workshopTitle;
  var folder = DriveApp.getFolderById(CERT_FOLDER_ID);
  var copy = templateFile.makeCopy(fileName, folder);
  var slideId = copy.getId();

  // 2. Replace placeholder
  var presentation = SlidesApp.openById(slideId);
  var slides = presentation.getSlides();

  for (var i = 0; i < slides.length; i++) {
    var slide = slides[i];
    slide.replaceAllText("{{NAMA_PESERTA}}", userName);
    slide.replaceAllText("{{NAMA}}", userName);
    slide.replaceAllText("{{nama}}", userName);
    slide.replaceAllText("{{CERT_ID}}", certId);
    slide.replaceAllText("{{JUDUL_WORKSHOP}}", workshopTitle);
    slide.replaceAllText("{{TANGGAL}}", claimDate);
    slide.replaceAllText("{{TANGGAL_WORKSHOP}}", workshopDate);
    slide.replaceAllText("{{HARI}}", workshopDay);
    slide.replaceAllText("{{JAM}}", workshopTime);
    slide.replaceAllText("{{PEMATERI}}", speakerName);
    slide.replaceAllText("{{JABATAN_PEMATERI}}", speakerTitle);
  }

  presentation.saveAndClose();

  // 3. Export ke PDF
  var pdfBlob = DriveApp.getFileById(slideId)
    .getAs("application/pdf")
    .setName(fileName + ".pdf");

  var pdfFile = folder.createFile(pdfBlob);

  // 4. Set sharing
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // 5. Hapus file Slides
  copy.setTrashed(true);

  var downloadUrl = "https://drive.google.com/file/d/" + pdfFile.getId() + "/view";
  Logger.log("Workshop cert: " + fileName + " → " + downloadUrl);

  return {
    success: true,
    pdfUrl: downloadUrl,
    downloadUrl: downloadUrl,
    fileId: pdfFile.getId(),
    certId: certId
  };
}


// ═══════════════════════════════════════════════════════════════
// 4. HAPUS SERTIFIKAT LAMA (untuk reclaim)
// ═══════════════════════════════════════════════════════════════

function deleteOldCert(data) {
  var fileId = data.fileId;
  if (!fileId) return { success: false, error: "No fileId provided" };

  try {
    DriveApp.getFileById(fileId).setTrashed(true);
    return { success: true, message: "File deleted" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}


// ═══════════════════════════════════════════════════════════════
// 5. WORKSHOP REMINDER (H-1) - Dipanggil oleh Time Trigger
// ═══════════════════════════════════════════════════════════════

function triggerReminderOtomatis() {
  try {
    var url = NEXT_API_URL + "?key=" + ADMIN_KEY;

    var options = {
      method: "get",
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        "Content-Type": "application/json"
      }
    };

    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();
    var body = response.getContentText();

    Logger.log("Status: " + statusCode);
    Logger.log("Response: " + body);

    if (statusCode === 200) {
      Logger.log("[SUKSES] Reminder berhasil dikirim!");
    } else if (statusCode === 401) {
      Logger.log("[ERROR] Unauthorized - Cek ADMIN_KEY");
    } else {
      Logger.log("[ERROR] Response code: " + statusCode);
    }

  } catch (e) {
    Logger.log("[ERROR] Exception: " + e.toString());
  }
}

// Jalankan SEKALI untuk memasang trigger harian jam 12 WIB
function setupTriggerHarian() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "triggerReminderOtomatis") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("triggerReminderOtomatis")
    .timeBased()
    .everyDays(1)
    .atHour(12)
    .create();

  Logger.log("Trigger harian jam 12 WIB berhasil dipasang!");
}


// ═══════════════════════════════════════════════════════════════
// 6. AUTO-CLEANUP: Hapus PDF sertifikat > 5 hari (DINONAKTIFKAN PERMANEN)
// ═══════════════════════════════════════════════════════════════

function cleanupExpiredCerts() {
  Logger.log("[CLEANUP] Fungsi pembersihan sudah dimatikan total. Tidak akan ada lagi file yang dihapus.");
  return;
}

/**
 * Jalankan fungsi di bawah ini (Pilih removeCleanupTrigger lalu klik Run di atas) 
 * HANYA SEKALI untuk benar-benar menghapus trigger penghapusan otomatis dari Google Apps Script.
 */
function removeCleanupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var deleted = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "cleanupExpiredCerts") {
      ScriptApp.deleteTrigger(triggers[i]);
      deleted++;
    }
  }
  if (deleted > 0) {
    Logger.log("BERHASIL: " + deleted + " Trigger cleanupExpiredCerts berhasil dihapus secara permanen!");
  } else {
    Logger.log("AMAN: Tidak ada trigger cleanupExpiredCerts yang aktif.");
  }
}


// ═══════════════════════════════════════════════════════════════
// TEST FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function testEmail() {
  GmailApp.sendEmail(
    "rohmatramadhan07@gmail.com",
    "Test dari GAS",
    "Email test berhasil!"
  );
}

function testGenerateMainCert() {
  var result = generateMainCert({
    userName: "Test Peserta",
    certId: "CERT-2026-TEST01"
  });
  Logger.log(JSON.stringify(result));
}

function testGenerateWorkshopCert() {
  var result = generateWorkshopCert({
    userName: "Test Peserta",
    certId: "WS-CERT-2026-TEST01",
    workshopTitle: "Cara Mengatur Gaji UMR",
    workshopDate: "15 Juni 2026",
    workshopDay: "Minggu",
    workshopTime: "09.00 - 12.00 WIB",
    speakerName: "John Doe",
    speakerTitle: "Financial Advisor"
  });
  Logger.log(JSON.stringify(result));
}

// ═══════════════════════════════════════════════════════════════
// SYNC DASHBOARD KE GOOGLE SHEET (Time-driven trigger)
// ═══════════════════════════════════════════════════════════════
//
// Cara setup:
// 1. Buka menu Project Settings (icon gear di kiri) → scroll ke Script Properties
//    → Add property:
//      - NEXTJS_URL  = https://freecourse.iodacademy.id   (tanpa trailing slash)
//      - SYNC_KEY    = (salin dari Admin > Pengaturan Dashboard > Sync Key)
//      - SHEET_ID    = (salin dari URL spreadsheet target)
//      - SHEET_NAME  = Data Dashboard   (atau nama tab sesuai keinginan)
// 2. Buka menu Triggers (icon jam di kiri) → Add Trigger:
//      - Function: syncDashboardSheet
//      - Event source: Time-driven
//      - Type of time-based trigger: Hour timer → Every hour
// 3. Test "Run" manual sekali → cek di Google Sheet → harus terisi data
//
function syncDashboardSheet() {
  var props = PropertiesService.getScriptProperties();
  var baseUrl = props.getProperty('NEXTJS_URL');
  var syncKey = props.getProperty('SYNC_KEY');
  var sheetId = props.getProperty('SHEET_ID');
  var sheetName = props.getProperty('SHEET_NAME') || 'Data Dashboard';

  if (!baseUrl || !syncKey || !sheetId) {
    throw new Error('Script Properties belum lengkap (butuh NEXTJS_URL, SYNC_KEY, SHEET_ID)');
  }

  var url = baseUrl.replace(/\/$/, '') + '/api/sync/sheet-data';
  var res = UrlFetchApp.fetch(url, {
    headers: { 'X-Sync-Key': syncKey },
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  if (code !== 200) {
    throw new Error('Sync gagal (HTTP ' + code + '): ' + res.getContentText());
  }

  var data = JSON.parse(res.getContentText());
  if (!data.headers || !data.rows) {
    throw new Error('Format response tidak valid');
  }

  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  sheet.clear();

  // Tulis header + rows
  var totalRows = data.rows.length + 1;
  sheet.getRange(1, 1, totalRows, data.headers.length)
       .setValues([data.headers].concat(data.rows));

  // Header styling
  var headerRange = sheet.getRange(1, 1, 1, data.headers.length);
  headerRange.setFontWeight('bold').setBackground('#FFE5E5');

  // Meta — "Last Sync" di kolom sebelah kanan header
  sheet.getRange(1, data.headers.length + 2).setValue('Last Sync: ' + data.generatedAt);

  Logger.log('Sync sukses: ' + data.rows.length + ' baris ditulis ke "' + sheetName + '"');
}

function testSyncDashboardSheet() {
  syncDashboardSheet();
}
