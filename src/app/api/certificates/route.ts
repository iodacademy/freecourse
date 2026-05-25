/**
 * GET /api/certificates
 * Ambil daftar sertifikat dari koleksi enrollments (yang sudah certificateClaimed=true)
 * Query params: limit, after (cursor), search
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();
    const { searchParams } = new URL(req.url);

    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const after = searchParams.get("after") || null;
    const search = searchParams.get("search") || "";

    // Query tanpa orderBy untuk menghindari kebutuhan composite index
    let query = db.collection("enrollments")
      .where("certificateClaimed", "==", true) as FirebaseFirestore.Query;

    const snap = await query.limit(200).get();
    let docs = snap.docs;

    // Sort in-memory by updatedAt desc
    docs = docs.sort((a, b) => {
      const aTs = a.data().certificateClaimedAt?._seconds || a.data().updatedAt?._seconds || 0;
      const bTs = b.data().certificateClaimedAt?._seconds || b.data().updatedAt?._seconds || 0;
      return bTs - aTs;
    });

    const certs = docs.map(doc => {
      const d = doc.data();
      // Konversi timestamps
      const toISO = (ts: any) => {
        if (!ts) return null;
        if (typeof ts.toDate === "function") return ts.toDate().toISOString();
        if (ts._seconds) return new Date(ts._seconds * 1000).toISOString();
        return ts;
      };
      return {
        id: doc.id,
        enrollmentId: doc.id,
        certId: d.certificateId || doc.id,
        userName: d.displayName || d.certificateName || d.email || "—",
        email: d.email || "—",
        courseId: d.courseId || "—",
        courseName: d.courseName || d.courseId || "Kelas Utama",
        claimedAt: toISO(d.certificateClaimedAt || d.updatedAt),
        isValid: true,
        channelSource: d.channelSource || null,
        partnerCode: d.partnerCode || null,
        uid: d.userId || null,
        driveUrl: d.certificateDriveUrl || null,
      };
    });

    // Filter search di memory
    const filtered = search
      ? certs.filter(c => {
          const q = search.toLowerCase();
          return (
            c.userName.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.certId.toLowerCase().includes(q)
          );
        })
      : certs;

    return json({ certs: filtered, hasNext: false, nextCursor: null });
  } catch (e) {
    return handleError(e);
  }
}
