/**
 * POST /api/admin/students/purge
 *
 * HAPUS MASSAL peserta berdasarkan channelSource + daftar detailChannel.
 * PERMANEN & TIDAK BISA DIBATALKAN.
 *
 * Body: {
 *   channel: string,        // channelSource, WAJIB
 *   details: string[],      // daftar detailChannel yang dicentang, WAJIB (min 1)
 *   confirm: string,        // WAJIB, harus sama persis dengan `HAPUS <N>` (N = jumlah target)
 * }
 *
 * Yang dihapus per peserta:
 *   - Firebase Authentication (akun login)
 *   - users/{uid}
 *   - enrollments (semua milik user)
 *   - certificates (semua milik user)
 *   - studentsIndex (index pagination)
 *
 * TIDAK menghapus koleksi `leads` (sengaja — dipertahankan sebagai jejak/backup).
 *
 * Pengaman:
 *   - Super Admin saja.
 *   - `details` tidak boleh kosong (mencegah "hapus semua" tanpa sengaja).
 *   - `confirm` diverifikasi ULANG di server terhadap jumlah aktual saat ini.
 */
import { NextRequest } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { requireSuperAdmin, json, handleError } from "@/lib/api-helpers";
import { invalidateDashboardCache } from "@/lib/dashboard-aggregator";
import { removeStudentIndex } from "@/lib/sync-student-index";

export const dynamic = "force-dynamic";

// Batas aman sekali proses (hindari request kelamaan / timeout).
const MAX_DELETE = 2000;

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req);

    const body = await req.json();
    const channel = String(body?.channel || "").toLowerCase().trim();
    const details: string[] = Array.isArray(body?.details)
      ? body.details.filter((d: unknown) => typeof d === "string" && d.trim() !== "")
      : [];
    const confirm = String(body?.confirm || "").trim();

    if (!channel) return json({ error: "channel wajib diisi" }, 400);
    if (details.length === 0) {
      return json({ error: "Pilih minimal satu Detail Channel. Menolak menghapus tanpa filter." }, 400);
    }

    const db = getAdminDb();
    const auth = getAdminAuth();

    // Ambil target SEKARANG (server-side truth), jangan percaya hitungan client.
    const snap = await db
      .collection("users")
      .where("role", "==", "student")
      .where("channelSource", "==", channel)
      .get();

    const targets = snap.docs.filter((d) => {
      const dc = ((d.data() as any).detailChannel || "-") as string;
      return details.includes(dc);
    });

    const targetCount = targets.length;

    if (targetCount === 0) {
      return json({ error: "Tidak ada peserta yang cocok dengan filter tersebut." }, 400);
    }
    if (targetCount > MAX_DELETE) {
      return json(
        { error: `Terlalu banyak (${targetCount}). Maksimal ${MAX_DELETE} per proses. Persempit filter.` },
        400
      );
    }

    // Verifikasi frasa konfirmasi terhadap jumlah AKTUAL.
    const expected = `HAPUS ${targetCount}`;
    if (confirm !== expected) {
      return json(
        { error: `Frasa konfirmasi tidak cocok. Ketik persis: "${expected}"`, expected, targetCount },
        400
      );
    }

    let deletedUsers = 0;
    let deletedEnrollments = 0;
    let deletedCerts = 0;
    let authDeleted = 0;
    const failed: string[] = [];

    for (const doc of targets) {
      const uid = doc.id;
      try {
        // 1. Firebase Auth (abaikan bila akun tidak ada)
        try {
          await auth.deleteUser(uid);
          authDeleted++;
        } catch (authErr: any) {
          if (authErr?.code !== "auth/user-not-found") {
            console.error("[purge] gagal hapus auth:", uid, authErr?.code || authErr);
          }
        }

        // 2. enrollments milik user (doc id biasanya = email, tapi query by userId aman)
        const enrollSnap = await db.collection("enrollments").where("userId", "==", uid).get();
        if (!enrollSnap.empty) {
          const batch = db.batch();
          enrollSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          deletedEnrollments += enrollSnap.size;
        }

        // 3. certificates milik user
        const certSnap = await db.collection("certificates").where("userId", "==", uid).get();
        if (!certSnap.empty) {
          const batch = db.batch();
          certSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          deletedCerts += certSnap.size;
        }

        // 4. dokumen user
        await doc.ref.delete();
        deletedUsers++;

        // 5. bersihkan index pagination
        removeStudentIndex(uid);
      } catch (e) {
        console.error("[purge] gagal hapus peserta:", uid, e);
        failed.push(uid);
      }
    }

    invalidateDashboardCache();

    return json({
      success: true,
      channel,
      details,
      deletedUsers,
      deletedEnrollments,
      deletedCerts,
      authDeleted,
      failed,
    });
  } catch (e) {
    return handleError(e);
  }
}
