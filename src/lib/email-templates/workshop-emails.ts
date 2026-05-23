import { formatDateID } from "@/lib/gas-email";

interface WorkshopEmailData {
  recipientName: string;
  workshopTitle: string;
  date: string;       // ISO
  dayLabel?: string;  // "Sabtu"
  time: string;       // "09.00-12.00 WIB"
  platform: string;
  meetingLink?: string;
  waGroupLink?: string;
  speakerName: string;
  speakerTitle: string;
  speakerPhoto?: string;
}

export function workshopConfirmationEmail(data: WorkshopEmailData): { subject: string; htmlBody: string } {
  const subject = `PENDAFTARAN BERHASIL!!!!`;
  const dateDisplay = data.date ? formatDateID(data.date) : "-";
  const dayTime = [data.dayLabel, data.time].filter(Boolean).join(" · ");

  const htmlBody = `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:#CC0000;padding:32px 40px;text-align:center;">
      <div style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">IODA ACADEMY &times; PLAN INDONESIA</div>
      <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:800;">Pendaftaran Berhasil!</h1>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <p style="color:#333;font-size:16px;margin:0 0 24px;">Halo <strong>${data.recipientName}</strong>,</p>
      <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 32px;">
        Kamu sudah terdaftar sebagai peserta <strong>Workshop Literasi Finansial</strong>. Simak detail workshop di bawah ini dan simpan informasinya baik-baik!
      </p>

      <!-- Workshop Card -->
      <div style="background:#fff5f5;border:1.5px solid #ffcccc;border-radius:12px;padding:28px;margin-bottom:32px;">
        <h2 style="color:#CC0000;font-size:18px;margin:0 0 20px;font-weight:700;">${data.workshopTitle}</h2>
        
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;width:24px;vertical-align:top;"><img src="https://img.icons8.com/fluency-systems-regular/24/888888/calendar.png" width="16" alt="icon"></td>
            <td style="padding:8px 0;color:#888;font-size:13px;width:100px;vertical-align:top;">Tanggal</td>
            <td style="padding:8px 0;color:#222;font-size:14px;font-weight:600;">${dateDisplay}</td>
          </tr>
          ${dayTime ? `<tr>
            <td style="padding:8px 0;vertical-align:top;"><img src="https://img.icons8.com/fluency-systems-regular/24/888888/clock.png" width="16" alt="icon"></td>
            <td style="padding:8px 0;color:#888;font-size:13px;vertical-align:top;">Hari &amp; Jam</td>
            <td style="padding:8px 0;color:#222;font-size:14px;font-weight:600;">${dayTime}</td>
          </tr>` : ""}
          <tr>
            <td style="padding:8px 0;vertical-align:top;"><img src="https://img.icons8.com/fluency-systems-regular/24/888888/monitor.png" width="16" alt="icon"></td>
            <td style="padding:8px 0;color:#888;font-size:13px;vertical-align:top;">Platform</td>
            <td style="padding:8px 0;color:#222;font-size:14px;font-weight:600;">${data.platform}</td>
          </tr>
        </table>
      </div>

      <!-- Speaker Card (Polaroid Style) -->
      ${data.speakerName ? `
      <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin:0 auto 32px auto;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.05);max-width:260px;">
        <div style="width:40px;height:12px;background:rgba(200,200,200,0.4);margin:-22px auto 16px auto;"></div>
        ${data.speakerPhoto ? `<img src="${data.speakerPhoto}" alt="${data.speakerName}" style="width:100%;max-width:260px;height:auto;border-radius:4px;margin-bottom:16px;border:1px solid #eee;display:block;">` : ""}
        <div style="background:#CC0000;color:#fff;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 8px;display:inline-block;border-radius:4px;margin-bottom:8px;">PEMATERI</div>
        <div style="font-size:18px;font-weight:700;color:#222;margin-bottom:4px;">${data.speakerName}</div>
        <div style="font-size:13px;color:#666;line-height:1.4;">${data.speakerTitle}</div>
      </div>` : ""}

      <!-- CTA Buttons -->
      <div style="margin-bottom:32px;">
        ${data.meetingLink ? `
        <a href="${data.meetingLink}" style="display:block;background:#CC0000;color:#ffffff;text-decoration:none;padding:16px 24px;border-radius:8px;font-weight:700;font-size:15px;text-align:center;margin-bottom:12px;">
          <img src="https://img.icons8.com/fluency-systems-regular/24/ffffff/external-link.png" width="16" style="vertical-align:middle;margin-right:6px;" alt="link"> Gabung ${data.platform}
        </a>` : ""}
        ${data.waGroupLink ? `
        <a href="${data.waGroupLink}" style="display:block;background:#25D366;color:#ffffff;text-decoration:none;padding:16px 24px;border-radius:8px;font-weight:700;font-size:15px;text-align:center;">
          <img src="https://img.icons8.com/color/24/whatsapp--v1.png" width="18" style="vertical-align:middle;margin-right:6px;" alt="wa"> Gabung Grup WhatsApp
        </a>` : ""}
      </div>

      <p style="color:#888;font-size:13px;line-height:1.6;margin:0;border-top:1px solid #eee;padding-top:24px;">
        Simpan email ini sebagai referensi. Jika ada pertanyaan, silakan balas email ini atau hubungi admin melalui grup WhatsApp.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#222;padding:24px 40px;text-align:center;">
      <div style="color:#ffffff;font-weight:700;font-size:14px;margin-bottom:4px;">IODA Academy</div>
      <div style="color:#aaa;font-size:12px;">Program Literasi Finansial · Plan Indonesia × DBS Foundation</div>
    </div>
  </div>
</body>
</html>`;

  return { subject, htmlBody };
}

