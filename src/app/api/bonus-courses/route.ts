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
        const cat = data.category || "vl";
        return {
          id: d.id,
          ...data,
          category: cat,
          benefitType:
            data.benefitType ||
            (cat === "review_cv" ? "review_cv" : cat === "downloadable" ? "downloadable" : "course"),
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

    const category = body.category || "vl";
    const benefitType =
      body.benefitType ||
      (category === "review_cv" ? "review_cv" : category === "downloadable" ? "downloadable" : "course");

    if (!body.name) {
      return json({ error: "name wajib diisi" }, 400);
    }
    // classCode hanya wajib untuk kategori yang generate redeem code portal (vl/bootcamp).
    const needsClassCode = category === "vl" || category === "bootcamp";
    if (needsClassCode && !body.classCode) {
      return json({ error: "classCode wajib diisi untuk kategori ini" }, 400);
    }

    const data = {
      name: body.name,
      category,
      benefitType,
      classCode: String(body.classCode ?? "").toUpperCase(),
      Kode_Basis: String(body.kodeBase ?? "").toUpperCase(),
      description: body.description || "",
      groupLink: body.groupLink || "",
      lastSessionDate: body.lastSessionDate || "",
      portalUrl: body.portalUrl ?? "https://app.iodacademy.id/portal-belajar/",
      workshopData: category === "workshop" ? (body.workshopData || {}) : null,
      downloadUrl: benefitType === "downloadable" ? (body.downloadUrl || "") : null,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await getAdminDb().collection("bonusCourseTopics").add(data);
    return json({ id: ref.id, ...data }, 201);
  } catch (e) {
    return handleError(e);
  }
}
