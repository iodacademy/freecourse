/**
 * ============================================================
 * GAS Script - Workshop Email Reminder (H-1)
 * ============================================================
 * 
 * CARA SETUP:
 * 1. Buka script.google.com → buka project GAS kamu
 * 2. Paste kode ini (atau tambahkan ke file baru)
 * 3. Ganti WEBHOOK_URL di bawah dengan URL GAS web app kamu
 * 4. Saat testing: jalankan sendiri fungsi triggerReminderOtomatis()
 * 5. Saat production (web sudah deploy):
 *    - Ganti NEXT_API_URL dengan domain asli webmu
 *    - Pasang Time Trigger harian jam 12 WIB
 * 
 * ============================================================
 */

// === KONFIGURASI ===
var NEXT_API_URL = "http://localhost:3000/api/cron/workshop-reminder"; // Ganti saat sudah deploy
var ADMIN_KEY    = "ADMINFL26"; // Harus sama dengan ADMIN_ACCESS_CODE di .env.local

// === FUNGSI UTAMA ===
// Fungsi ini yang dipanggil otomatis oleh Trigger harian
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

// === FUNGSI HELPER - Setup Trigger Otomatis ===
// Jalankan fungsi ini SEKALI SAJA untuk memasang trigger harian
// Setelah dipasang, HAPUS atau jangan jalankan lagi
function setupTriggerHarian() {
  // Hapus trigger lama jika ada
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "triggerReminderOtomatis") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Buat trigger baru: setiap hari jam 12.00-13.00 WIB
  ScriptApp.newTrigger("triggerReminderOtomatis")
    .timeBased()
    .everyDays(1)
    .atHour(12)  // Jam 12 siang (timezone sesuai setting project GAS)
    .create();
  
  Logger.log("Trigger harian jam 12 WIB berhasil dipasang!");
}
