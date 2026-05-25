/**
 * ============================================================
 * GAS Script - Certificate Generator (Main & Workshop)
 * ============================================================
 *
 * CARA SETUP:
 * 1. Buka https://script.google.com → New Project
 * 2. Paste seluruh kode ini ke Code.gs
 * 3. Deploy → New Deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy URL deployment, masukkan ke Admin Settings > Sertifikat
 *    di field "GAS Web App URL"
 *
 * KONFIGURASI:
 * - FOLDER_ID: ID folder Google Drive untuk menyimpan sertifikat
 * - MAIN_TEMPLATE_ID: ID Google Slides template sertifikat utama
 * - WORKSHOP_TEMPLATE_ID: ID Google Slides template sertifikat workshop
 *
 * ============================================================
 */

// === KONFIGURASI ===
var FOLDER_ID              = "11CGGPpHDYBrC2Vfm14BRICnBhOF1O5pB";
var MAIN_TEMPLATE_ID       = "1E7qirTYtP79RcmM7uwdH9gevaNtutCETZfAsLhx6hfc";
var WORKSHOP_TEMPLATE_ID   = "1DAMmG7d9c4XXHdAP9EJhD8pVl1mXkW1ADj3mDS-scNk";

// === WEB APP ENTRY POINT ===
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || "generate_main_cert";

    var result;
    if (action === "generate_workshop_cert") {
      result = generateWorkshopCert(payload);
    } else {
      result = generateMainCert(payload);
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("ERROR: " + err.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// === SERTIFIKAT UTAMA (Financial Literacy) ===
function generateMainCert(payload) {
  var userName    = payload.userName || "Peserta";
  var certId      = payload.certId  || "CERT-XXXX";
  var templateId  = payload.templateId || MAIN_TEMPLATE_ID;

  // 1. Copy template
  var templateFile = DriveApp.getFileById(templateId);
  var fileName = userName + " - Sertifikat Financial Literasi";
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var copy = templateFile.makeCopy(fileName, folder);
  var slideId = copy.getId();

  // 2. Buka slide dan replace placeholder
  var presentation = SlidesApp.openById(slideId);
  var slides = presentation.getSlides();

  for (var i = 0; i < slides.length; i++) {
    var slide = slides[i];
    // Replace nama peserta — sesuaikan placeholder di template
    slide.replaceAllText("{{NAMA_PESERTA}}", userName);
    slide.replaceAllText("{{NAMA}}", userName);
    slide.replaceAllText("{{nama}}", userName);
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

  Logger.log("Main cert generated: " + fileName + " → " + downloadUrl);

  return {
    success: true,
    pdfUrl: downloadUrl,
    downloadUrl: downloadUrl,
    fileId: pdfFile.getId(),
    certId: certId
  };
}

// === SERTIFIKAT WORKSHOP ===
function generateWorkshopCert(payload) {
  var userName       = payload.userName || "Peserta";
  var certId         = payload.certId || "WS-CERT-XXXX";
  var workshopTitle  = payload.workshopTitle || "Workshop IODA Academy";
  var workshopDate   = payload.workshopDate || "";
  var workshopDay    = payload.workshopDay || "";
  var workshopTime   = payload.workshopTime || "";
  var speakerName    = payload.speakerName || "";
  var speakerTitle   = payload.speakerTitle || "";
  var templateId     = payload.templateId || WORKSHOP_TEMPLATE_ID;

  // 1. Copy template
  var templateFile = DriveApp.getFileById(templateId);
  var fileName = userName + " - Sertifikat Workshop";
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var copy = templateFile.makeCopy(fileName, folder);
  var slideId = copy.getId();

  // 2. Replace placeholders
  var presentation = SlidesApp.openById(slideId);
  var slides = presentation.getSlides();

  for (var i = 0; i < slides.length; i++) {
    var slide = slides[i];
    slide.replaceAllText("{{NAMA_PESERTA}}", userName);
    slide.replaceAllText("{{NAMA}}", userName);
    slide.replaceAllText("{{nama}}", userName);
    slide.replaceAllText("{{CERT_ID}}", certId);
    slide.replaceAllText("{{JUDUL_WORKSHOP}}", workshopTitle);
    slide.replaceAllText("{{TANGGAL}}", workshopDate);
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

  Logger.log("Workshop cert generated: " + fileName + " → " + downloadUrl);

  return {
    success: true,
    pdfUrl: downloadUrl,
    downloadUrl: downloadUrl,
    fileId: pdfFile.getId(),
    certId: certId
  };
}

// === HAPUS SERTIFIKAT LAMA (untuk reclaim) ===
function deleteOldCert(payload) {
  var fileId = payload.fileId;
  if (!fileId) return { success: false, error: "No fileId provided" };

  try {
    DriveApp.getFileById(fileId).setTrashed(true);
    return { success: true, message: "File deleted" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// === TEST FUNCTION ===
// Jalankan fungsi ini untuk test dari editor GAS
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
