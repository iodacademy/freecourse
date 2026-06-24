import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError, requireSuperAdmin } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/students/audit-certificates  (Super Admin)
 *
 * Mendeteksi peserta yang SUDAH tersertifikasi (certificateClaimed=true) tapi
 * datanya bermasalah:
 *   - missingPdf  : certificateDriveUrl kosong → PDF hilang/menggantung &
 *                   TIDAK punya penanda pdfPending (jadi tak dijemput cron).
 *   - missingData : certificateId / certificateName kosong → tak bisa generate.
 *
 * body { fix?: boolean }
 *   fix=false (default) → hanya LAPORAN, tidak mengubah apa pun.
 *   fix=true            → untuk yang missingPdf TAPI datanya lengkap, set
 *                         pdfPending=true supaya cron generate-pending-pdf
 *                         membuatkan PDF-nya. Tidak menyentuh missingData.
 *
 * Auth: Authorization: Bearer <kode super admin>.
 */

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const body = await req.json().catch(() => ({}));
    const fix = body?.fix === true;

    const db = getAdminDb();

    // Semua enrollment yang sudah klaim sertifikat.
    // Ambil enrollments certified + SEMUA users (untuk cross-check kenapa beda
    // dengan angka "Completion" di dashboard).
    const [snap, usersSnap] = await Promise.all([
      db.collection("enrollments").where("certificateClaimed", "==", true).get(),
      db.collection("users").get(),
    ]);

    // Peta user by email (lowercase) → status yang dipakai dashboard.
    const userByEmail = new Map<string, { profileCompleted: boolean; role: string }>();
    usersSnap.docs.forEach((d) => {
      const u = d.data();
      const em = String(u.email || "").toLowerCase().trim();
      if (!em) return;
      userByEmail.set(em, {
        profileCompleted: u.profileCompleted === true,
        role: String(u.role || ""),
      });
    });

    // Hitung kenapa enrollment certified TIDAK masuk hitungan dashboard.
    // Dashboard membuang: user tidak ada / tanpa email / role admin /
    // profileCompleted != true.
    const dashboardExcluded = {
      userNotFound: 0,      // enrollment certified tapi tak ada dokumen users
      profileIncomplete: 0, // user ada tapi profileCompleted=false
      adminRole: 0,         // user role admin
    };
    const excludedSamples: Array<{ email: string; reason: string }> = [];

    const missingPdf: Array<{ email: string; certId: string; queued: boolean }> = [];
    const missingData: Array<{ email: string; reason: string }> = [];

    // Kandidat yang akan ditandai pdfPending (missingPdf + data lengkap + BELUM diantre).
    const toFix: FirebaseFirestore.DocumentReference[] = [];
    let alreadyQueuedCount = 0; // sudah pdfPending=true (sedang diantre cron)

    snap.docs.forEach((d) => {
      const data = d.data();
      const email = String(data.email || d.id || "");
      const hasUrl = !!data.certificateDriveUrl;
      const hasId = !!data.certificateId;
      const hasName = !!data.certificateName;

      // ── Cross-check terhadap aturan dashboard ──
      const emKey = email.toLowerCase().trim();
      const u = emKey ? userByEmail.get(emKey) : undefined;
      let exReason = "";
      if (!emKey || !u) exReason = "user_tidak_ada";
      else if (u.role === "admin") exReason = "role_admin";
      else if (!u.profileCompleted) exReason = "profil_belum_lengkap";
      if (exReason) {
        if (exReason === "user_tidak_ada") dashboardExcluded.userNotFound++;
        else if (exReason === "role_admin") dashboardExcluded.adminRole++;
        else dashboardExcluded.profileIncomplete++;
        if (excludedSamples.length < 30) excludedSamples.push({ email, reason: exReason });
      }

      if (!hasId || !hasName) {
        missingData.push({
          email,
          reason: [!hasId ? "certificateId kosong" : "", !hasName ? "certificateName kosong" : ""].filter(Boolean).join(", "),
        });
        return;
      }
      if (!hasUrl) {
        const queued = data.pdfPending === true;
        missingPdf.push({ email, certId: data.certificateId, queued });
        if (queued) alreadyQueuedCount++;
        else toFix.push(d.ref);
      }
    });

    // Yang BELUM diantre = total missingPdf dikurangi yang sudah diantre.
    const notQueuedCount = missingPdf.length - alreadyQueuedCount;

    let fixed = 0;
    if (fix && toFix.length > 0) {
      // Tandai pdfPending=true secara batched (maks 450 op/batch).
      let batch = db.batch();
      let ops = 0;
      for (const ref of toFix) {
        batch.update(ref, { pdfPending: true, updatedAt: FieldValue.serverTimestamp() });
        ops++; fixed++;
        if (ops >= 450) { await batch.commit(); batch = db.batch(); ops = 0; }
      }
      if (ops > 0) await batch.commit();
    }

    // Setelah fix dijalankan, yang tadinya belum-antre kini sudah diantre.
    const queuedTotalAfter = fix ? alreadyQueuedCount + fixed : alreadyQueuedCount;
    const notQueuedAfter = fix ? Math.max(0, notQueuedCount - fixed) : notQueuedCount;

    const totalExcluded =
      dashboardExcluded.userNotFound +
      dashboardExcluded.profileIncomplete +
      dashboardExcluded.adminRole;

    return json({
      success: true,
      totalCertified: snap.size,
      missingPdfCount: missingPdf.length,
      missingDataCount: missingData.length,
      // Rincian status antrean PDF:
      alreadyQueuedCount: queuedTotalAfter, // total yang sedang diantre cron
      notQueuedCount: notQueuedAfter,       // masih perlu diantrekan
      queuedNow: fix ? fixed : 0,           // baru saja diantrekan pada klik ini
      missingPdfSample: missingPdf.slice(0, 30),
      missingDataSample: missingData.slice(0, 30),
      // Kenapa angka audit (totalCertified) > "Completion" di dashboard:
      // dashboard membuang enrollment yang user-nya tidak memenuhi syarat.
      dashboardComparison: {
        totalCertified: snap.size,
        excludedFromDashboard: totalExcluded,
        estimatedDashboardCompletion: snap.size - totalExcluded,
        breakdown: dashboardExcluded,
        excludedSamples,
      },
      note: fix
        ? `Ditandai pdfPending untuk ${fixed} peserta. Cron akan membuatkan PDF-nya.`
        : "Mode laporan. Jalankan dengan fix=true untuk mengantre pembuatan PDF.",
    });
  } catch (e) {
    return handleError(e);
  }
}
