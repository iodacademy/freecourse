/**
 * GET    /api/courses/[id]/steps/[stepId]
 * PATCH  /api/courses/[id]/steps/[stepId]
 * DELETE /api/courses/[id]/steps/[stepId]
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

type Ctx = { params: Promise<{ id: string; stepId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await requireAuth(req);
    const { stepId } = await params;
    const doc = await getAdminDb().collection("courseSteps").doc(stepId).get();
    if (!doc.exists) return json({ error: "Step not found" }, 404);
    return json({ id: doc.id, ...doc.data() });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { stepId } = await params;
    const body = await req.json();
    const db = getAdminDb();
    const ref = db.collection("courseSteps").doc(stepId);

    const allowed = ["title","order","video","companionType","assessment","survey"];
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
    const { id: courseId, stepId } = await params;
    const db = getAdminDb();
    await db.collection("courseSteps").doc(stepId).delete();

    // Update totalSteps
    const stepsCount = await db.collection("courseSteps")
      .where("courseId", "==", courseId).count().get();
    await db.collection("courses").doc(courseId).update({
      totalSteps: stepsCount.data().count,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return json({ success: true });
  } catch (e) {
    return handleError(e);
  }
}
