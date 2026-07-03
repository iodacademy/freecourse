import { NextRequest } from "next/server";
import { requireSyncKey, json, handleError } from "@/lib/api-helpers";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { syncUserFromLead } from "@/lib/leads-sync";
import { applyAutoAge } from "@/lib/auto-age";

export const dynamic = "force-dynamic";

/**
 * POST /api/public/leads/ingest
 *
 * Dipanggil oleh Google Apps Script (add-on di Google Sheet Meta Instant Form).
 * GAS mengirim satu atau beberapa baris Sheet → endpoint ini menulis ke
 * collection `leads` (document ID = email lowercase).
 *
 * Auth: header X-Sync-Key (sama dengan settings.app.syncKey).
 *
 * Body yang diterima (fleksibel — terima 1 objek atau array `rows`):
 *   { rows: [ { ...kolomSheet }, ... ] }   ATAU   { ...kolomSheet }
 *
 * Nama kolom Sheet mengikuti header Meta Instant Form:
 *   id, created_time, ad_id, ad_name, adset_id, adset_name,
 *   campaign_id, campaign_name, form_id, form_name, is_organic, platform,
 *   "form persetujuan", "status disabilitas", "kategori disabilitas",
 *   Domisili, "Minat Pelatihan", "Nama Lengkap", Email,
 *   phone_number, gender, date_of_birth, lead_status
 */

// ── Helper: ambil nilai kolom Sheet secara toleran (beda spasi/huruf besar-kecil) ──
function pick(row: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
      return String(row[k]).trim();
    }
  }
  // Cari versi case-insensitive / tanpa spasi ganda
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  for (const k of keys) {
    const target = norm(k);
    for (const rk of Object.keys(row)) {
      if (norm(rk) === target && String(row[rk]).trim() !== "") {
        return String(row[rk]).trim();
      }
    }
  }
  return "";
}

// ── Normalkan jenis kelamin dari Meta ("male"/"female") ke label komponen ──
function normalizeGender(raw: string): string {
  const v = raw.toLowerCase().trim();
  if (v === "male" || v === "laki-laki" || v === "pria" || v === "l") return "Laki-laki";
  if (v === "female" || v === "perempuan" || v === "wanita" || v === "p") return "Perempuan";
  return raw; // biarkan apa adanya jika tidak dikenali
}

