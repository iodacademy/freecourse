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

var NEXT_API_URL = "https://freecourse.iodacademy.id/api/cron/workshop-reminder";
var ADMIN_KEY    = "ADMINFL26";

// === HELPER: Format date to "25 May 2026" ===
var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function formatTanggal(date) {
  if (typeof date === "string") date = new Date(date);
  return date.getDate() + " " + MONTHS[date.getMonth()] + " " + date.getFullYear();
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
// 2. SERTIFIKAT UTAMA (Financial Literacy)
// ═══════════════════════════════════════════════════════════════

function generateMainCert(data) {
  var userName   = data.userName || "Peserta";
  var certId     = data.certId || "CERT-XXXX";
  var claimDate  = data.claimDate || formatTanggal(new Date());
  var templateId = data.templateId || MAIN_TEMPLATE_ID;

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
  var claimDate      = data.claimDate || formatTanggal(new Date());
  var workshopTitle  = data.workshopTitle || "Workshop IODA Academy";
  var workshopDate   = data.workshopDate || "";
  var workshopDay    = data.workshopDay || "";
  var workshopTime   = data.workshopTime || "";
  var speakerName    = data.speakerName || "";
  var speakerTitle   = data.speakerTitle || "";
  var templateId     = data.templateId || WORKSHOP_TEMPLATE_ID;

  // 1. Copy template
  var templateFile = DriveApp.getFileById(templateId);
  var fileName = userName + " - Sertifikat Workshop";
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
// 6. AUTO-CLEANUP: Hapus PDF sertifikat > 5 hari
// ═══════════════════════════════════════════════════════════════

var CERT_EXPIRY_DAYS = 5;

/**
 * Cek semua file di folder sertifikat.
 * Jika file PDF sudah lebih dari 5 hari sejak dibuat → hapus (trash).
 * Dipanggil otomatis oleh Time Trigger harian.
 */
function cleanupExpiredCerts() {
  try {
    var folder = DriveApp.getFolderById(CERT_FOLDER_ID);
    var files = folder.getFiles();
    var now = new Date();
    var cutoff = new Date(now.getTime() - (CERT_EXPIRY_DAYS * 24 * 60 * 60 * 1000));
    var deleted = 0;

    while (files.hasNext()) {
      var file = files.next();
      var created = file.getDateCreated();

      if (created < cutoff) {
        Logger.log("[CLEANUP] Hapus: " + file.getName() + " (dibuat " + created.toISOString() + ")");
        file.setTrashed(true);
        deleted++;
      }
    }

    Logger.log("[CLEANUP] Selesai. " + deleted + " file dihapus.");
  } catch (e) {
    Logger.log("[CLEANUP ERROR] " + e.toString());
  }
}

/**
 * Jalankan SEKALI untuk memasang trigger harian cleanup (jam 2 pagi WIB).
 * Setelah dipasang, jangan jalankan lagi.
 */
function setupCleanupTrigger() {
  // Hapus trigger lama
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "cleanupExpiredCerts") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Pasang trigger baru: setiap hari jam 2 pagi
  ScriptApp.newTrigger("cleanupExpiredCerts")
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();

  Logger.log("Trigger cleanup harian jam 2 pagi berhasil dipasang!");
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
