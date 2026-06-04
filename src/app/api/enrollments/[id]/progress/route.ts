/**
 * POST /api/enrollments/[id]/progress
 * Memperbarui progress belajar (assessment/survey) dari suatu step.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const decoded = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    const { stepId, assessmentResult, surveyResult, isCompleted } = body;

    if (!stepId) return json({ error: "stepId required" }, 400);

    const db = getAdminDb();
    const ref = db.collection("enrollments").doc(id);
    const doc = await ref.get();

    if (!doc.exists) return json({ error: "Enrollment not found" }, 404);
    if (doc.data()?.email !== decoded.email) {
      return json({ error: "Forbidden" }, 403);
    }

    const currentProgress = doc.data()?.stepProgress || {};
    const stepData = currentProgress[stepId] || { completed: false, completedAt: null };

    // Update assessment
    if (assessmentResult) {
      const prevResult = stepData.assessmentResult || {};
      const newScore = assessmentResult.score ?? 0;
      const kkm = assessmentResult.kkm ?? 60;
      const isNewlyPassing = newScore >= kkm;
      const alreadyPassed = prevResult.passed === true || prevResult.firstPassScore != null;

      // Jika sudah pernah lulus, TOLAK update (kuis terkunci)
      if (alreadyPassed) {
        return json({ error: "Kuis sudah selesai dan terkunci." }, 403);
      }

      stepData.assessmentResult = {
        ...prevResult,
        ...assessmentResult,
        lastAttemptAt: FieldValue.serverTimestamp(),
        // Kumulatif attempts
        attempts: (prevResult.attempts || 0) + 1,
        totalAttempts: (prevResult.totalAttempts || 0) + 1,
        // firstPassScore: hanya disimpan sekali, saat pertama kali nilainya >= KKM
        ...(isNewlyPassing && !prevResult.firstPassScore
          ? { firstPassScore: newScore, passed: true }
          : {}),
      };
    }

    // Update survey
    if (surveyResult) {
      stepData.surveyResult = {
        ...stepData.surveyResult,
        ...surveyResult,
        submittedAt: FieldValue.serverTimestamp(),
      };
    }

    // Status penyelesaian step
    if (isCompleted) {
      stepData.completed = true;
      stepData.completedAt = stepData.completedAt || FieldValue.serverTimestamp();
    }

    const updates: Record<string, any> = {
      [`stepProgress.${stepId}`]: stepData,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Update currentStep jika pindah ke step berikutnya
    if (body.nextStepNumber && body.nextStepNumber > (doc.data()?.currentStep || 0)) {
      updates.currentStep = body.nextStepNumber;
    }

    // Cek apakah SEMUA step sudah selesai → update status ke "completed"
    if (isCompleted) {
      const allProgress = {
        ...doc.data()?.stepProgress,
        [stepId]: { ...stepData, completed: true },
      };

      // Ambil total step dari courseSteps
      const courseId = doc.data()?.courseId;
      const stepsSnap = await db.collection("courseSteps")
        .where("courseId", "==", courseId)
        .get();
      const totalCourseSteps = stepsSnap.size;

      const completedCount = Object.values(allProgress).filter(
        (p: any) => p?.completed === true
      ).length;

      if (totalCourseSteps > 0 && completedCount >= totalCourseSteps) {
        // Semua step selesai — update status ke "completed"
        // currentStep TIDAK diubah agar redirect di /learn tetap ke step terakhir yang benar
        updates.status = "completed";
      } else {
        updates.status = "in_progress";
      }
    } else {
      // Tidak ada perubahan selesai, pertahankan status atau set in_progress
      updates.status = doc.data()?.status === "completed" || doc.data()?.status === "certified"
        ? doc.data()?.status
        : "in_progress";
    }

    await ref.update(updates);
    
    const updated = await ref.get();
    return json(updated.data());
  } catch (e) {
    return handleError(e);
  }
}
