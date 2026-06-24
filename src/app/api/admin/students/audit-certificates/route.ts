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
    const snap = await db
      .collection("enrollments")
      .where("certificateClaimed", "==", true)
      .get();

    const missingPdf: Array<{ email: string; certId: string; hasData: boolean }> = [];
    const missingData: Array<{ email: string; reason: string }> = [];

    // Kandidat yang akan ditandai pdfPending (missingPdf + data lengkap).
    const toFix: FirebaseFirestore.DocumentReference[] = [];

    snap.docs.forEach((d) => {
      const data = d.data();
      const email = String(data.email || d.id || "");
      const hasUrl = !!data.certificateDriveUrl;
      const hasId = !!data.certificateId;
      const hasName = !!data.certificateName;

      if (!hasId || !hasName) {
        missingData.push({
          email,
          reason: [!hasId ? "certificateId kosong" : "", !hasName ? "certificateName kosong" : ""].filter(Boolean).join(", "),
        });
        return;
      }
      if (!hasUrl) {
        const alreadyQueued = data.pdfPending === true;
        missingPdf.push({ email, certId: data.certificateId, hasData: true });
        if (!alreadyQueued) toFix.push(d.ref);
      }
    });

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

    return json({
      success: true,
      totalCertified: snap.size,
      missingPdfCount: missingPdf.length,
      missingDataCount: missingData.length,
      // Yang sudah punya pdfPending (sedang diantre cron) vs yang baru ditandai.
      queuedNow: fix ? fixed : 0,
      missingPdfSample: missingPdf.slice(0, 30),
      missingDataSample: missingData.slice(0, 30),
      note: fix
        ? `Ditandai pdfPending untuk ${fixed} peserta. Cron akan membuatkan PDF-nya.`
        : "Mode laporan. Jalankan dengan fix=true untuk mengantre pembuatan PDF.",
    });
  } catch (e) {
    return handleError(e);
  }
}
