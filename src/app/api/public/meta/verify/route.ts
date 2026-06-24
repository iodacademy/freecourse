import { NextRequest } from "next/server";
import { json, handleError } from "@/lib/api-helpers";
import { getAdminDb } from "@/lib/firebase-admin";
import { invalidateDashboardCache } from "@/lib/dashboard-aggregator";
import { syncStudentIndex } from "@/lib/sync-student-index";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

/**
 * POST /api/public/meta/verify
 * Body: { email }  (email yang dipilih peserta di gerbang verifikasi)
 *
 * Alur:
 * 1. Cari dokumen di collection `leads` berdasarkan email (huruf kecil).
 * 2. Jika ketemu → buat dokumen `users/{email}` dan `enrollments/{email}`.
 *    - channelSource: "fb_instant_form"
 *    - role: "student", profileCompleted: true
 *    - profileData disalin dari leads.profileData (sudah dipetakan saat ingest)
 *    - utmData & event(null) sesuai kesepakatan
 * 3. Tandai leads.verified = true.
 * 4. Kembalikan userData (untuk dipakai komponen journey, format alamat_email dll).
 *
 * Catatan: mengikuti pola action 'identity' di
 * src/app/api/public/standalone/submit/route.ts agar konsisten.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email) {
      return json({ error: "Email wajib diisi" }, 400);
    }

    const db = getAdminDb();

    // 1. Ambil data dari leads
    const leadRef = db.collection("leads").doc(email);
    const leadSnap = await leadRef.get();

    if (!leadSnap.exists) {
      return json(
        {
          error: "not_found",
          message:
            "Data belum ditemukan. Jika baru saja mendaftar, tunggu beberapa saat lalu coba lagi.",
        },
        404
      );
    }

    const lead = leadSnap.data() || {};
    const userId = email;
    const enrollmentId = email;

    // profileData sudah disusun rapi saat ingest. Pastikan field email & email key benar.
    const profileData = {
      ...(lead.profileData || {}),
      alamat_email: email,
    };

    const displayName = String(
      lead.nama || profileData.nama_lengkap || "Peserta"
    );
    const emailUsername = email.split("@")[0] || "user";
    const utmData = lead.utmData || null;

    // 2a. Buat / update dokumen users
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const userPayload: Record<string, any> = {
      uid: userId,
      email,
      emailUsername,
      displayName,
      role: "student",
      profileCompleted: true,
      channelSource: "beasiswa",
      detailChannel: "All Beasiswa - Facebook Instant Forms",
      eventId: null,
      utmData,
      profileData,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!userSnap.exists) {
      userPayload.createdAt = FieldValue.serverTimestamp();
    }
    await userRef.set(userPayload, { merge: true });

    // 2b. Buat dokumen enrollments jika belum ada
    const enrollRef = db.collection("enrollments").doc(enrollmentId);
    const enrollSnap = await enrollRef.get();
    if (!enrollSnap.exists) {
      await enrollRef.set({
        id: enrollmentId,
        userId,
        email,
        displayName,
        courseId: "course-main",
        channelSource: "beasiswa",
        detailChannel: "All Beasiswa - Facebook Instant Forms",
        eventId: null,
        status: "active",
        currentStep: 1,
        stepProgress: {},
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // 3. Tandai lead sudah diverifikasi
    await leadRef.set(
      { verified: true, verifiedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    invalidateDashboardCache();
    syncStudentIndex(userId);

    // 4. Kembalikan userData untuk komponen journey
    //    Komponen memakai field alamat_email & nama_lengkap.
    return json({
      success: true,
      userData: {
        ...profileData,
        alamat_email: email,
        nama_lengkap: displayName,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
