/**
 * PATCH  /api/bonus-courses/[id]
 * DELETE /api/bonus-courses/[id]
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const body = await req.json();
    const ref = getAdminDb().collection("bonusCourseTopics").doc(id);

    const allowed = ["name","description","classCode","portalUrl","status"];
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
    await getAdminDb().collection("bonusCourseTopics").doc(id).delete();
    return json({ success: true });
  } catch (e) {
    return handleError(e);
  }
}
