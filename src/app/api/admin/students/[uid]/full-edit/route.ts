/**
 * PATCH /api/admin/students/[uid]/full-edit
 *
 * Admin mengedit data identitas peserta secara menyeluruh.
 * Saat disimpan:
 * - Update users.displayName & users.profileData (snake_case + camelCase agar
 *   cocok untuk semua jenis peserta).
 * - Samakan enrollments.displayName.
 * - Jika NAMA berubah DAN peserta sudah punya sertifikat → generate ulang
 *   sertifikat otomatis (nama baru) + perbarui link. Tidak kirim email.
 *
 * Tidak menyentuh progres belajar, nilai kuis, survei, atau kode bonus.
 *
 * Auth: requireAdmin.
 *
 * Body (semua opsional kecuali yang ingin diubah):
 * {
 *   nama_lengkap, jenis_kelamin, tanggal_lahir, nomor_whatsapp,
 *   asal_daerah, disabilitas, kategori_disabilitas_yang_anda_miliki,
 *   jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati
 * }
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";
import { regenerateCertificate } from "@/lib/regenerate-cert";

type Ctx = { params: Promise<{ uid: string }> };

// Pasangan nama field snake_case (peserta Meta) → camelCase (peserta lama).
const FIELD_ALIAS: Record<string, string> = {
  nama_lengkap: "namaLengkap",
  jenis_kelamin: "jenisKelamin",
  tanggal_lahir: "tanggalLahir",
  nomor_whatsapp: "nomorWA",
  asal_daerah: "kotaKabupaten",
  disabilitas: "disabilitas",
  kategori_disabilitas_yang_anda_miliki: "kategoriDisabilitas",
};

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { uid } = await params;
    if (!uid) return json({ error: "UID tidak valid" }, 400);

    const body = await req.json();
    const db = getAdminDb();

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return json({ error: "Peserta tidak ditemukan" }, 404);

    const userData = userSnap.data() || {};
    const oldProfile = userData.profileData || {};
    const oldName = String(userData.displayName || oldProfile.nama_lengkap || oldProfile.namaLengkap || "");

    // Susun profileData baru = gabungan lama + perubahan (snake_case + alias camelCase).
    const newProfile: Record<string, any> = { ...oldProfile };

    // Daftar field yang boleh diedit (snake_case sebagai sumber kebenaran).
    const editableFields = [
      "nama_lengkap",
      "jenis_kelamin",
      "tanggal_lahir",
      "nomor_whatsapp",
      "asal_daerah",
      "disabilitas",
      "kategori_disabilitas_yang_anda_miliki",
      "jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati",
    ];

    for (const f of editableFields) {
      if (body[f] !== undefined) {
        const val = typeof body[f] === "string" ? body[f].trim() : body[f];
        newProfile[f] = val;
        // Tulis juga ke nama camelCase (agar peserta lama tetap konsisten).
        const alias = FIELD_ALIAS[f];
        if (alias) newProfile[alias] = val;
      }
    }

    // Pastikan alamat_email tidak berubah (identitas dokumen).
    if (userData.email) newProfile.alamat_email = String(userData.email).toLowerCase();

    const newName = String(
      newProfile.nama_lengkap || newProfile.namaLengkap || oldName || "Peserta"
    ).trim();
    const nameChanged = newName !== oldName && newName.length > 0;

    // 1. Update users
    await userRef.set(
      {
        displayName: newName,
        profileData: newProfile,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 2. Samakan displayName di enrollments milik user ini.
    //    Enrollment standalone/Meta ber-ID email; cari juga via userId untuk aman.
    const enrollIdByEmail = String(userData.email || "").toLowerCase();
    const enrollRefs = new Map<string, FirebaseFirestore.DocumentReference>();
    if (enrollIdByEmail) {
      enrollRefs.set(enrollIdByEmail, db.collection("enrollments").doc(enrollIdByEmail));
    }
    const byUserId = await db.collection("enrollments").where("userId", "==", uid).get();
    byUserId.docs.forEach((d) => enrollRefs.set(d.id, d.ref));

    for (const ref of enrollRefs.values()) {
      const snap = await ref.get();
      if (snap.exists) {
        await ref.set(
          { displayName: newName, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
    }

    // 3. Jika nama berubah → regenerate sertifikat untuk tiap enrollment yang
    //    sudah punya sertifikat. (Helper otomatis melewati yang belum klaim.)
    let certRegenerated = false;
    let newCertUrl: string | null = null;
    if (nameChanged) {
      for (const id of enrollRefs.keys()) {
        try {
          const result = await regenerateCertificate(id, newName);
          if (result.regenerated) {
            certRegenerated = true;
            newCertUrl = result.driveUrl || null;
          }
        } catch (e) {
          console.error("[full-edit] gagal regenerate sertifikat:", id, e);
        }
      }
    }

    return json({
      success: true,
      nameChanged,
      certRegenerated,
      newCertUrl,
      displayName: newName,
    });
  } catch (e) {
    return handleError(e);
  }
}

// Alias karena beberapa hosting memblok PATCH/PUT.
export const POST = PATCH;
export const PUT = PATCH;
