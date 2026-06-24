import { NextRequest } from "next/server";
import { json, handleError } from "@/lib/api-helpers";
import { rebuildStudentsIndex } from "@/lib/dashboard-aggregator";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET/POST /api/cron/rebuild-students-index
 *
 * Jaring pengaman: bangun ulang SELURUH collection `studentsIndex` +
 * `studentsMeta/detailChannels` dari sumber kebenaran (users + enrollments).
 * Menambal drift kalau ada upsert per-write yang gagal/terlewat. Idempoten.
 *
 * Biaya: 1x full-scan (~users+enrollments) per eksekusi → jadwalkan JARANG,
 * mis. tiap 6-12 jam via cron-job.org. JANGAN tiap menit.
 *
 * Auth: query ?key=ADMIN_ACCESS_CODE  ATAU header Authorization: Bearer <key>.
 */
async function run(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const queryKey = req.nextUrl.searchParams.get("key");
  const expectedKey = process.env.ADMIN_ACCESS_CODE || "ADMINFL26";
  if (authHeader !== `Bearer ${expectedKey}` && queryKey !== expectedKey) {
    return json({ error: "Unauthorized" }, 401);
  }
  const result = await rebuildStudentsIndex();
  return json({ success: true, ...result });
}

export async function GET(req: NextRequest) {
  try { return await run(req); } catch (e) { return handleError(e); }
}
export async function POST(req: NextRequest) {
  try { return await run(req); } catch (e) { return handleError(e); }
}