export function workshopReminderEmail(data: WorkshopEmailData): { subject: string; htmlBody: string } {
  const subject = `REMINDER WORKSHOP!!`;
  const dateDisplay = data.date ? formatDateID(data.date) : "-";
  const dayTime = [data.dayLabel, data.time].filter(Boolean).join(" · ");

  const htmlBody = `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
    
    <div style="background:#CC0000;padding:32px 40px;text-align:center;">
      <div style="color:#fff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">PENGINGAT WORKSHOP</div>
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">Besok Workshop-mu!</h1>
    </div>

    <div style="padding:40px;">
      <p style="color:#333;font-size:16px;margin:0 0 20px;">Halo <strong>${data.recipientName}</strong>,</p>
      <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 28px;">
        Mengingatkan bahwa <strong>workshop besok</strong> segera tiba. Pastikan kamu sudah siap!
      </p>

      <div style="background:#fff5f5;border:1.5px solid #ffcccc;border-radius:12px;padding:24px;margin-bottom:28px;">
        <h2 style="color:#CC0000;font-size:17px;margin:0 0 16px;">${data.workshopTitle}</h2>
        <div style="color:#222;font-size:14px;display:flex;align-items:center;margin-bottom:8px;">
          <img src="https://img.icons8.com/fluency-systems-regular/24/888888/calendar.png" width="16" style="margin-right:8px;" alt="icon">
          <strong>${dateDisplay}</strong>
        </div>
        ${dayTime ? `<div style="color:#222;font-size:14px;display:flex;align-items:center;margin-bottom:8px;">
          <img src="https://img.icons8.com/fluency-systems-regular/24/888888/clock.png" width="16" style="margin-right:8px;" alt="icon">
          <strong>${dayTime}</strong>
        </div>` : ""}
        <div style="color:#222;font-size:14px;display:flex;align-items:center;">
          <img src="https://img.icons8.com/fluency-systems-regular/24/888888/monitor.png" width="16" style="margin-right:8px;" alt="icon">
          <strong>${data.platform}</strong>
        </div>
      </div>

      ${data.meetingLink ? `<a href="${data.meetingLink}" style="display:block;background:#CC0000;color:#fff;text-decoration:none;padding:16px;border-radius:8px;font-weight:700;text-align:center;margin-bottom:12px;"><img src="https://img.icons8.com/fluency-systems-regular/24/ffffff/external-link.png" width="16" style="vertical-align:middle;margin-right:6px;" alt="link"> Link ${data.platform}</a>` : ""}
      ${data.waGroupLink ? `<a href="${data.waGroupLink}" style="display:block;background:#25D366;color:#fff;text-decoration:none;padding:16px;border-radius:8px;font-weight:700;text-align:center;"><img src="https://img.icons8.com/color/24/whatsapp--v1.png" width="18" style="vertical-align:middle;margin-right:6px;" alt="wa"> Grup WhatsApp</a>` : ""}
    </div>

    <div style="background:#222;padding:20px 40px;text-align:center;">
      <div style="color:#aaa;font-size:12px;">IODA Academy · Program Literasi Finansial</div>
    </div>
  </div>
</body>
</html>`;

  return { subject, htmlBody };
}
