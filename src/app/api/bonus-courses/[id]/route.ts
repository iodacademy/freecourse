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

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (body.name !== undefined)       update.name       = body.name;
    if (body.category !== undefined)   update.category   = body.category;
    if (body.benefitType !== undefined) update.benefitType = body.benefitType;
    if (body.classCode !== undefined)  update.classCode  = String(body.classCode).toUpperCase();
    if (body.Kode_Basis !== undefined) update.Kode_Basis = String(body.Kode_Basis).toUpperCase();
    if (body.description !== undefined) update.description = body.description;
    if (body.groupLink !== undefined)  update.groupLink  = body.groupLink;
    if (body.lastSessionDate !== undefined) update.lastSessionDate = body.lastSessionDate;
    if (body.portalUrl !== undefined)  update.portalUrl  = body.portalUrl;
    if (body.workshopData !== undefined) update.workshopData = body.workshopData;
    if (body.downloadUrl !== undefined) update.downloadUrl = body.downloadUrl;
    if (body.status !== undefined)     update.status     = body.status;

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