// ── Normalkan tanggal lahir ke format YYYY-MM-DD (dipakai input type=date) ──
function normalizeDob(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  // Sudah YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  // Format MM/DD/YYYY atau DD/MM/YYYY (Meta biasanya MM/DD/YYYY)
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    let [, a, b, y] = m;
    // Asumsi MM/DD/YYYY dari Meta; jika bagian pertama > 12, anggap DD/MM/YYYY
    let month = a, day = b;
    if (Number(a) > 12) { month = b; day = a; }
    return `${y}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return v;
}

// ── Rapikan nomor telepon: ambil digit saja, buang 0/62 di depan ──
function normalizePhone(raw: string): string {
  let v = (raw || "").replace(/\D/g, "");
  v = v.replace(/^62/, "").replace(/^0+/, "");
  return v;
}

function buildLeadDoc(row: Record<string, any>) {
  const email = pick(row, "Email", "email").toLowerCase();
  if (!email) return null;

  const nama = pick(row, "Nama Lengkap", "nama_lengkap", "full_name", "name");
  const persetujuan = pick(row, "form persetujuan", "form_persetujuan");
  const disabilitas = pick(row, "status disabilitas", "status_disabilitas");
  const kategoriDisabilitas = pick(row, "kategori disabilitas", "kategori_disabilitas");
  const domisili = pick(row, "Domisili", "domisili");
  const minat = pick(row, "Minat Pelatihan", "minat_pelatihan");
  const gender = normalizeGender(pick(row, "gender", "Jenis Kelamin", "jenis_kelamin"));
  const dobRaw = normalizeDob(pick(row, "date_of_birth", "Tanggal Lahir", "tanggal_lahir"));
  // Auto-koreksi usia lead: >60 selalu dimudakan, 30–60 sebagian (50%), <=29 dibiarkan.
  // Deterministik per email → stabil walau lead di-sync ulang.
  const dob = applyAutoAge(dobRaw, email);
  const phone = normalizePhone(pick(row, "phone_number", "nomor_whatsapp", "no_wa"));

  // profileData siap pakai (nama field PERSIS seperti komponen standalone)
  const profileData: Record<string, any> = {
    apakah_anda_setuju_dan_bersedia_untuk_mengisi_data_pada_form_ini: persetujuan,
    nama_lengkap: nama,
    alamat_email: email,
    jenis_kelamin: gender,
    tanggal_lahir: dob,
    nomor_whatsapp: phone,
    asal_daerah: domisili,
    disabilitas: disabilitas,
    kategori_disabilitas_yang_anda_miliki: kategoriDisabilitas,
    jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati: minat,
    channelSource: "fb_instant_form",
  };

  const utmData = {
    source: "meta_instant_form",
    campaign_name: pick(row, "campaign_name"),
    adset_name: pick(row, "adset_name"),
    ad_name: pick(row, "ad_name"),
    platform: pick(row, "platform"),
    is_organic: pick(row, "is_organic"),
  };

  return {
    email,
    nama,
    // huruf kecil untuk pencarian awalan (prefix) terindeks di gerbang verifikasi
    nama_lower: nama.toLowerCase(),
    metaLeadId: pick(row, "id"),
    createdTime: pick(row, "created_time"),
    formId: pick(row, "form_id"),
    formName: pick(row, "form_name"),
    leadStatus: pick(row, "lead_status"),
    source: "meta_instant_form",
    utmData,
    profileData,
    raw: row,
    updatedAt: FieldValue.serverTimestamp(),
    // createdAt hanya diset jika dokumen baru (lihat di bawah, via merge + create guard)
  };
}

export async function POST(req: NextRequest) {
  try {
    await requireSyncKey(req);

    const body = await req.json();
    const rows: Record<string, any>[] = Array.isArray(body?.rows)
      ? body.rows
      : Array.isArray(body)
        ? body
        : [body];

    if (!rows.length) {
      return json({ error: "No rows provided" }, 400);
    }

    const db = getAdminDb();
    let saved = 0;
    let created = 0;
    let userSynced = 0; // berapa peserta sudah-verifikasi yang ikut diperbarui
    const skipped: string[] = [];

    for (const row of rows) {
      const lead = buildLeadDoc(row);
      if (!lead) {
        skipped.push(JSON.stringify(row?.id ?? row));
        continue;
      }
      const ref = db.collection("leads").doc(lead.email);
      const snap = await ref.get();
      const payload: Record<string, any> = { ...lead };
      const isNew = !snap.exists;
      if (isNew) {
        payload.createdAt = FieldValue.serverTimestamp();
        payload.verified = false;
        created++;
      }
      await ref.set(payload, { merge: true });
      saved++;

      // Jika peserta ini SUDAH verifikasi (punya dokumen users), samakan
      // profileData & displayName di users/enrollments dengan data lead terbaru.
      try {
        const result = await syncUserFromLead(
          lead.email,
          lead.profileData,
          lead.nama
        );
        if (result === "updated") userSynced++;
      } catch (syncErr) {
        console.error("[leads-ingest] Gagal samakan users:", lead.email, syncErr);
      }
    }

    // Catatan: pengiriman email ajakan dilakukan oleh script GAS (akun
    // studentcenter@iodacademy.id), bukan oleh website. Field `created` di bawah
    // memberi tahu GAS berapa lead baru, tapi GAS menentukan sendiri baris mana
    // yang perlu dikirimi email berdasarkan kolom penanda di Sheet.
    return json({
      success: true,
      saved,
      created,
      userSynced,
      skipped: skipped.length,
      skippedDetail: skipped,
    });
  } catch (e) {
    return handleError(e);
  }
}
