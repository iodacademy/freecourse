/**
 * GET  /api/enrollments          — daftar enrollments (admin: semua, siswa: milik sendiri)
 * POST /api/enrollments/auto-enroll — lihat route terpisah
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, json, handleError } from "@/lib/api-helpers";
import { getExplicitBenefitCategories } from "@/lib/benefit-categories";

export async function GET(req: NextRequest) {
  try {
    const decoded = await requireAuth(req);
    const db = getAdminDb();

    const email = decoded.email;
    if (!email) return json([], 200);

    const query = db.collection("enrollments").where("email", "==", email);

    const snap = await query.get();
    const enrollments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Self-healing: Attach waGroupLink dynamically if missing for beasiswa
    for (const e of enrollments as any[]) {
      if (e.channelSource === "beasiswa" && e.eventId && !e.waGroupLink) {
        try {
          const eventDoc = await db.collection("events").doc(e.eventId).get();
          if (eventDoc.exists) {
            const eventData = eventDoc.data();
            const bc = eventData?.beasiswaConfig;
            const hasManualBenefitChoice = getExplicitBenefitCategories(eventData).length > 0;
            if (!hasManualBenefitChoice && bc && (bc.type === "wpb" || bc.type === "bootcamp")) {
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

    return json(enrollments);
  } catch (e) {
    return handleError(e);
  }
}
