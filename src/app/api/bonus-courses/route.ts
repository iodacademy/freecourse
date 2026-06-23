/**
 * GET  /api/bonus-courses  — daftar topik kursus tambahan
 * POST /api/bonus-courses  — tambah topik (admin)
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    // ?all=1 → tampilkan semua status (untuk panel admin, agar kelas nonaktif
    // tetap terlihat & bisa diaktifkan lagi). Tanpa flag → hanya yang aktif
    // (dipakai sisi siswa di /learn/bonus).
    const showAll = req.nextUrl.searchParams.get("all") === "1";
    const col = getAdminDb().collection("bonusCourseTopics");
    // Hindari composite index — filter status saja, sort di JS
    const snap = showAll
      ? await col.get()
      : await col.where("status", "==", "active").get();
    const docs = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          category: data.category || "vl",
          status: data.status || "active",
        };
      })
      .sort((a: any, b: any) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return ta - tb;
      });
    return json(docs);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();

    if (!body.name || !body.classCode) {
      return json({ error: "name dan classCode wajib diisi" }, 400);
    }

    const data = {
      name: body.name,
      category: body.category || "vl",
      classCode: String(body.classCode).toUpperCase(),
      Kode_Basis: String(body.kodeBase ?? "").toUpperCase(),
      description: body.description || "",
      groupLink: body.groupLink || "",
      lastSessionDate: body.lastSessionDate || "",
      portalUrl: body.portalUrl ?? "https://app.iodacademy.id/portal-belajar/",
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await getAdminDb().collection("bonusCourseTopics").add(data);
    return json({ id: ref.id, ...data }, 201);
  } catch (e) {
    return handleError(e);
  }
}
