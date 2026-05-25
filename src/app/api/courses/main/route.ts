import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

const MAIN_COURSE_ID = "course-main";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const db = getAdminDb();

    const courseRef = db.collection("courses").doc(MAIN_COURSE_ID);

    // Parallel fetch: course + settings + steps
    const [courseDoc, settingsDoc, stepsSnap] = await Promise.all([
      courseRef.get(),
      db.collection("settings").doc("app").get(),
      db.collection("courseSteps")
        .where("courseId", "==", MAIN_COURSE_ID)
        .get(),
    ]);

    // Handle missing course
    let courseData: any;
    if (!courseDoc.exists) {
      const defaultCourse = {
        title: "Literasi Finansial Dasar",
        description: "Modul pembelajaran literasi keuangan dasar.",
        thumbnail: "",
        totalSteps: 0,
        isMainCourse: true,
        status: "published",
        certificateConfig: {
          googleSlideTemplateId: "",
          issuerName: "IODA Academy",
          signerName: "",
          signerTitle: "",
        },
        bonusCourseEnabled: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      await courseRef.set(defaultCourse);
      const freshDoc = await courseRef.get();
      courseData = { id: freshDoc.id, ...freshDoc.data() };
    } else {
      courseData = { id: courseDoc.id, ...courseDoc.data() };
    }

    // Merge settings
    if (settingsDoc.exists) {
      const settingsData = settingsDoc.data() || {};
      if (settingsData.mainCertTitle) {
        courseData.mainCertTitle = settingsData.mainCertTitle;
      }
    }

    // Process steps
    const steps = stepsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    steps.sort((a: any, b: any) => (a.order as number) - (b.order as number));

    return json({ course: courseData, steps });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const { steps } = body;
    const db = getAdminDb();
    
    if (!Array.isArray(steps)) {
      return json({ error: "steps must be an array" }, 400);
    }

    // Ambil semua step lama
    const existingStepsSnap = await db.collection("courseSteps")
      .where("courseId", "==", MAIN_COURSE_ID)
      .get();

    const batch = db.batch();

    // Map existing IDs
    const existingIds = new Set(existingStepsSnap.docs.map(d => d.id));
    const newIds = new Set(steps.map(s => s.id).filter(id => Boolean(id)));

    // Hapus yang ada di database tapi tidak ada di payload baru
    existingStepsSnap.docs.forEach(doc => {
      if (!newIds.has(doc.id)) {
        batch.delete(doc.ref);
      }
    });

    // Update / Set payload baru
    steps.forEach((step, index) => {
      const stepId = step.id || db.collection("courseSteps").doc().id;
      const stepRef = db.collection("courseSteps").doc(stepId);
      
      const stepData = {
        ...step,
        courseId: MAIN_COURSE_ID,
        order: index + 1,
        updatedAt: FieldValue.serverTimestamp(),
      };
      delete stepData.id;

      if (!existingIds.has(stepId)) {
        stepData.createdAt = FieldValue.serverTimestamp();
      }

      batch.set(stepRef, stepData, { merge: true });
    });

    // Update totalSteps di Course
    const courseRef = db.collection("courses").doc(MAIN_COURSE_ID);
    batch.update(courseRef, { 
      totalSteps: steps.length,
      updatedAt: FieldValue.serverTimestamp() 
    });

    await batch.commit();

    return json({ success: true, message: "Course saved successfully" });
  } catch (e) {
    return handleError(e);
  }
}
