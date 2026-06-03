/**
 * GET  /api/enrollments          — daftar enrollments (admin: semua, siswa: milik sendiri)
 * POST /api/enrollments/auto-enroll — lihat route terpisah
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, json, handleError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const decoded = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const db = getAdminDb();

    // Check apakah admin
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    const isAdmin = userDoc.data()?.role === "admin";

    let query = db.collection("enrollments") as FirebaseFirestore.Query;

    if (!isAdmin) {
      // Siswa hanya lihat enrollments sendiri (by email)
      const email = decoded.email;
      if (!email) return json([], 200);
      query = query.where("email", "==", email);
    } else {
      query = query.orderBy("createdAt", "desc");
      // Admin bisa filter
      const userId = searchParams.get("userId");
      const courseId = searchParams.get("courseId");
      const channelSource = searchParams.get("channelSource");
      const status = searchParams.get("status");
      if (userId) query = query.where("userId", "==", userId);
      if (courseId) query = query.where("courseId", "==", courseId);
      if (channelSource) query = query.where("channelSource", "==", channelSource);
      if (status) query = query.where("status", "==", status);
    }

    const snap = await query.get();
    const enrollments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Self-healing: Attach waGroupLink dynamically if missing for beasiswa
    if (!isAdmin) {
      for (const e of enrollments as any[]) {
        if (e.channelSource === "beasiswa" && e.eventId && !e.waGroupLink) {
          try {
            const eventDoc = await db.collection("events").doc(e.eventId).get();
            if (eventDoc.exists) {
              const bc = eventDoc.data()?.beasiswaConfig;
              if (bc && (bc.type === "wpb" || bc.type === "bootcamp")) {
                e.beasiswaType = bc.type;
                e.waGroupLink = bc.waGroupLink || "";
                
                // Async update to save it permanently
                db.collection("enrollments").doc(e.id).update({
                  beasiswaType: bc.type,
                  waGroupLink: bc.waGroupLink || "",
                }).catch(err => console.error("Self-healing waGroupLink failed:", err));
              }
            }
          } catch (err) {
            console.error("Failed to fetch event for waGroupLink:", err);
          }
        }
      }
    }

    return json(enrollments);
  } catch (e) {
    return handleError(e);
  }
}
