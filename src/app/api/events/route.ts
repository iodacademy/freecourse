/**
 * GET  /api/events  — daftar events (admin)
 * POST /api/events  — buat event baru (admin)
 *   Untuk channel b2c_workshop: eventId = slug dari nama/judul
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

/** Buat slug dari string: "Workshop Literasi Gen-Z" → "workshop-literasi-gen-z" */
function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const channelType = searchParams.get("channelType");
    const db = getAdminDb();
    let query = db.collection("events").orderBy("createdAt", "desc") as FirebaseFirestore.Query;
    if (channelType) query = query.where("channelType", "==", channelType);
    const snap = await query.get();
    return json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const db = getAdminDb();

    const channelType = body.channelType ?? "b2c_ads";
    const isWorkshop = channelType === "b2c_workshop";

    const data: Record<string, any> = {
      name: body.name ?? "Event Baru",
      description: body.description ?? "",
      channelType,
      courseId: body.courseId ?? "",
      status: body.status ?? "draft",
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      // Channel 1 — Kemitraan
      campusName: body.campusName ?? null,
      partnerCode: body.partnerCode ?? null,
      partnerCodeLower: body.partnerCode ? body.partnerCode.toLowerCase() : null,
      audienceLabel: body.audienceLabel ?? null,
      bulkImportedEmails: body.bulkImportedEmails ?? [],
      // Channel 2 — Beasiswa / Ads
      landingPageConfig: body.landingPageConfig ?? null,
      utmTracking: body.utmTracking ?? false,
      // Channel 3 — Workshop
      workshopData: body.workshopData ?? null,
      workshopConfig: body.workshopConfig ?? null,
      customProfileFields: body.customProfileFields ?? [],
      beasiswaConfig: body.beasiswaConfig ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    let docId: string;
    const isWpbOrBootcamp = channelType === "b2c_ads" && data.beasiswaConfig && (data.beasiswaConfig.type === "wpb" || data.beasiswaConfig.type === "bootcamp");

    if (isWorkshop && body.name) {
      // Gunakan slug judul sebagai eventId dokumen
      const slug = toSlug(body.name);
      const docRef = db.collection("events").doc(slug);
      // Cek kalau slug sudah ada
      const existing = await docRef.get();
      if (existing.exists) {
        return json({ error: `Event dengan slug "${slug}" sudah ada. Gunakan judul berbeda.` }, 409);
      }
      await docRef.set(data);
      docId = slug;
    } else if (isWpbOrBootcamp && data.beasiswaConfig.namaKelas) {
      // Gunakan slug dari Nama Kelas untuk Bootcamp/WPB
      const slug = toSlug(data.beasiswaConfig.namaKelas);
      const docRef = db.collection("events").doc(slug);
      const existing = await docRef.get();
      if (existing.exists) {
        return json({ error: `Event Beasiswa dengan slug "${slug}" sudah ada. Gunakan Nama Kelas berbeda.` }, 409);
      }
      await docRef.set(data);
      docId = slug;
    } else {
      // Auto-generated ID untuk channel lain
      const ref = await db.collection("events").add(data);
      docId = ref.id;
    }

    return json({ id: docId, ...data }, 201);
  } catch (e) {
    return handleError(e);
  }
}
