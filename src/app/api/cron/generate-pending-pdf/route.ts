import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";
import { normalizeCertName } from "@/lib/cert-name";
import { syncStudentIndex } from "@/lib/sync-student-index";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET/POST /api/cron/generate-pending-pdf
 *
 * Membuat PDF sertifikat di LATAR BELAKANG untuk peserta hasil import yang sudah
 * "certified" tapi belum punya PDF (pdfPending == true / certificateDriveUrl
 * kosong). Diproses MAX_PER_RUN per panggilan agar tidak timeout & tidak
 * membanjiri GAS.
 *
 * Pasang di cron-job.org agar dipanggil berkala (mis. tiap 2-5 menit). Aman
 * walau admin menutup browser.
 *
 * Auth: query ?key=ADMIN_ACCESS_CODE  ATAU header Authorization: Bearer <key>.
 */

// 5 per run: generate Slides→PDF ~8 detik/sertifikat, jadi 5×8≈40s aman di
// bawah maxDuration 60s. Dengan 8 sebelumnya, run sering terpotong gateway
// (HTTP 307/timeout) sebelum semua selesai → kerja terbuang.
const MAX_PER_RUN = 5;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function tsToDate(v: any): Date {
  if (!v) return new Date();
  if (v._seconds) return new Date(v._seconds * 1000);
  if (typeof v.toMillis === "function") return new Date(v.toMillis());
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

async function handle(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const queryKey = req.nextUrl.searchParams.get("key");
  const expectedKey = process.env.ADMIN_ACCESS_CODE || "ADMINFL26";
  if (authHeader !== `Bearer ${expectedKey}` && queryKey !== expectedKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  const db = getAdminDb();

  // Ambil kandidat: enrollment yang menunggu PDF.
  const snap = await db
    .collection("enrollments")
    .where("pdfPending", "==", true)
    .limit(MAX_PER_RUN)
    .get();

  if (snap.empty) {
    return json({ success: true, processed: 0, remaining: 0, message: "Tidak ada PDF pending." });
  }

  const settingsDoc = await db.collection("settings").doc("app").get();
  const settings = settingsDoc.data() || {};
  const gasWebAppUrl = settings.gasWebAppUrl || "";
  const mainCertSlideTemplateId = settings.mainCertSlideTemplateId || "";

  if (!gasWebAppUrl || !mainCertSlideTemplateId) {
    return json({ error: "URL GAS / template sertifikat belum disetel." }, 500);
  }

  const results: Array<{ email: string; status: string; reason?: string }> = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const email = String(data.email || doc.id || "");

    // Sudah ada URL → bersihkan penanda, lewati.
    if (data.certificateDriveUrl) {
      await doc.ref.update({ pdfPending: false });
      results.push({ email, status: "skipped", reason: "already_has_url" });
      continue;
    }
    if (!data.certificateId || !data.certificateName) {
      await doc.ref.update({ pdfPending: false });
      results.push({ email, status: "skipped", reason: "data_tidak_lengkap" });
      continue;
    }

    const claimDate = tsToDate(data.certificateClaimedAt);
    const claimDateStr = `${claimDate.getDate()} ${MONTHS[claimDate.getMonth()]} ${claimDate.getFullYear()}`;

    try {
      const gasRes = await fetch(gasWebAppUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_main_cert",
          templateId: mainCertSlideTemplateId,
          certId: data.certificateId,
          // Normalisasi defensif: data lama mungkin masih font "fancy" Unicode.
          userName: normalizeCertName(data.certificateName) || data.certificateName,
          courseName: data.certificateCourseName || "Workshop Literasi Finansial",
          claimDate: claimDateStr,
          email,
        }),
      });

      const text = await gasRes.text();
      if (!gasRes.ok) {
        results.push({ email, status: "error", reason: `GAS HTTP ${gasRes.status}` });
        continue; // biarkan pdfPending tetap true → dicoba lagi panggilan berikutnya
      }

      let gasData: any = null;
      try { gasData = text ? JSON.parse(text) : null; } catch {
        results.push({ email, status: "error", reason: "GAS non-JSON" });
        continue;
      }

      const driveUrl = gasData?.downloadUrl || gasData?.pdfUrl || null;
      const driveFileId = gasData?.fileId || null;

      if (driveUrl) {
        await doc.ref.update({
          certificateDriveUrl: driveUrl,
          certificateDriveFileId: driveFileId || "",
          pdfPending: false,
        });
        // Sinkronkan studentsIndex agar link langsung muncul di tabel admin
        // (kalau tidak, index basi: status Tersertifikasi tapi link "-").
        if (data.userId) syncStudentIndex(data.userId);
        results.push({ email, status: "completed" });
      } else {
        results.push({ email, status: "error", reason: "GAS OK tanpa URL" });
      }
    } catch (e: any) {
      results.push({ email, status: "error", reason: e?.message || "fetch error" });
    }
  }

  // Hitung sisa yang masih pending (perkiraan cepat).
  const remainingSnap = await db
    .collection("enrollments")
    .where("pdfPending", "==", true)
    .count()
    .get();

  return json({
    success: true,
    processed: results.filter((r) => r.status === "completed").length,
    results,
    remaining: remainingSnap.data().count,
  });
}

export async function GET(req: NextRequest) {
  try { return await handle(req); } catch (e) { return handleError(e); }
}
export async function POST(req: NextRequest) {
  try { return await handle(req); } catch (e) { return handleError(e); }
}
