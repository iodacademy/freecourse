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
    const rawParam = req.nextUrl.searchParams.get("raw") === "1";
    const mode = (req.nextUrl.searchParams.get("mode") || (rawParam ? "raw" : "clean")) as
      | "clean"
      | "raw"
      | "mismatch";
    const { students, generatedAt } = await aggregateDashboard(filter, {
      includeStudents: true,
      // Clean: hanya Tersertifikasi, usia ≤29 & Jabodetabek.
      // Raw: Selesai + Tersertifikasi, semua daerah & semua usia.
      // Mismatch: Selesai + Tersertifikasi, non-Jabodetabek ATAU usia >29.
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
