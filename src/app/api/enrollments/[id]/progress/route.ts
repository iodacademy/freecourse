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
      stepData.assessmentResult = {
        ...stepData.assessmentResult,
        ...assessmentResult,
        lastAttemptAt: FieldValue.serverTimestamp(),
      };
      if (!stepData.assessmentResult.attempts) stepData.assessmentResult.attempts = 1;
      else stepData.assessmentResult.attempts += 1;
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
      status: "in_progress"
    };

    // Update currentStep jika pindah ke step berikutnya
    if (body.nextStepNumber && body.nextStepNumber > (doc.data()?.currentStep || 0)) {
      updates.currentStep = body.nextStepNumber;
    }

    await ref.update(updates);
    
    const updated = await ref.get();
    return json(updated.data());
  } catch (e) {
    return handleError(e);
  }
}
