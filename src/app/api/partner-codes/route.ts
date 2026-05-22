/**
 * GET  /api/partner-codes  — list kode mitra (admin)
 * POST /api/partner-codes  — buat kode mitra baru (admin)
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const snap = await getAdminDb().collection("partnerCodes")
      .orderBy("createdAt", "desc").get();
    return json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    if (!body.code || !body.partnerName) {
      return json({ error: "code dan partnerName wajib diisi" }, 400);
    }

    const db = getAdminDb();
    // Cek duplikat kode
    const existing = await db.collection("partnerCodes")
      .where("code", "==", body.code).get();
    if (!existing.empty) {
      return json({ error: "Kode Mitra sudah digunakan" }, 409);
    }

    const data = {
      code: body.code,
      eventId: body.eventId ?? "",
      partnerName: body.partnerName,
      courseId: body.courseId ?? "",
      status: "active",
      usedBy: [],
      usedCount: 0,
      quota: body.quota ?? 0,
      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("partnerCodes").add(data);
    return json({ id: ref.id, ...data }, 201);
  } catch (e) {
    return handleError(e);
  }
}
