/**
 * Kirim email via Google Apps Script Web App
 * GAS endpoint menerima POST { to, subject, htmlBody } dan kirim via GmailApp
 */

const GAS_URL = process.env.GAS_EMAIL_WEBHOOK_URL || "";

export interface EmailPayload {
  to: string;
  subject: string;
  htmlBody: string;
}

/**
 * Panggil GAS Web App dengan action generik (mis. "submit_cv", "upload_cv").
 * GAS endpoint sama dengan email (GAS_EMAIL_WEBHOOK_URL). Mengembalikan JSON hasil.
 */
export async function callGAS<T = unknown>(payload: Record<string, unknown>): Promise<T> {
  if (!GAS_URL) {
    throw new Error("GAS_EMAIL_WEBHOOK_URL belum diset");
  }
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    // GAS balas via redirect ke script.googleusercontent.com — fetch ikut redirect otomatis.
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GAS error ${res.status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`GAS response bukan JSON: ${text.slice(0, 300)}`);
  }
}

export async function sendEmailViaGAS(payload: EmailPayload): Promise<void> {
  if (!GAS_URL) {
    console.warn("[email] GAS_EMAIL_WEBHOOK_URL belum diset — email tidak dikirim");
    return;
  }

  try {
    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[email] GAS error:", res.status, text);
    } else {
      console.log("[email] Terkirim ke:", payload.to);
    }
  } catch (err) {
    console.error("[email] Gagal kirim email:", err);
  }
}

/** Format ISO date ke "15 Juni 2026" */
export function formatDateID(isoDate: string): string {
  try {
    if (!isoDate) return "-";
    // Jika sudah ada 'T', biarkan. Jika cuma "YYYY-MM-DD", tambah "T00:00:00" biar zona waktu konsisten
    const dateStr = isoDate.includes("T") ? isoDate : `${isoDate}T00:00:00`;
    const d = new Date(dateStr);
    
    if (isNaN(d.getTime())) return isoDate; // Fallback jika format ngaco

    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}
