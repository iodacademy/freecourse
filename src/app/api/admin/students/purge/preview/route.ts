/**
 * GET /api/admin/students/purge/preview
 *
 * Preview penghapusan massal peserta berdasarkan channelSource + detailChannel.
 *
 * Query:
 *   - channel   (opsional) : filter channelSource (umum|beasiswa|kemitraan|workshop)
 *   - details   (opsional) : daftar detailChannel dipisah "|" (yang dicentang)
 *   - list=1    (opsional) : sertakan daftar peserta (untuk unduh CSV)
 *
 * Tanpa `details` → kembalikan opsi detailChannel + count untuk channel tsb.
 * Dengan `details` → kembalikan jumlah peserta yang akan terhapus (+ daftar bila list=1).
 *
 * Read-only. Super Admin saja (konsisten dengan endpoint purge).
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireSuperAdmin, json, handleError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type UserRow = {
  uid: string;
  email: string;
  namaLengkap: string;
  channelSource: string;
  detailChannel: string;
};

function readUser(doc: FirebaseFirestore.QueryDocumentSnapshot): UserRow {
  const u = doc.data() as any;
  const pd = u.profileData || {};
  return {
    uid: doc.id,
    email: u.email || doc.id,
    namaLengkap: pd.nama_lengkap || pd.namaLengkap || u.displayName || "-",
    channelSource: (u.channelSource || "").toLowerCase(),
    detailChannel: u.detailChannel || "-",
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);

    const sp = req.nextUrl.searchParams;
    const channel = (sp.get("channel") || "").toLowerCase();
    const detailsRaw = sp.get("details") || "";
    const details = detailsRaw ? detailsRaw.split("|").filter(Boolean) : [];
    const withList = sp.get("list") === "1";

    const db = getAdminDb();

    // Ambil peserta (role student). Filter channel di query bila ada.
    let q: FirebaseFirestore.Query = db.collection("users").where("role", "==", "student");
    if (channel) q = q.where("channelSource", "==", channel);
    const snap = await q.get();

    const rows = snap.docs.map(readUser);

    // Ringkasan per channelSource (dari SEMUA student, tanpa filter channel)
    // supaya UI bisa menampilkan pilihan channel + jumlahnya.
    let channelSummary: Record<string, number> = {};
    if (!channel) {
      for (const r of rows) {
        const ch = r.channelSource || "(kosong)";
        channelSummary[ch] = (channelSummary[ch] || 0) + 1;
      }
    } else {
      const allSnap = await db.collection("users").where("role", "==", "student").get();
      for (const d of allSnap.docs) {
        const ch = ((d.data() as any).channelSource || "").toLowerCase() || "(kosong)";
        channelSummary[ch] = (channelSummary[ch] || 0) + 1;
      }
    }

    // Opsi detailChannel + count (dalam channel terpilih)
    const detailCounts = new Map<string, number>();
    for (const r of rows) {
      const dc = r.detailChannel || "-";
      detailCounts.set(dc, (detailCounts.get(dc) || 0) + 1);
    }
    const detailChannelOptions = Array.from(detailCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));

    // Bila detailChannel dicentang → hitung target penghapusan.
    const targets = details.length
      ? rows.filter((r) => details.includes(r.detailChannel || "-"))
      : [];

    return json({
      channelSummary,
      detailChannelOptions,
      totalInChannel: rows.length,
      targetCount: targets.length,
      // Daftar hanya dikirim bila diminta (untuk CSV backup).
      targets: withList ? targets : undefined,
    });
  } catch (e) {
    return handleError(e);
  }
}
