/**
 * GET /api/public/mitra/stats?token=xxxx
 * Dashboard publik KHUSUS satu mitra (event B2B). Divalidasi lewat token unik
 * yang tersimpan di dokumen event (field `dashboardToken`). Data difilter otomatis
 * ke partnerCode milik mitra tsb — mitra hanya melihat pesertanya sendiri.
 *
 * Tanpa students (privasi). Mengembalikan stats + nama mitra.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";
import { aggregateDashboard } from "@/lib/dashboard-aggregator";

export const dynamic = "force-dynamic";

// Rate limit sederhana per-proses (per IP).
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const rateMap = new Map<string, { count: number; windowStart: number }>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  const e = rateMap.get(ip);
  if (!e || now - e.windowStart > RATE_WINDOW_MS) {
    rateMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (e.count >= RATE_MAX) return false;
  e.count++;
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const token = (req.nextUrl.searchParams.get("token") || "").trim();
    if (!token) return json({ error: "Not found" }, 404);

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (!checkRate(ip)) return json({ error: "Too many requests" }, 429);

    const db = getAdminDb();
    // Cari event B2B berdasarkan dashboardToken.
    const snap = await db
      .collection("events")
      .where("dashboardToken", "==", token)
      .limit(1)
      .get();
    if (snap.empty) return json({ error: "Not found" }, 404);

    const ev = snap.docs[0].data() as any;
    const partnerCode = ev.partnerCode || "";
    if (!partnerCode) return json({ error: "Not found" }, 404);

    // Aggregate difilter ke partnerCode mitra ini. Tanpa students (privasi).
    const result = await aggregateDashboard(
      { source: partnerCode },
      { includeStudents: false }
    );

    return new Response(
      JSON.stringify({
        ...result,
        mitra: {
          name: ev.campusName || ev.name || "Mitra",
          partnerCode,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      }
    );
  } catch (e) {
    return handleError(e);
  }
}
