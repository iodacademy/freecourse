import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/dashboard/mapping-options
 * Return list step + question dari course utama, untuk dropdown di settings.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();

    const settingsDoc = await db.collection("settings").doc("app").get();
    const settings = (settingsDoc.exists ? settingsDoc.data() : {}) || {};
    const mainCourseId = settings.mainCourseId || "course-main";

    // Cari course utama
    const coursesSnap = await db.collection("courses").get();
    const mainCourseDoc = coursesSnap.docs.find((d) => d.id === mainCourseId)
      || coursesSnap.docs.find((d) => (d.data() as any).isMainCourse === true)
      || coursesSnap.docs[0]; // FALLBACK ke course pertama jika tidak ditemukan

    if (!mainCourseDoc) {
      return json({ steps: [], questions: [] });
    }

    const stepsSnap = await db
      .collection("courseSteps")
      .where("courseId", "==", mainCourseDoc.id)
      .get();

    const rawDocs = stepsSnap.docs;
    // Sort in memory to avoid requiring a composite index in Firestore
    rawDocs.sort((a, b) => {
      const orderA = (a.data() as any).order || 0;
      const orderB = (b.data() as any).order || 0;
      return orderA - orderB;
    });

    const steps: any[] = [];
    const questions: any[] = [];

    rawDocs.forEach((d, idx) => {
      const data = d.data() as any;
      const stepLabel = `Step ${data.order || idx + 1} — ${data.title || d.id}`;
      steps.push({
        id: d.id,
        order: data.order || idx + 1,
        title: data.title || "",
        label: stepLabel,
        hasAssessment: !!data.hasAssessment,
        kkm: data.assessment?.kkm || null,
        questionCount: data.assessment?.questions?.length || 0,
      });
      const surveyQuestions = data.survey?.questions || [];
      for (const q of surveyQuestions) {
        questions.push({
          id: q.id,
          text: q.text,
          type: q.type,
          stepId: d.id,
          stepTitle: data.title || "",
          label: `[Step ${data.order || idx + 1}] ${q.text}`,
        });
      }
    });

    return json({ steps, questions });
  } catch (e) {
    return handleError(e);
  }
}
