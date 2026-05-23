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

    // 1. Ambil data event & course steps
    const eventDoc = await db.collection("events").doc(id).get();
    if (!eventDoc.exists) return json({ error: "Event not found" }, 404);
    const eventData = eventDoc.data() as any;

    const courseId = eventData.courseId || "course-main";
    const courseStepsSnap = await db.collection("courseSteps").where("courseId", "==", courseId).get();
    const courseSteps = courseStepsSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const stepMeta = courseSteps.map((s: any) => ({ id: s.id, title: s.title }));

    // 2. Ambil semua user yang pakai partnerCode ini
    let userDocs: any[] = [];
    if (eventData.partnerCode) {
      const usersSnap = await db.collection("users")
        .where("partnerCode", "==", eventData.partnerCode)
        .get();
      userDocs = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
    }

    // 3. Ambil data enrollment untuk user-user ini (chunk by 30)
    const enrollmentMap: Record<string, any> = {};
    if (userDocs.length > 0) {
      const userIds = userDocs.map(u => u.uid);
      const chunkSize = 30;
      for (let i = 0; i < userIds.length; i += chunkSize) {
        const chunk = userIds.slice(i, i + chunkSize);
        const enrollmentsSnap = await db.collection("enrollments")
          .where("userId", "in", chunk)
          .where("courseId", "==", courseId)
          .get();
        
        enrollmentsSnap.docs.forEach(d => {
          const data = d.data();
          enrollmentMap[data.userId] = { id: d.id, ...data };
        });
      }
    }

    // 4. Gabungkan data user + enrollment
    const participants = userDocs.map(user => {
      const enrollment = enrollmentMap[user.uid] || null;
      let certificateClaimed = false;
      const progress: Record<string, boolean> = {};

      if (enrollment) {
        certificateClaimed = !!(enrollment.status === "certified" || enrollment.certificateClaimed);
        if (enrollment.stepProgress) {
          stepMeta.forEach((step: any) => {
            const sp = enrollment.stepProgress[step.id];
            progress[step.id] = !!(sp && sp.completed);
          });
        }
      }

      return {
        uid: user.uid,
        namaLengkap: user.profileData?.nama_lengkap || user.profileData?.namaLengkap || user.displayName || "-",
        email: user.email || "-",
        nomorWA: user.profileData?.nomor_whatsapp || user.profileData?.nomorWA || "-",
        profileCompleted: !!user.profileCompleted,
        certificateClaimed,
        progress,
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
      courseSteps: stepMeta,
      participants,
      stats: {
        registered: participants.filter(p => p.profileCompleted).length,
        inProgress: participants.filter(p => p.profileCompleted && !p.certificateClaimed).length,
        certified: participants.filter(p => p.certificateClaimed).length,
      }
    });
  } catch (e) {
    return handleError(e);
  }
}
