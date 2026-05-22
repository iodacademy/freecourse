/**
 * GET /api/enrollments/[id]
 * Mengambil detail enrollment (progress belajar siswa).
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin, json, handleError } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const decoded = await requireAuth(req);
    const { id } = await params;
    
    const doc = await getAdminDb().collection("enrollments").doc(id).get();
    if (!doc.exists) return json({ error: "Enrollment not found" }, 404);
    
    const data = doc.data()!;
    
    // Validasi kepemilikan
    if (data.email !== decoded.email) {
      await requireAdmin(req); // throw jika bukan admin
    }
    
    return json({ id: doc.id, ...data });
  } catch (e) {
    return handleError(e);
  }
}
