/**
 * GET  /api/courses/[id]/steps  — list steps sebuah kursus (urut order)
 * POST /api/courses/[id]/steps  — tambah step baru (admin)
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
    const snap = await getAdminDb()
      .collection("courseSteps")
      .where("courseId", "==", id)
      .orderBy("order", "asc")
      .get();
    return json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { id: courseId } = await params;
    const body = await req.json();
    const db = getAdminDb();

    // Tentukan order: max order yang ada + 1
    const existing = await db.collection("courseSteps")
      .where("courseId", "==", courseId)
      .orderBy("order", "desc")
      .limit(1)
      .get();
    const nextOrder = existing.empty ? 1 : (existing.docs[0].data().order ?? 0) + 1;

    const data = {
      courseId,
      order: body.order ?? nextOrder,
      title: body.title ?? "Materi Baru",
      video: body.video ?? { youtubeId: "", url: "", duration: 0 },
      companionType: body.companionType ?? "assessment",
      assessment: body.assessment ?? null,
      survey: body.survey ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("courseSteps").add(data);

    // Update totalSteps di course
    const stepsCount = await db.collection("courseSteps")
      .where("courseId", "==", courseId).count().get();
    await db.collection("courses").doc(courseId).update({
      totalSteps: stepsCount.data().count,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return json({ id: ref.id, ...data }, 201);
  } catch (e) {
    return handleError(e);
  }
}
