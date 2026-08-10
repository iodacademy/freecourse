/**
 * GET  /api/public/cert-events/[slug]  → info event + daftar program untuk halaman klaim.
 * POST /api/public/cert-events/[slug]  → klaim: { name, program? } → generate PDF via GAS.
 * Publik, tanpa login. Nama diisi peserta.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";
import { normalizeCertName, validateCertName } from "@/lib/cert-name";
import { FieldValue } from "firebase-admin/firestore";
import { resolveProgram, listPrograms } from "@/lib/cert-programs";

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

    const programs = listPrograms(ev.data);
    // `templateId` sengaja tidak dikirim — itu urusan server.
    // `templateId` is deliberately withheld — it is the server's business.
    const detail: Record<string, unknown> = {};
    for (const p of programs) {
      const r = resolveProgram(ev.data, p);
      if (!r) continue;
      detail[p] = {
        title: r.detail.title,
        date: r.detail.date,
        day: r.detail.day,
        time: r.detail.time,
        speakerName: r.detail.speakerName,
      };
    }

    return json({ title: ev.data.title || "", programs, detail });
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

    const requested = typeof body.program === "string" ? body.program : undefined;
    const picked = resolveProgram(ev.data, requested);
    if (!picked) return json({ error: "Program tidak tersedia untuk link ini." }, 400);
    const { program, detail } = picked;

    const db = getAdminDb();
    const settings = (await db.collection("settings").doc("app").get()).data() || {};
    const gasWebAppUrl: string = settings.gasWebAppUrl || "";
    // Template per program; kosong berarti pakai template global lama.
    // Per-program template; empty means fall back to the old global template.
    const templateId: string = detail.templateId || settings.workshopCertSlideTemplateId || "";
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
        workshopTitle: detail.title,
        workshopDate: formatDateID(detail.date),
        workshopDay: detail.day,
        workshopTime: detail.time,
        speakerName: detail.speakerName,
        speakerTitle: detail.speakerTitle,
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
      name: userName, program, certId, downloadUrl, createdAt: FieldValue.serverTimestamp(),
    });
    // Untuk event lama `detail` belum ada; increment membuat map bersarangnya
    // dari nol, sehingga angka per-program hanya menghitung sejak fitur ini aktif.
    // Total `claimCount` tetap utuh sejak awal.
    //
    // Legacy events have no `detail` yet; the increment creates the nested map
    // from zero, so per-program counts only cover claims since this feature
    // shipped. The `claimCount` total stays intact from the start.
    await ev.ref.update({
      claimCount: FieldValue.increment(1),
      [`detail.${program}.claimCount`]: FieldValue.increment(1),
    });

    return json({ success: true, certId, downloadUrl, name: userName, program });
  } catch (e) {
    return handleError(e);
  }
}
