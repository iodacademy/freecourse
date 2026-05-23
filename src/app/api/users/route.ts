/**
 * GET /api/users
 * Mengambil daftar semua siswa dengan pagination dan pencarian.
 * Query params:
 *   limit   — jumlah data per halaman (default 50)
 *   after   — cursor (createdAt ISO string dari dokumen terakhir)
 *   search  — pencarian berdasarkan nama/email (server-side)
 *   channel — filter channelSource
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
    const after = searchParams.get("after") || null;     // cursor ISO string createdAt
    const search = searchParams.get("search") || "";     // pencarian nama/email
    const channel = searchParams.get("channel") || "";   // filter channel

    let query = db.collection("users")
      .orderBy("createdAt", "desc") as FirebaseFirestore.Query;

    // Filter channel jika ada
    if (channel && channel !== "all") {
      query = query.where("channelSource", "==", channel);
    }

    // Pagination cursor
    if (after) {
      const cursorDate = new Date(after);
      query = query.startAfter(cursorDate);
    }

    // Ambil limit+1 untuk deteksi hasNext
    const snap = await query.limit(limit + 1).get();

    let docs = snap.docs;
    const hasNext = docs.length > limit;
    if (hasNext) docs = docs.slice(0, limit);

    const users = docs.map(doc => {
      const data = doc.data();
      if (data.createdAt && typeof data.createdAt.toDate === 'function') {
        data.createdAt = data.createdAt.toDate().toISOString();
      } else if (data.createdAt && typeof data.createdAt === 'object' && data.createdAt._seconds) {
        data.createdAt = new Date(data.createdAt._seconds * 1000).toISOString();
      }
      if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
        data.updatedAt = data.updatedAt.toDate().toISOString();
      } else if (data.updatedAt && typeof data.updatedAt === 'object' && data.updatedAt._seconds) {
        data.updatedAt = new Date(data.updatedAt._seconds * 1000).toISOString();
      }
      return { uid: doc.id, ...data };
    });

    // Filter search di sisi server (Firestore tidak support full-text, jadi filter di memory)
    const filtered = search
      ? users.filter((u: any) => {
          const q = search.toLowerCase();
          return (
            u.displayName?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q) ||
            u.partnerCode?.toLowerCase().includes(q)
          );
        })
      : users;

    // Cursor berikutnya = createdAt dokumen terakhir
    const nextCursor = hasNext && docs.length > 0
      ? docs[docs.length - 1].data().createdAt?.toDate?.()?.toISOString() ||
        docs[docs.length - 1].data().createdAt
      : null;

    return json({ users: filtered, hasNext, nextCursor, total: filtered.length });
  } catch (e) {
    return handleError(e);
  }
}
