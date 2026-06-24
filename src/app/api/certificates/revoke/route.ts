/**
 * DELETE /api/certificates/revoke
 * Body: { enrollmentId: string }
 * Admin only — reset sertifikat peserta agar bisa klaim ulang dengan certId & tanggal baru.
 * Juga hapus file PDF lama di Google Drive via GAS.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { invalidateDashboardCache } from "@/lib/dashboard-aggregator";
import { syncStudentIndex } from "@/lib/sync-student-index";
import { FieldValue } from "firebase-admin/firestore";

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();

    const { enrollmentId } = await req.json();
    if (!enrollmentId) return json({ error: "enrollmentId wajib diisi" }, 400);

    const enrollRef = db.collection("enrollments").doc(enrollmentId);
    const enrollSnap = await enrollRef.get();
    if (!enrollSnap.exists) return json({ error: "Enrollment tidak ditemukan" }, 404);

    const enrollData = enrollSnap.data()!;

    // Hapus file PDF lama di Drive via GAS (fire-and-forget)
    if (enrollData.certificateDriveFileId) {
      try {
        const settingsDoc = await db.collection("settings").doc("app").get();
        const gasWebAppUrl = settingsDoc.data()?.gasWebAppUrl || "";
        if (gasWebAppUrl) {
          fetch(gasWebAppUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "delete_old_cert",
              fileId: enrollData.certificateDriveFileId,
            }),
          }).catch(() => {});
        }
      } catch {}
    }

    // Reset semua field sertifikat di enrollment
    await enrollRef.update({
      certificateClaimed: false,
      certificateClaimedAt: null,
      certificateId: null,
      certificateName: null,
      certificateCourseName: null,
      certificateIssuer: null,
      certificateDriveUrl: null,
      certificateDriveFileId: null,
      certificateEmailSent: false,
      status: "enrolled",
      updatedAt: FieldValue.serverTimestamp(),
    });

    invalidateDashboardCache();
    syncStudentIndex(enrollData.userId);

    return json({
      success: true,
      message: "Sertifikat berhasil dihapus. Peserta dapat klaim ulang.",
    });
  } catch (e) {
    return handleError(e);
  }
}
