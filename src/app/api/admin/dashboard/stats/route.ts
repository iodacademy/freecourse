import { NextRequest } from "next/server";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { aggregateDashboard, parseFilterFromSearchParams, DashboardResult } from "@/lib/dashboard-aggregator";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    
    const filter = parseFilterFromSearchParams(req.nextUrl.searchParams);
    const result = await aggregateDashboard(filter, { includeStudents: true });
    
    return json(result);
  } catch (e) {
    return handleError(e);
  }
}
