/**
 * GET    /api/courses/[id]  — detail kursus
 * PATCH  /api/courses/[id]  — edit kursus (admin)
 * DELETE /api/courses/[id]  — hapus kursus (admin)
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const doc = await getAdminDb().collection("courses").doc(id).get();
    if (!doc.exists) return json({ error: "Course not found" }, 404);
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
    const ref = db.collection("courses").doc(id);

    const allowed = [
      "title","description","thumbnail","isMainCourse","status",
      "certificateConfig","bonusCourseEnabled",
    ];
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    for (const k of allowed) {
      if (body[k] !== undefined) update[k] = body[k];
    }

    await ref.update(update);

    // Jika set sebagai main course, unset yang lain
    if (body.isMainCourse === true) {
      const others = await db.collection("courses")
        .where("isMainCourse", "==", true).get();
      const batch = db.batch();
      others.docs.forEach((d) => {
        if (d.id !== id) batch.update(d.ref, { isMainCourse: false });
      });
      await batch.commit();
    }

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
    const db = getAdminDb();
    // Hapus semua steps terkait
    const steps = await db.collection("courseSteps")
      .where("courseId", "==", id).get();
    const batch = db.batch();
    steps.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection("courses").doc(id));
    await batch.commit();
    return json({ success: true });
  } catch (e) {
    return handleError(e);
  }
}
