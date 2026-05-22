/**
 * GET  /api/courses      — daftar semua kursus
 * POST /api/courses      — buat kursus baru (admin only)
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const db = getAdminDb();
    const snap = await db.collection("courses").orderBy("createdAt", "desc").get();
    const courses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return json(courses);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const db = getAdminDb();

    const data = {
      title: body.title ?? "Kursus Baru",
      description: body.description ?? "",
      thumbnail: body.thumbnail ?? "",
      totalSteps: 0,
      isMainCourse: body.isMainCourse ?? false,
      status: body.status ?? "draft",
      certificateConfig: body.certificateConfig ?? {
        googleSlideTemplateId: "",
        issuerName: "IODA Academy",
        signerName: "",
        signerTitle: "",
      },
      bonusCourseEnabled: body.bonusCourseEnabled ?? false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("courses").add(data);
    return json({ id: ref.id, ...data }, 201);
  } catch (e) {
    return handleError(e);
  }
}
