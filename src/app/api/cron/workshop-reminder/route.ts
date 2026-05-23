import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";
import { sendEmailViaGAS } from "@/lib/gas-email";
import { workshopReminderEmail } from "@/lib/email-templates/workshop-emails";

/**
 * GET /api/cron/workshop-reminder
 * Endpoint untuk dijalankan via Cron Job eksternal (misal: cron-job.org atau Vercel Cron).
 * Berjalan setiap hari jam 12.00 WIB (05:00 UTC).
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Verifikasi keamanan (opsional, tapi disarankan)
    // Cek header Authorization atau query param ?key=ADMINFL26
    const authHeader = req.headers.get("authorization");
    const queryKey = req.nextUrl.searchParams.get("key");
    const expectedKey = process.env.ADMIN_ACCESS_CODE || "ADMINFL26";

    if (authHeader !== `Bearer ${expectedKey}` && queryKey !== expectedKey) {
      return json({ error: "Unauthorized" }, 401);
    }

    const db = getAdminDb();

    // 2. Hitung tanggal besok dalam format ISO (YYYY-MM-DD)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().split("T")[0]; // "2026-06-15"

    console.log(`[cron] Menjalankan workshop reminder untuk tanggal: ${tomorrowISO}`);

    // 3. Query semua event workshop aktif yang diadakan besok
    const eventsSnap = await db.collection("events")
      .where("channelType", "==", "b2c_workshop")
      .where("status", "==", "active")
      .get();

    const matchingEvents = eventsSnap.docs.filter((doc) => {
      const wd = doc.data().workshopData;
      return wd?.date === tomorrowISO;
    });

    if (matchingEvents.length === 0) {
      return json({ message: `Tidak ada workshop untuk tanggal ${tomorrowISO}` });
    }

    let totalEmailsSent = 0;

    // 4. Kirim email ke semua peserta untuk setiap event
    for (const eventDoc of matchingEvents) {
      const eventData = eventDoc.data();
      const wd = eventData.workshopData;
      const eventId = eventDoc.id;

      const enrollSnap = await db.collection("enrollments")
        .where("eventId", "==", eventId)
        .where("channelSource", "==", "workshop")
        .get();

      for (const enrollDoc of enrollSnap.docs) {
        const enData = enrollDoc.data();
        const recipientEmail = enData.email;
        const recipientName = enData.displayName || recipientEmail?.split("@")[0] || "Peserta";

        if (!recipientEmail) continue;

        const { subject, htmlBody } = workshopReminderEmail({
          recipientName,
          workshopTitle: wd.title || eventId,
          date: wd.date || "",
          dayLabel: wd.dayLabel || "",
          time: wd.time || "",
          platform: wd.platform || "",
          meetingLink: wd.meetingLink || "",
          waGroupLink: wd.waGroupLink || "",
          speakerName: wd.speakerName || "",
          speakerTitle: wd.speakerTitle || "",
        });

        // Fire and forget email
        sendEmailViaGAS({ to: recipientEmail, subject, htmlBody }).catch(e => {
          console.error(`[cron] Gagal kirim reminder ke ${recipientEmail}`, e);
        });
        
        totalEmailsSent++;
      }
    }

    return json({ 
      message: "Sukses", 
      eventsProcessed: matchingEvents.length,
      emailsTriggered: totalEmailsSent
    });
  } catch (e) {
    return handleError(e);
  }
}
