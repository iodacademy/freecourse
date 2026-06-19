import { NextRequest } from "next/server";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { aggregateDashboard, parseFilterFromSearchParams, DashboardResult } from "@/lib/dashboard-aggregator";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    
    const filter = parseFilterFromSearchParams(req.nextUrl.searchParams);
    const bypassCache = req.nextUrl.searchParams.get("refresh") === "1";
    // Dashboard hanya butuh `stats` (DashboardView tidak merender students) →
    // includeStudents:false agar payload kecil & cepat.
    const result = await aggregateDashboard(filter, { includeStudents: false, bypassCache });

    return json(result);
  } catch (e) {
    return handleError(e);
  }
}
