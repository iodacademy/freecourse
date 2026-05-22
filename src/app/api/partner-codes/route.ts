/**
 * GET  /api/partner-codes  — list Tracking Mitra (admin)
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();
    
    // 1. Ambil semua event B2B
    const eventsSnap = await db.collection("events")
      .where("channelType", "==", "b2b_campus")
      .get();
      
    const events = eventsSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

    // 2. Hitung statistik untuk masing-masing
    const results = await Promise.all(events.map(async (ev) => {
      let registered = 0;
      let assessed = 0;
      let surveyed = 0;
      let certified = 0;

      if (ev.partnerCode) {
        // Cari user yang daftar pakai kode ini
        const usersSnap = await db.collection("users")
          .where("partnerCode", "==", ev.partnerCode)
          .get();
        
        registered = usersSnap.size;
        
        // Ambil UID user untuk mengecek enrollments
        const userIds = usersSnap.docs.map(u => u.id);

        if (userIds.length > 0) {
          // Bagi menjadi chunk 30 jika terlalu banyak (firestore in limit is 30)
          // Untuk sederhana, kita query enrollments by eventId
          const enrollmentsSnap = await db.collection("enrollments")
            .where("eventId", "==", ev.id)
            .get();
            
          enrollmentsSnap.docs.forEach(en => {
            const data = en.data();
            // Certified
            if (data.status === "certified" || data.certificateClaimed) {
              certified++;
            }
            // Assessed & Surveyed: kita cek di stepProgress
            let hasPassedAssessment = false;
            let hasSubmittedSurvey = false;
            
            if (data.stepProgress) {
              Object.values(data.stepProgress).forEach((sp: any) => {
                if (sp.assessmentResult?.passed) hasPassedAssessment = true;
                if (sp.surveyResult?.submitted) hasSubmittedSurvey = true;
              });
            }
            if (hasPassedAssessment) assessed++;
            if (hasSubmittedSurvey) surveyed++;
          });
        }
      }

      return {
        id: ev.id,
        code: ev.partnerCode || "-",
        partnerName: ev.campusName || ev.name,
        eventId: ev.id,
        courseId: ev.courseId,
        status: ev.status,
        quota: 0, // Not strictly used for tracking
        createdAt: ev.createdAt,
        stats: {
          registered,
          assessed,
          surveyed,
          certified
        }
      };
    }));

    return json(results);
  } catch (e) {
    return handleError(e);
  }
}
