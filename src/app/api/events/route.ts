/**
 * GET  /api/events  — daftar events (admin)
 * POST /api/events  — buat event baru (admin)
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const channelType = searchParams.get("channelType");
    const db = getAdminDb();
    let query = db.collection("events").orderBy("createdAt", "desc") as FirebaseFirestore.Query;
    if (channelType) query = query.where("channelType", "==", channelType);
    const snap = await query.get();
    return json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const db = getAdminDb();

    const data = {
      name: body.name ?? "Event Baru",
      description: body.description ?? "",
      channelType: body.channelType ?? "b2c_ads",
      courseId: body.courseId ?? "",
      status: body.status ?? "draft",
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      // Channel 1
      campusName: body.campusName ?? null,
      partnerCode: body.partnerCode ?? null,
      bulkImportedEmails: body.bulkImportedEmails ?? [],
      // Channel 2
      landingPageConfig: body.landingPageConfig ?? null,
      utmTracking: body.utmTracking ?? false,
      // Channel 3
      workshopConfig: body.workshopConfig ?? null,
      customProfileFields: body.customProfileFields ?? [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("events").add(data);
    return json({ id: ref.id, ...data }, 201);
  } catch (e) {
    return handleError(e);
  }
}
