interface RedeemEmailData {
  recipientName: string;
  redeemCode: string;
  topicName: string;
  portalUrl?: string;
}

export function bonusRedeemEmail(data: RedeemEmailData): { subject: string; htmlBody: string } {
  const subject = `KODE KURSUS TAMBAHAN KAMU!!!`;
  const portal = data.portalUrl || "https://app.iodacademy.id/portal-belajar/";

  const htmlBody = `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:#CC0000;padding:32px 40px;text-align:center;">
      <div style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">IODA ACADEMY &times; PLAN INDONESIA</div>
      <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:800;">Kursus Tambahan Siap!</h1>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <p style="color:#333;font-size:16px;margin:0 0 20px;">Halo <strong>${data.recipientName}</strong>,</p>
      <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 28px;">
        Selamat! Kamu telah memilih kursus tambahan <strong>${data.topicName}</strong>. 
        Berikut kode redeem untuk mengaksesnya di portal belajar IODA Academy.
      </p>

      <!-- Kode Redeem Box -->
      <div style="background:#fff5f5;border:2px dashed #CC0000;border-radius:12px;padding:28px;margin-bottom:32px;text-align:center;">
        <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">KODE REDEEM KAMU</div>
        <div style="font-size:32px;font-weight:900;color:#CC0000;letter-spacing:3px;font-family:'Courier New',monospace;">${data.redeemCode}</div>
        <div style="font-size:12px;color:#aaa;margin-top:10px;">Simpan kode ini baik-baik. Hanya bisa digunakan satu kali.</div>
      </div>

      <!-- Kursus yang Dipilih -->
      <div style="background:#f9f9f9;border-radius:12px;padding:20px;margin-bottom:28px;">
        <div style="font-size:11px;color:#CC0000;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">KURSUS PILIHAN</div>
        <div style="font-size:16px;font-weight:700;color:#222;">${data.topicName}</div>
        <div style="font-size:13px;color:#666;margin-top:4px;">Tersedia di portal belajar IODA Academy</div>
      </div>

      <!-- Cara Pakai -->
      <div style="margin-bottom:32px;">
        <div style="font-size:14px;font-weight:700;color:#333;margin-bottom:12px;">Cara Menggunakan Kode:</div>
        <table style="width:100%;">
          <tr>
            <td style="padding:6px 0;vertical-align:top;width:24px;">
              <div style="background:#CC0000;color:#fff;border-radius:50%;width:20px;height:20px;text-align:center;font-size:11px;font-weight:700;line-height:20px;">1</div>
            </td>
            <td style="padding:6px 0 6px 10px;font-size:14px;color:#555;">Klik tombol di bawah untuk membuka portal belajar</td>
          </tr>
          <tr>
            <td style="padding:6px 0;vertical-align:top;">
              <div style="background:#CC0000;color:#fff;border-radius:50%;width:20px;height:20px;text-align:center;font-size:11px;font-weight:700;line-height:20px;">2</div>
            </td>
            <td style="padding:6px 0 6px 10px;font-size:14px;color:#555;">Di halaman login, masukkan kode redeem kamu</td>
          </tr>
          <tr>
            <td style="padding:6px 0;vertical-align:top;">
              <div style="background:#CC0000;color:#fff;border-radius:50%;width:20px;height:20px;text-align:center;font-size:11px;font-weight:700;line-height:20px;">3</div>
            </td>
            <td style="padding:6px 0 6px 10px;font-size:14px;color:#555;">Akses materi kursus <strong>${data.topicName}</strong> langsung!</td>
          </tr>
        </table>
      </div>

      <!-- CTA -->
      <a href="${portal}" style="display:block;background:#CC0000;color:#ffffff;text-decoration:none;padding:16px 24px;border-radius:8px;font-weight:700;font-size:15px;text-align:center;margin-bottom:24px;">
        <img src="https://img.icons8.com/fluency-systems-regular/24/ffffff/external-link.png" width="16" style="vertical-align:middle;margin-right:6px;" alt="link">
        Buka Portal Belajar IODA Academy
      </a>

      <p style="color:#888;font-size:13px;line-height:1.6;margin:0;border-top:1px solid #eee;padding-top:24px;">
        Simpan email ini sebagai referensi. Jika ada pertanyaan, silakan hubungi admin melalui WhatsApp atau balas email ini.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#222;padding:24px 40px;text-align:center;">
      <div style="color:#ffffff;font-weight:700;font-size:14px;margin-bottom:4px;">IODA Academy</div>
      <div style="color:#aaa;font-size:12px;">Program Literasi Finansial · Plan Indonesia &times; DBS Foundation</div>
    </div>
  </div>
</body>
</html>`;

  return { subject, htmlBody };
}
