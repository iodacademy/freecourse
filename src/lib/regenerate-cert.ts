/**
 * Helper untuk men-generate ULANG sertifikat utama saat data nama berubah.
 * Dipakai oleh endpoint admin full-edit.
 *
 * Alur:
 * 1. Hapus PDF lama di Google Drive (via GAS delete_old_cert) bila ada.
 * 2. Generate PDF baru (via GAS generate_main_cert) dengan nama terbaru.
 * 3. Simpan link/file id baru + certificateName ke enrollment.
 *
 * Tanggal di sertifikat tetap memakai tanggal klaim asli (certificateClaimedAt)
 * agar konsisten dengan sertifikat sebelumnya.
 */
import { getAdminDb } from "@/lib/firebase-admin";
import { normalizeCertName } from "@/lib/cert-name";
import { FieldValue } from "firebase-admin/firestore";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatClaimDate(claimedAt: any): string {
  let d: Date;
  if (claimedAt && typeof claimedAt === "object" && claimedAt._seconds) {
    d = new Date(claimedAt._seconds * 1000);
  } else if (claimedAt) {
    d = new Date(claimedAt);
  } else {
    d = new Date();
  }
  if (isNaN(d.getTime())) d = new Date();
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * @returns { regenerated: boolean, driveUrl?, reason? }
 */
export async function regenerateCertificate(
  enrollmentId: string,
  newName: string
): Promise<{ regenerated: boolean; driveUrl?: string | null; reason?: string }> {
  const db = getAdminDb();

  // Rapikan nama (konversi font "fancy" Unicode → latin) supaya tak kosong di PDF.
  newName = normalizeCertName(newName) || newName;

  const enrollRef = db.collection("enrollments").doc(enrollmentId);
  const enrollSnap = await enrollRef.get();
  if (!enrollSnap.exists) return { regenerated: false, reason: "enrollment_not_found" };

  const enroll = enrollSnap.data()!;
  // Hanya regenerate jika peserta sudah pernah klaim sertifikat.
  if (!enroll.certificateClaimed) return { regenerated: false, reason: "not_claimed" };

  const settingsDoc = await db.collection("settings").doc("app").get();
  const settings = settingsDoc.data() || {};
  const gasWebAppUrl: string = settings.gasWebAppUrl || "";
  const mainCertSlideTemplateId: string = settings.mainCertSlideTemplateId || "";

  if (!gasWebAppUrl) return { regenerated: false, reason: "gas_not_configured" };

  const certId = enroll.certificateId || `CERT-${new Date().getFullYear()}-${Math.random().toString(16).substr(2, 6).toUpperCase()}`;
  const courseName = enroll.certificateCourseName || settings.mainCertTitle || "Workshop Literasi Finansial";
  const claimDate = formatClaimDate(enroll.certificateClaimedAt);

  // 1. Hapus PDF lama (abaikan error — mungkin sudah terhapus)
  if (enroll.certificateDriveFileId) {
    try {
      await fetch(gasWebAppUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_old_cert",
          fileId: enroll.certificateDriveFileId,
        }),
      });
    } catch (e) {
      console.error("[regenerate-cert] gagal hapus PDF lama:", e);
    }
  }

  // 2. Generate PDF baru dengan nama terbaru
  let driveUrl: string | null = null;
  let driveFileId: string | null = null;
  try {
    const gasRes = await fetch(gasWebAppUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate_main_cert",
        templateId: mainCertSlideTemplateId,
        certId,
        userName: newName,
        courseName,
        claimDate,
        email: enroll.email,
      }),
    });
    if (gasRes.ok) {
      const gasData = await gasRes.json();
      driveUrl = gasData.downloadUrl || gasData.pdfUrl || null;
      driveFileId = gasData.fileId || null;
    } else {
      return { regenerated: false, reason: `gas_http_${gasRes.status}` };
    }
  } catch (e) {
    console.error("[regenerate-cert] gagal generate PDF baru:", e);
    return { regenerated: false, reason: "gas_error" };
  }

  // 3. Simpan link/nama baru ke enrollment
  await enrollRef.set(
    {
      certificateName: newName,
      certificateId: certId,
      certificateDriveUrl: driveUrl || "",
      certificateDriveFileId: driveFileId || "",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { regenerated: true, driveUrl };
}
