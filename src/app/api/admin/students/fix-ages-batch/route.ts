/**
 * POST /api/admin/students/fix-ages-batch
 * Perbaiki tahun lahir massal untuk peserta terpilih (usia > 29).
 * Body: { uids: string[] }
 *
 * Aturan:
 *  - HANYA tahun yang diganti → acak 1998–2004 (usia ~21–27, dijamin ≤29).
 *  - Tanggal & bulan asli dipertahankan bila ada.
 *  - Bila tanggal lahir kosong → pakai 01-01 + tahun acak.
 *  - 29 Feb pada tahun non-kabisat di-clamp ke 28 Feb agar tanggal valid.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { invalidateDashboardCache } from "@/lib/dashboard-aggregator";
import { syncStudentIndex } from "@/lib/sync-student-index";
import { FieldValue } from "firebase-admin/firestore";

const YEAR_MIN = 1998;
const YEAR_MAX = 2004;

// Cari key profileData yang berisi tanggal lahir (mengandung "tanggal"+"lahir"),
// mengikuti cara aggregator membaca. Kembalikan { key, value } atau null.
function findBirthField(profileData: Record<string, unknown>): { key: string; value: string } | null {
  for (const k of Object.keys(profileData || {})) {
    const kl = k.toLowerCase();
    if (kl.includes("tanggal") && kl.includes("lahir")) {
      const v = profileData[k];
      if (typeof v === "string" && v.trim()) return { key: k, value: v.trim() };
    }
  }
  return null;
}

// Ambil hari & bulan dari string tanggal (dukung "YYYY-MM-DD" & "DD/MM/YYYY").
// Kembalikan { dd, mm } (string 2 digit) atau null bila tak terbaca.
function parseDayMonth(raw: string): { dd: string; mm: string } | null {
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { dd: m[3], mm: m[2] };
  m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return { dd: m[1], mm: m[2] };
  return null;
}

// Tahun acak 1998–2004 (index-based agar deterministik per-item tanpa Math.random
// yang sulit diaudit — tapi di sini kita boleh pakai acak biasa).
function randomYear(): number {
  const span = YEAR_MAX - YEAR_MIN + 1;
  return YEAR_MIN + Math.floor(Math.random() * span);
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const uids: string[] = Array.isArray(body?.uids) ? body.uids.filter((u: unknown) => typeof u === "string") : [];

    if (uids.length === 0) {
      return json({ error: "Tidak ada peserta yang dipilih" }, 400);
    }
    if (uids.length > 500) {
      return json({ error: "Maksimal 500 peserta per proses" }, 400);
    }

    const db = getAdminDb();
    let updated = 0;
    const failed: string[] = [];

    for (const uid of uids) {
      try {
        const ref = db.collection("users").doc(uid);
        const doc = await ref.get();
        if (!doc.exists) { failed.push(uid); continue; }

        const profileData = (doc.data()?.profileData || {}) as Record<string, unknown>;
        const existing = findBirthField(profileData);

        // Pertahankan dd/mm bila ada, kalau tidak pakai 01-01.
        let dd = "01";
        let mm = "01";
        if (existing) {
          const parsed = parseDayMonth(existing.value);
          if (parsed) { dd = parsed.dd; mm = parsed.mm; }
        }

        const year = randomYear();
        // Clamp 29 Feb → 28 Feb pada tahun non-kabisat.
        if (mm === "02" && dd === "29" && !isLeap(year)) dd = "28";

        const iso = `${year}-${mm}-${dd}`;

        // Tulis ke key kanonik + key asli (bila berbeda) + snake_case bila ada.
        profileData.tanggalLahir = iso;
        if (existing && existing.key !== "tanggalLahir") profileData[existing.key] = iso;
        if (profileData.tanggal_lahir !== undefined) profileData.tanggal_lahir = iso;

        await ref.update({ profileData, updatedAt: FieldValue.serverTimestamp() });
        syncStudentIndex(uid);
        updated++;
      } catch (e) {
        console.error("[fix-ages-batch] gagal untuk", uid, e);
        failed.push(uid);
      }
    }

    invalidateDashboardCache();
    return json({ success: true, updated, failed });
  } catch (e) {
    return handleError(e);
  }
}
