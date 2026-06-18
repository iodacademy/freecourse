/**
 * Helper bersama untuk menyamakan data peserta yang SUDAH terverifikasi
 * (dokumen di `users` & `enrollments`) dengan data terbaru di `leads`.
 *
 * Dipakai oleh:
 * - /api/public/leads/ingest  (otomatis tiap GAS kirim data)
 * - /api/public/leads/resync   (perbaikan massal data lama, sekali jalan)
 *
 * Prinsip aman: HANYA memperbarui identitas (profileData + displayName).
 * TIDAK menyentuh progres belajar, kuis, survei, sertifikat, atau bonus.
 */
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Samakan dokumen users & enrollments milik `email` dengan profileData dari lead.
 * Hanya berjalan jika dokumen users sudah ada (artinya peserta sudah verifikasi).
 *
 * @returns "updated" jika users diperbarui, "skipped" jika belum ada users.
 */
export async function syncUserFromLead(
  email: string,
  leadProfileData: Record<string, any> | undefined,
  leadNama: string
): Promise<"updated" | "skipped"> {
  const db = getAdminDb();
  const userId = email.toLowerCase();

  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();

  // Belum verifikasi → tidak ada yang perlu disamakan (data akan terisi saat verify).
  if (!userSnap.exists) return "skipped";

  // profileData rapi dari lead; pastikan alamat_email konsisten.
  const profileData: Record<string, any> = {
    ...(leadProfileData || {}),
    alamat_email: userId,
  };
  const displayName = String(leadNama || profileData.nama_lengkap || "Peserta");

  await userRef.set(
    {
      profileData,
      displayName,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Samakan juga displayName di enrollments (dipakai untuk nama di sertifikat),
  // tanpa menyentuh field progres/sertifikat lainnya.
  const enrollRef = db.collection("enrollments").doc(userId);
  const enrollSnap = await enrollRef.get();
  if (enrollSnap.exists) {
    await enrollRef.set(
      {
        displayName,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  return "updated";
}
