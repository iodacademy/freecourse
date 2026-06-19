import { NextRequest } from "next/server";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { groupPendingByDate } from "@/lib/dashboard-aggregator";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const bypassCache = req.nextUrl.searchParams.get("refresh") === "1";
    const groups = await groupPendingByDate(bypassCache);
    return json({ groups });
  } catch (e) {
    return handleError(e);
  }
}
