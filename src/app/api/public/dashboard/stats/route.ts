import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";
import { aggregateDashboard, parseFilterFromSearchParams } from "@/lib/dashboard-aggregator";

export const dynamic = "force-dynamic";

// Simple in-memory rate limit (per process)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30; // 30 request per IP per menit
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

    // Validasi token
    const db = getAdminDb();
    const settingsDoc = await db.collection("settings").doc("app").get();
    const settings = (settingsDoc.exists ? settingsDoc.data() : {}) || {};
    const expected = (settings.publicDashboardToken as string) || "";
    const enabled = settings.publicDashboardEnabled === true;
    if (!enabled || !expected || token !== expected) {
      return json({ error: "Not found" }, 404);
    }

    const filter = parseFilterFromSearchParams(req.nextUrl.searchParams);
    const result = await aggregateDashboard(filter, { includeStudents: false, cleanOnly: true });

    // Return tanpa students (privasi)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Cache 5 menit di browser + CDN
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
