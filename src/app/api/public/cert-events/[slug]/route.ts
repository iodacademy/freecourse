/**
 * GET  /api/public/cert-events/[slug]  → info cert event (judul, tanggal) untuk halaman klaim.
 * POST /api/public/cert-events/[slug]  → klaim sertifikat: { name } → generate PDF via GAS.
 * Publik, tanpa login. Nama diisi peserta.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";
import { normalizeCertName, validateCertName } from "@/lib/cert-name";
import { FieldValue } from "firebase-admin/firestore";

type Ctx = { params: Promise<{ slug: string }> };

// Rate limit sederhana per-IP (klaim = generate PDF, mahal).
const rate = new Map<string, { c: number; t: number }>();
function okRate(ip: string): boolean {
  const now = Date.now();
  const e = rate.get(ip);
  if (!e || now - e.t > 60_000) { rate.set(ip, { c: 1, t: now }); return true; }
  if (e.c >= 10) return false;
  e.c++; return true;
}

async function findEvent(slug: string) {
  const db = getAdminDb();
  const snap = await db.collection("certEvents").where("slug", "==", slug).limit(1).get();
  if (snap.empty) return null;
  return { ref: snap.docs[0].ref, data: snap.docs[0].data() as any };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { slug } = await params;
    const ev = await findEvent(slug);
    if (!ev || ev.data.active === false) return json({ error: "Not found" }, 404);
    return json({
      title: ev.data.title,
      workshopDate: ev.data.workshopDate || "",
      workshopDay: ev.data.workshopDay || "",
      workshopTime: ev.data.workshopTime || "",
      speakerName: ev.data.speakerName || "",
    });
  } catch (e) {
    return handleError(e);
  }
}

function formatDateID(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch { return iso; }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { slug } = await params;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!okRate(ip)) return json({ error: "Terlalu banyak percobaan, coba lagi sebentar." }, 429);

    const body = await req.json().catch(() => ({}));
    const userName = normalizeCertName(String(body.name || ""));
    try { validateCertName(userName); }
    catch (e: any) { return json({ error: e?.message || "Nama tidak valid." }, 400); }

    const ev = await findEvent(slug);
    if (!ev || ev.data.active === false) return json({ error: "Not found" }, 404);

    const db = getAdminDb();
    const settings = (await db.collection("settings").doc("app").get()).data() || {};
    const gasWebAppUrl: string = settings.gasWebAppUrl || "";
    const templateId: string = settings.workshopCertSlideTemplateId || "";
    if (!gasWebAppUrl) return json({ error: "Sertifikat belum bisa dibuat (GAS belum dikonfigurasi)." }, 500);

    const year = new Date().getFullYear();
    const certId = `WS-CERT-${year}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
    const now = new Date();
    const claimDate = formatDateID(now.toISOString().slice(0, 10));

    const gasRes = await fetch(gasWebAppUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate_workshop_cert",
        templateId,
        certId,
        userName,
        workshopTitle: ev.data.title,
        workshopDate: formatDateID(ev.data.workshopDate || ""),
        workshopDay: ev.data.workshopDay || "",
        workshopTime: ev.data.workshopTime || "",
        speakerName: ev.data.speakerName || "",
        speakerTitle: ev.data.speakerTitle || "",
        claimDate,
      }),
    });
    const gasData = await gasRes.json().catch(() => ({}));
    const downloadUrl = gasData.downloadUrl || gasData.pdfUrl || "";
    if (!gasRes.ok || !downloadUrl) {
      return json({ error: "Gagal membuat sertifikat. Coba lagi." }, 502);
    }

    // Catat klaim (audit) + hitung.
    await db.collection("certEvents").doc(ev.ref.id).collection("claims").add({
      name: userName, certId, downloadUrl, createdAt: FieldValue.serverTimestamp(),
    });
    await ev.ref.update({ claimCount: FieldValue.increment(1) });

    return json({ success: true, certId, downloadUrl, name: userName });
  } catch (e) {
    return handleError(e);
  }
}
