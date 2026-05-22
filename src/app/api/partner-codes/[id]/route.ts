/**
 * PATCH  /api/partner-codes/[id]  — edit kode mitra (admin)
 * DELETE /api/partner-codes/[id]  — hapus kode mitra (admin)
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
    const db = getAdminDb();
    const ref = db.collection("partnerCodes").doc(id);

    const allowed = ["partnerName","eventId","courseId","status","quota"];
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
    await getAdminDb().collection("partnerCodes").doc(id).delete();
    return json({ success: true });
  } catch (e) {
    return handleError(e);
  }
}
