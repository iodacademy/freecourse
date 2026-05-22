/**
 * GET    /api/events/[id]
 * PATCH  /api/events/[id]
 * DELETE /api/events/[id]
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const doc = await getAdminDb().collection("events").doc(id).get();
    if (!doc.exists) return json({ error: "Event not found" }, 404);
    return json({ id: doc.id, ...doc.data() });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const body = await req.json();
    const db = getAdminDb();
    const ref = db.collection("events").doc(id);

    const allowed = [
      "name","description","channelType","courseId","status",
      "startDate","endDate","campusName","partnerCode","bulkImportedEmails",
      "landingPageConfig","utmTracking","workshopConfig","customProfileFields",
    ];
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    for (const k of allowed) {
      if (body[k] !== undefined) update[k] = body[k];
    }

    await ref.update(update);
    const updated = await ref.get();
    return json({ id: updated.id, ...updated.data() });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    await getAdminDb().collection("events").doc(id).delete();
    return json({ success: true });
  } catch (e) {
    return handleError(e);
  }
}
