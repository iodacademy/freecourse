/**
 * GET /api/students
 * Ambil daftar siswa untuk admin, dengan fitur pencarian dan filter.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const channelSource = searchParams.get("channelSource");
    const eventId = searchParams.get("eventId");
    
    const db = getAdminDb();
    let query = db.collection("users").where("role", "==", "student");
    
    if (channelSource) query = query.where("channelSource", "==", channelSource);
    if (eventId) query = query.where("eventId", "==", eventId);

    // Limit untuk menghindari load terlalu berat
    query = query.orderBy("createdAt", "desc").limit(100);

    const snap = await query.get();
    return json(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
  } catch (e) {
    return handleError(e);
  }
}
