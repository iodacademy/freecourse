import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError, requireSuperAdmin } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET  /api/admin/diagnostics/gas   (Super Admin) — cek konfigurasi GAS.
 * POST /api/admin/diagnostics/gas   (Super Admin) — kirim payload UJI ke GAS dan
 *                                    kembalikan status + cuplikan respons mentah.
 *
 * Tujuan: mendiagnosis kenapa generate PDF sertifikat gagal — apakah karena
 * konfigurasi (URL/template kosong/salah) atau script GAS-nya sendiri error.
 *
 * POST body opsional: { dryRun?: boolean }
 *   dryRun (default true) → kirim action "ping" agar GAS TIDAK benar-benar
 *   membuat sertifikat; hanya menguji apakah Web App merespons JSON.
 *
 * Auth: Authorization: Bearer <kode super admin>.
 */

function mask(url: string): string {
  if (!url) return "(kosong)";
  try {
    const u = new URL(url);
    const id = u.pathname.match(/\/s\/([^/]+)\//)?.[1] || u.pathname;
    return `${u.origin}/.../${String(id).slice(0, 8)}…/exec`;
  } catch {
    return url.slice(0, 24) + "…";
  }
}

async function getSettings() {
  const db = getAdminDb();
  const doc = await db.collection("settings").doc("app").get();
  const s = doc.data() || {};
  return {
    gasWebAppUrl: (s.gasWebAppUrl as string) || "",
    mainCertSlideTemplateId: (s.mainCertSlideTemplateId as string) || "",
    mainCertTitle: (s.mainCertTitle as string) || "",
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const s = await getSettings();
    return json({
      success: true,
      config: {
        gasWebAppUrl_set: !!s.gasWebAppUrl,
        gasWebAppUrl_preview: mask(s.gasWebAppUrl),
        gasWebAppUrl_looksValid: /^https:\/\/script\.google\.com\/.*\/exec$/.test(s.gasWebAppUrl),
        templateId_set: !!s.mainCertSlideTemplateId,
        templateId_preview: s.mainCertSlideTemplateId
          ? s.mainCertSlideTemplateId.slice(0, 8) + "…"
          : "(kosong)",
        certTitle: s.mainCertTitle || "(default)",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false; // default true

    const s = await getSettings();
    if (!s.gasWebAppUrl) {
      return json({ success: false, stage: "config", error: "gasWebAppUrl belum disetel di Pengaturan." });
    }

    // Payload uji. dryRun → action "ping" (GAS tidak membuat file).
    const payload = dryRun
      ? { action: "ping" }
      : {
          action: "generate_main_cert",
          templateId: s.mainCertSlideTemplateId,
          certId: `TEST-${new Date().getFullYear()}-DIAG01`,
          userName: "Tes Diagnostik",
          courseName: s.mainCertTitle || "Workshop Literasi Finansial",
          claimDate: "1 January 2026",
          email: "diagnostic@iodacademy.id",
        };

    let status = 0;
    let bodyText = "";
    let fetchError = "";
    const startedAt = Date.now();
    try {
      const res = await fetch(s.gasWebAppUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "follow",
      });
      status = res.status;
      bodyText = await res.text();
    } catch (e: any) {
      fetchError = e?.message || String(e);
    }
    const ms = Date.now() - startedAt;

    // Analisis cepat
    const snippet = bodyText.slice(0, 400).replace(/\s+/g, " ").trim();
    const looksHtml = /^<!doctype html|^<html|<title>/i.test(bodyText.trim());
    let parsed: any = null;
    try { parsed = bodyText ? JSON.parse(bodyText) : null; } catch {}

    let verdict = "unknown";
    if (fetchError) verdict = "fetch_error (URL salah / tidak bisa dijangkau)";
    else if (status === 401 || status === 403) verdict = "akses ditolak (deploy GAS bukan 'Anyone' / butuh login)";
    else if (looksHtml) verdict = "GAS balas HTML (kemungkinan URL deploy lama / butuh login / minta otorisasi)";
    else if (parsed) verdict = parsed.error ? "GAS error (lihat field error)" : "GAS merespons JSON (sehat)";
    else if (status >= 500) verdict = "GAS error 5xx (script melempar exception)";

    return json({
      success: !fetchError && status === 200 && !!parsed && !parsed?.error,
      dryRun,
      durationMs: ms,
      httpStatus: status,
      fetchError: fetchError || undefined,
      looksHtml,
      parsedJson: parsed || undefined,
      responseSnippet: snippet,
      verdict,
    });
  } catch (e) {
    return handleError(e);
  }
}
