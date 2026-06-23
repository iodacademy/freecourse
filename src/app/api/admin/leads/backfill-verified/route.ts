import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError, requireSuperAdmin } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/leads/backfill-verified  (Super Admin only)  — SEKALI JALAN
 *
 * Memperbaiki data lama: menandai `verified: true` pada lead yang SEBENARNYA
 * sudah jadi siswa (punya dokumen users) atau sudah punya sertifikat
 * (enrollments.certificateClaimed). Tujuannya supaya tombol
 * "Auto Complete — Instant Form" tidak lagi mendeteksi ratusan lead lama yang
 * sebetulnya sudah selesai.
 *
 * Cara kerja: ambil sekali daftar email yang sudah punya users + sudah
 * certified, lalu untuk tiap lead yang `verified != true` tapi ada di salah satu
 * daftar itu → set verified:true. Idempoten (aman dijalankan berulang).
 *
 * Auth: header Authorization: Bearer <kode super admin>.
 */

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const db = getAdminDb();

    // Ambil paralel: semua leads, semua users, semua enrollments certified.
    const [leadsSnap, usersSnap, certSnap] = await Promise.all([
      db.collection("leads").get(),
      db.collection("users").get(),
      db.collection("enrollments").where("certificateClaimed", "==", true).get(),
    ]);

    // Set email yang sudah "jadi siswa" (verifikasi) atau sudah certified.
    const verifiedEmails = new Set<string>();
    usersSnap.docs.forEach((d) => {
      const data = d.data();
      const em = String(data.email || d.id || "").toLowerCase();
      if (em) verifiedEmails.add(em);
    });
    certSnap.docs.forEach((d) => {
      const data = d.data();
      const em = String(data.email || data.userId || d.id || "").toLowerCase();
      if (em) verifiedEmails.add(em);
    });

    // Tandai lead yang cocok dengan batched writes (maks 500 op/batch).
    let updated = 0;
    let batch = db.batch();
    let ops = 0;

    for (const doc of leadsSnap.docs) {
      const data = doc.data();
      if (data.verified === true) continue; // sudah ditandai
      const em = String(data.email || doc.id || "").toLowerCase();
      if (!em || !verifiedEmails.has(em)) continue; // belum jadi siswa → biarkan

      batch.update(doc.ref, {
        verified: true,
        verifiedAt: FieldValue.serverTimestamp(),
        backfilledVerified: true,
      });
      ops++;
      updated++;
      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    return json({
      success: true,
      totalLeads: leadsSnap.size,
      knownVerifiedEmails: verifiedEmails.size,
      updated,
    });
  } catch (e) {
    return handleError(e);
  }
}
