/**
 * GET /api/partner-codes/[id]
 * Ambil data detail event B2B + daftar peserta lengkap dengan status tracking.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const db = getAdminDb();

    // 1. Ambil data event
    const eventDoc = await db.collection("events").doc(id).get();
    if (!eventDoc.exists) return json({ error: "Event not found" }, 404);
    const eventData = eventDoc.data() as any;

    // 2. Ambil semua user yang pakai partnerCode ini
    let userDocs: any[] = [];
    if (eventData.partnerCode) {
      const usersSnap = await db.collection("users")
        .where("partnerCode", "==", eventData.partnerCode)
        .get();
      userDocs = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
    }

    // 3. Ambil semua enrollments untuk event ini
    const enrollmentsSnap = await db.collection("enrollments")
      .where("eventId", "==", id)
      .get();

    const enrollmentMap: Record<string, any> = {};
    enrollmentsSnap.docs.forEach(d => {
      const data = d.data();
      enrollmentMap[data.userId] = { id: d.id, ...data };
    });

    // 4. Gabungkan data user + enrollment
    const participants = userDocs.map(user => {
      const enrollment = enrollmentMap[user.uid] || null;
      let assessmentPassed = false;
      let surveySubmitted = false;
      let certificateClaimed = false;

      if (enrollment) {
        certificateClaimed = !!(enrollment.status === "certified" || enrollment.certificateClaimed);
        if (enrollment.stepProgress) {
          Object.values(enrollment.stepProgress).forEach((sp: any) => {
            if (sp.assessmentResult?.passed) assessmentPassed = true;
            if (sp.surveyResult?.submitted) surveySubmitted = true;
          });
        }
      }

      return {
        uid: user.uid,
        namaLengkap: user.profileData?.namaLengkap || user.displayName || "-",
        email: user.email || "-",
        nomorWA: user.profileData?.nomorWA || "-",
        profileCompleted: !!user.profileCompleted,
        assessmentPassed,
        surveySubmitted,
        certificateClaimed,
        createdAt: user.createdAt,
      };
    });

    // Sort: yang paling baru daftar di atas
    participants.sort((a, b) => {
      const tA = a.createdAt?.toMillis?.() || 0;
      const tB = b.createdAt?.toMillis?.() || 0;
      return tB - tA;
    });

    return json({
      event: {
        id: eventDoc.id,
        name: eventData.name,
        campusName: eventData.campusName,
        partnerCode: eventData.partnerCode,
        status: eventData.status,
        startDate: eventData.startDate,
        endDate: eventData.endDate,
      },
      participants,
      stats: {
        registered: participants.length,
        assessed: participants.filter(p => p.assessmentPassed).length,
        surveyed: participants.filter(p => p.surveySubmitted).length,
        certified: participants.filter(p => p.certificateClaimed).length,
      }
    });
  } catch (e) {
    return handleError(e);
  }
}
