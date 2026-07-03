/**
 * GET  /api/partner-codes  — list Tracking Mitra (admin)
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { randomUUID } from "crypto";

// Token acak untuk link dashboard mitra (URL-safe, tanpa tanda hubung).
function makeDashboardToken(): string {
  return (randomUUID() + randomUUID()).replace(/-/g, "").slice(0, 32);
}

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
      let inProgress = 0;
      let certified = 0;

      // Pastikan event punya token dashboard mitra (buat sekali bila belum ada).
      let dashboardToken: string = ev.dashboardToken || "";
      if (!dashboardToken && ev.partnerCode) {
        dashboardToken = makeDashboardToken();
        try {
          await db.collection("events").doc(ev.id).set({ dashboardToken }, { merge: true });
        } catch (e) {
          console.error("[partner-codes] gagal simpan dashboardToken:", ev.id, e);
        }
      }

      if (ev.partnerCode) {
        // Cari user yang daftar pakai kode ini
        const usersSnap = await db.collection("users")
          .where("partnerCode", "==", ev.partnerCode)
          .get();
        
        const validUsers = usersSnap.docs.filter(u => u.data().profileCompleted === true);
        registered = validUsers.length;
        
        // Ambil UID user untuk mengecek enrollments
        const userIds = validUsers.map(u => u.id);

        if (userIds.length > 0) {
          // Ambil enrollments
          const enrollmentMap: Record<string, any> = {};
          const chunkSize = 30;
          for (let i = 0; i < userIds.length; i += chunkSize) {
            const chunk = userIds.slice(i, i + chunkSize);
            const enrollmentsSnap = await db.collection("enrollments")
              .where("userId", "in", chunk)
              .where("courseId", "==", ev.courseId || "course-main")
              .get();
              
            enrollmentsSnap.docs.forEach(en => {
              enrollmentMap[en.data().userId] = en.data();
            });
          }
          
          userIds.forEach(uid => {
            const en = enrollmentMap[uid];
            if (en && (en.status === "certified" || en.certificateClaimed)) {
              certified++;
            } else {
              inProgress++;
            }
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
        dashboardToken,
        stats: {
          registered,
          inProgress,
          certified
        }
      };
    }));

    return json(results);
  } catch (e) {
    return handleError(e);
  }
}
