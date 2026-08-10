import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { getAdminDb } from "@/lib/firebase-admin";
import { handleError, json } from "@/lib/api-helpers";
import {
  aggregateDashboard,
  parseFilterFromSearchParams,
  SHEET_HEADERS,
  studentToRow,
} from "@/lib/dashboard-aggregator";
import { buildExportRecord, resolveExportMode } from "@/lib/dashboard-export-history";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

// Simple in-memory rate limit (per process)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10; // 10 export per IP per menit (lebih ketat dari view stats)
const rateMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") || "";
    if (!token) return json({ error: "Token required" }, 404);

    // Cek IP rate limit
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (!checkRateLimit(ip)) {
      return json({ error: "Too many requests" }, 429);
    }

    // Validasi token publik
    const db = getAdminDb();
    const settingsDoc = await db.collection("settings").doc("app").get();
    const settings = (settingsDoc.exists ? settingsDoc.data() : {}) || {};
    const expected = (settings.publicDashboardToken as string) || "";
    const enabled = settings.publicDashboardEnabled === true;
    if (!enabled || !expected || token !== expected) {
      return json({ error: "Not found" }, 404);
    }

    // Terapkan filter dan generate data (termasuk students list karena disetel ke true)
    const filter = parseFilterFromSearchParams(req.nextUrl.searchParams);
    // mode: clean (default) | raw | mismatch. Param lama ?raw=1 tetap didukung.
    // Divalidasi lewat resolveExportMode, bukan sekadar di-cast — nilai ini
    // mengalir sampai ke header Content-Disposition, dan string sembarang
    // (termasuk yang mengandung CRLF) akan membuat Response melempar error
    // SETELAH berkas terlanjur diunggah ke Drive.
    //
    // Validated via resolveExportMode, not merely cast — this value flows
    // all the way to the Content-Disposition header, and an arbitrary
    // string (including one containing CRLF) would make Response throw
    // AFTER the file has already been uploaded to Drive.
    const rawParam = req.nextUrl.searchParams.get("raw") === "1";
    const mode = resolveExportMode({ modeParam: req.nextUrl.searchParams.get("mode"), rawParam });
    const { students, generatedAt } = await aggregateDashboard(filter, {
      includeStudents: true,
      // Clean: hanya Tersertifikasi, di area program (Jabodetabek/Medan/Surabaya)
      //        & usia memenuhi syarat (≤29 th; ≤35 th untuk penyandang disabilitas).
      // Raw: Selesai + Tersertifikasi, semua daerah & semua usia.
      // Mismatch: Selesai + Tersertifikasi, di luar area program ATAU usia lewat batas.
      // Pemilihan area (?areas=) sengaja TIDAK diekspos di dashboard publik.
      rawExport: mode === "raw",
      mismatchExport: mode === "mismatch",
      exportOnlyCertified: mode === "clean",
      cleanExport: mode === "clean",
    });

    // Menyusun baris excel
    const rows = students.map(studentToRow);
    const aoa: (string | number)[][] = [Array.from(SHEET_HEADERS), ...rows];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Lebar Kolom
    ws["!cols"] = SHEET_HEADERS.map((h) => ({ wch: Math.max(12, h.length + 2) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Dashboard");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `dashboard-publik-${mode}-${generatedAt.replace(/[: ]/g, "-")}.xlsx`;

    // Simpan berkas ke Drive & catat riwayat. Seluruhnya ditelan bila gagal:
    // riwayat itu fitur sekunder, tidak boleh menjatuhkan unduhan pengunjung.
    // Sengaja di-`await` — pada serverless, pekerjaan yang belum selesai saat
    // respons dikirim bisa dimatikan, dan riwayat justru hilang pada ekspor
    // besar yang paling ingin dicatat.
    //
    // Store the file to Drive and record the history. Fully swallowed on
    // failure: history is a secondary feature and must never break a
    // visitor's download. Deliberately awaited — on serverless, work still
    // pending when the response is sent can be killed, losing exactly the
    // large exports most worth recording.
    try {
      let driveFileId = "";
      let storeError = "";
      const gasWebAppUrl: string = (settings.gasWebAppUrl as string) || "";

      if (!gasWebAppUrl) {
        storeError = "gasWebAppUrl belum dikonfigurasi";
      } else {
        const gasRes = await fetch(gasWebAppUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "store_dashboard_export",
            // Wajib: GAS menolak dua action ekspor tanpa secret yang cocok.
            // Required: GAS rejects the two export actions without a matching secret.
            secret: (settings.dashboardExportSecret as string) || "",
            fileBase64: Buffer.from(buf as Uint8Array).toString("base64"),
            filename,
          }),
        });
        const gasData = await gasRes.json().catch(() => ({}));
        if (gasData?.success && gasData.fileId) driveFileId = String(gasData.fileId);
        else storeError = String(gasData?.error || `GAS HTTP ${gasRes.status}`);
      }

      await db.collection("dashboardExports").add({
        ...buildExportRecord({ mode, filter: filter as unknown as Record<string, unknown>, rowCount: rows.length, filename, driveFileId, storeError }),
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch {
      // Diabaikan dengan sengaja / Deliberately ignored
    }

    return new Response(buf as any, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
