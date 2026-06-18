import { NextRequest } from "next/server";
import { requireSyncKey, json, handleError } from "@/lib/api-helpers";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

/**
 * POST /api/public/leads/migrate-channel
 *
 * Migrasi MASSAL channelSource peserta standalone lama:
 *   "standalone"  ->  "beasiswa"
 * di collection `users` DAN `enrollments`.
 *
 * Sekali jalan untuk membereskan data lama. Aman diulang (idempotent):
 * hanya menyentuh dokumen yang channelSource-nya masih "standalone".
 *
 * Auth: header X-Sync-Key (sama dengan settings.app.syncKey).
 *
 * Opsional body { from, to } untuk mengganti nilai sumber/tujuan
 * (default from="standalone", to="beasiswa").
 *
 * Cara memanggil (contoh):
 *   POST https://freecourse.iodacademy.id/api/public/leads/migrate-channel
 *   Header: X-Sync-Key: <sync key>
 */
export async function POST(req: NextRequest) {
  try {
    await requireSyncKey(req);

    let body: any = {};
    try { body = await req.json(); } catch { /* body opsional */ }
    // Sumber channel yang dimigrasi: standalone & fb_instant_form (bisa dioverride).
    const fromList: string[] = Array.isArray(body.from)
      ? body.from.map((s: any) => String(s))
      : body.from
        ? [String(body.from)]
        : ["standalone", "fb_instant_form"];
    const to = String(body.to || "beasiswa");
    const detailChannel = String(body.detailChannel || "All Beasiswa - Facebook Instant Forms");

    const db = getAdminDb();

    async function migrateCollection(name: string): Promise<number> {
      let count = 0;
      for (const from of fromList) {
        const snap = await db
          .collection(name)
          .where("channelSource", "==", from)
          .get();
        // Tulis per batch (maks 500 operasi per batch Firestore).
        let batch = db.batch();
        let ops = 0;
        for (const doc of snap.docs) {
          batch.set(
            doc.ref,
            {
              channelSource: to,
              detailChannel,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          count++;
          ops++;
          if (ops >= 450) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
          }
        }
        if (ops > 0) await batch.commit();
      }
      return count;
    }

    const usersUpdated = await migrateCollection("users");
    const enrollmentsUpdated = await migrateCollection("enrollments");

    return json({
      success: true,
      from: fromList,
      to,
      detailChannel,
      usersUpdated,
      enrollmentsUpdated,
    });
  } catch (e) {
    return handleError(e);
  }
}
