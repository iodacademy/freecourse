/**
 * POST /api/enrollments/[id]/claim-workshop-cert
 * Klaim sertifikat kehadiran workshop.
 * Syarat:
 *  1. User sudah login dan pemilik enrollment ini.
 *  2. channelSource === "workshop".
 *  3. Sertifikat utama (certificateClaimed) sudah diklaim.
 *  4. Belum pernah klaim sertifikat workshop sebelumnya.
 *  5. Tanggal workshop sudah lewat.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAuth, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

type Ctx = { params: Promise<{ id: string }> };

/** Format ISO date ke "15 Juni 2026" (Bahasa Indonesia) */
function formatDateID(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Cek apakah tanggal workshop sudah lewat */
function isEventPassed(isoDate: string): boolean {
  try {
    const eventDate = new Date(isoDate + "T23:59:59");
    return eventDate < new Date();
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const decoded = await requireAuth(req);
    const { id } = await params;

    const db = getAdminDb();
    const enrollRef = db.collection("enrollments").doc(id);
    const enrollDoc = await enrollRef.get();

    if (!enrollDoc.exists) return json({ error: "Enrollment tidak ditemukan" }, 404);

    const enrollData = enrollDoc.data()!;

    // Validasi kepemilikan
    if (enrollData.email !== decoded.email) return json({ error: "Forbidden" }, 403);

    // Validasi: hanya channel workshop
    if (enrollData.channelSource !== "workshop") {
      return json({ error: "Fitur ini hanya untuk peserta channel Workshop" }, 400);
    }

    // Validasi: sertifikat utama harus sudah diklaim
    if (!enrollData.certificateClaimed) {
      return json({ error: "Kamu harus mengklaim sertifikat kursus utama terlebih dahulu" }, 400);
    }

    // Validasi: belum pernah diklaim
    if (enrollData.workshopCertificateClaimed) {
      return json({
        message: "Sertifikat workshop sudah diklaim sebelumnya",
        certId: enrollData.workshopCertificateId,
      });
    }

    // Validasi: ambil data event workshop, pastikan tanggal sudah lewat
    const eventId = enrollData.eventId;
    if (!eventId) return json({ error: "Event ID tidak ditemukan di enrollment ini" }, 400);

    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) return json({ error: "Data event workshop tidak ditemukan" }, 404);

    const eventData = eventDoc.data()!;
    const workshopData = eventData.workshopData || {};
    const workshopDate: string = workshopData.date || "";

    if (!workshopDate || !isEventPassed(workshopDate)) {
      return json({ error: "Sertifikat workshop hanya bisa diklaim setelah acara selesai" }, 400);
    }

    // Ambil data settings untuk template Slide dan URL GAS
    const settingsDoc = await db.collection("settings").doc("app").get();
    const settings = settingsDoc.data() || {};
    const gasWebAppUrl: string = settings.gasWebAppUrl || "";
    const workshopCertSlideTemplateId: string = settings.workshopCertSlideTemplateId || "";

    if (!gasWebAppUrl) {
      return json({ error: "URL Google Apps Script belum dikonfigurasi di Pengaturan Admin" }, 500);
    }

    // Ambil nama user
    const userDoc = await db.collection("users").doc(enrollData.userId).get();
    const userName = userDoc.data()?.profileData?.namaLengkap
      || userDoc.data()?.displayName
      || decoded.name
      || "Peserta";

    // Generate ID sertifikat workshop
    const year = new Date().getFullYear();
    const randomHex = Math.random().toString(16).substr(2, 6).toUpperCase();
    const wsCertId = `WS-CERT-${year}-${randomHex}`;


    // Update enrollment
    await enrollRef.update({
      workshopCertificateClaimed: true,
      workshopCertificateClaimedAt: FieldValue.serverTimestamp(),
      workshopCertificateId: wsCertId,
      workshopCertificateName: userName,
      workshopTitle: workshopData.title || "Workshop IODA Academy",
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 3. Panggil GAS untuk generate PDF sertifikat dan kirim email
    let downloadUrl: string | null = null;
    if (gasWebAppUrl) {
      try {
        const gasPayload = {
          action: "generate_workshop_cert",
          templateId: workshopCertSlideTemplateId,
          certId: wsCertId,
          userName,
          workshopTitle: workshopData.title || "Workshop IODA Academy",
          workshopDate: formatDateID(workshopDate),
          workshopDay: workshopData.dayLabel || "",
          workshopTime: workshopData.time || "",
          speakerName: workshopData.speakerName || "",
          speakerTitle: workshopData.speakerTitle || "",
          email: decoded.email,
        };

        const gasRes = await fetch(gasWebAppUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gasPayload),
        });

        if (gasRes.ok) {
          const gasData = await gasRes.json();
          downloadUrl = gasData.downloadUrl || gasData.pdfUrl || null;
        }
      } catch (gasErr) {
        console.error("[claim-workshop-cert] GAS error:", gasErr);
        // Tidak gagalkan proses, data sudah tersimpan di Firestore
      }
    }

    return json({
      success: true,
      message: "Sertifikat kehadiran workshop berhasil diklaim!",
      certId: wsCertId,
      downloadUrl,
    });
  } catch (e) {
    return handleError(e);
  }
}
