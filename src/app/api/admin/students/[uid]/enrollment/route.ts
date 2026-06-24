/**
 * PATCH /api/admin/students/[uid]/enrollment
 * Admin dapat mengedit data enrollment siswa:
 * - Nilai quiz (stepProgress.{stepId}.assessmentResult.score)
 * - currentStep
 *
 * Perubahan ini langsung mempengaruhi eligibility klaim sertifikat siswa.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { invalidateDashboardCache } from "@/lib/dashboard-aggregator";
import { syncStudentIndex } from "@/lib/sync-student-index";

type Ctx = { params: Promise<{ uid: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { uid } = await params;

    const body = await req.json();
    const { enrollmentId, quizStepId, newScore, currentStep } = body;

    if (!enrollmentId) {
      return json({ error: "enrollmentId diperlukan" }, 400);
    }

    const db = getAdminDb();
    const enrollRef = db.collection("enrollments").doc(enrollmentId);
    const enrollDoc = await enrollRef.get();

    if (!enrollDoc.exists) {
      return json({ error: "Enrollment tidak ditemukan" }, 404);
    }

    const enrollData = enrollDoc.data()!;

    // Pastikan enrollment ini milik user yang dimaksud
    if (enrollData.userId !== uid) {
      return json({ error: "Enrollment tidak sesuai dengan user ini" }, 403);
    }

    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    // Update nilai quiz jika diberikan
    if (quizStepId && newScore !== undefined) {
      const score = Number(newScore);
      if (isNaN(score) || score < 0 || score > 100) {
        return json({ error: "Nilai quiz harus antara 0 dan 100" }, 400);
      }

      const existingProgress = enrollData.stepProgress?.[quizStepId] || {};
      updates[`stepProgress.${quizStepId}`] = {
        ...existingProgress,
        assessmentResult: {
          ...(existingProgress.assessmentResult || {}),
          score,
          firstPassScore: score,
          // Tandai bahwa ini diedit oleh admin
          editedByAdmin: true,
          editedAt: new Date().toISOString(),
        },
      };
    }

    // Update currentStep jika diberikan
    if (currentStep !== undefined) {
      const step = Number(currentStep);
      if (!isNaN(step) && step >= 0) {
        updates.currentStep = step;
      }
    }

    await enrollRef.update(updates);

    invalidateDashboardCache();
    syncStudentIndex(uid);

    return json({
      success: true,
      message: "Data enrollment berhasil diperbarui",
    });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * GET /api/admin/students/[uid]/enrollment
 * Ambil data enrollment aktif siswa (untuk pre-fill form edit)
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { uid } = await params;

    const db = getAdminDb();

    // Ambil settings untuk tahu mainCourseId
    const settingsDoc = await db.collection("settings").doc("app").get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    const mainCourseId = (settings as any)?.mainCourseId || "course-main";

    // Cari enrollment siswa untuk main course
    const enrollSnap = await db
      .collection("enrollments")
      .where("userId", "==", uid)
      .where("courseId", "==", mainCourseId)
      .limit(1)
      .get();

    if (enrollSnap.empty) {
      return json({ enrollment: null });
    }

    const doc = enrollSnap.docs[0];
    const data = doc.data();

    // Ambil course steps untuk tahu step mana yang punya quiz
    const stepsSnap = await db
      .collection("courseSteps")
      .where("courseId", "==", mainCourseId)
      .get();

    const steps = stepsSnap.docs.map((d) => ({
      id: d.id,
      order: (d.data() as any).order ?? 0,
      title: (d.data() as any).title || "",
      hasAssessment: !!(d.data() as any).hasAssessment,
      kkm: (d.data() as any).assessment?.kkm ?? null,
      currentScore: data.stepProgress?.[d.id]?.assessmentResult?.score ?? null,
    })).sort((a, b) => a.order - b.order);

    return json({
      enrollment: {
        id: doc.id,
        courseId: data.courseId,
        currentStep: data.currentStep ?? 1,
        certificateClaimed: data.certificateClaimed ?? false,
        steps,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
