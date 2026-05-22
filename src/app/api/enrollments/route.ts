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

    let query = db.collection("enrollments").orderBy("createdAt", "desc") as FirebaseFirestore.Query;

    if (!isAdmin) {
      // Siswa hanya lihat enrollments sendiri
      query = query.where("userId", "==", decoded.uid);
    } else {
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
    return json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (e) {
    return handleError(e);
  }
}
