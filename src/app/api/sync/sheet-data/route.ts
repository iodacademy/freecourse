import { NextRequest } from "next/server";
import { requireSyncKey, json, handleError } from "@/lib/api-helpers";
import {
  aggregateDashboard,
  SHEET_HEADERS,
  studentToRow,
} from "@/lib/dashboard-aggregator";

export const dynamic = "force-dynamic";

/**
 * GET /api/sync/sheet-data
 * Untuk GAS time-driven trigger — return JSON terstruktur supaya GAS bisa
 * langsung paste ke Sheet:
 *   { headers: [...], rows: [[...], ...], generatedAt: "YYYY-MM-DD HH:MM" }
 * Auth: header X-Sync-Key (cek di settings.app.syncKey).
 */
export async function GET(req: NextRequest) {
  try {
    await requireSyncKey(req);

    const { students, generatedAt } = await aggregateDashboard({}, { includeStudents: true });
    const rows = students.map(studentToRow);

    return json({
      headers: Array.from(SHEET_HEADERS),
      rows,
      generatedAt,
      version: 1,
    });
  } catch (e) {
    return handleError(e);
  }
}
