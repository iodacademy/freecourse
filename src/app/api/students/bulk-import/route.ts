/**
 * POST /api/students/bulk-import
 * Import massal daftar email untuk Channel 1 (B2B).
 * Menyimpan array email ke dalam event.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { eventId, emails } = await req.json();

    if (!eventId || !emails || !Array.isArray(emails)) {
      return json({ error: "eventId and emails array required" }, 400);
    }

    const db = getAdminDb();
    const eventRef = db.collection("events").doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) return json({ error: "Event not found" }, 404);

    // Filter email yang valid menggunakan basic regex
    const validEmails = emails.filter(e => /^\S+@\S+\.\S+$/.test(e));
    
    // Append ke existing array (gunakan union untuk menghindari duplikat)
    await eventRef.update({
      bulkImportedEmails: FieldValue.arrayUnion(...validEmails),
      updatedAt: FieldValue.serverTimestamp()
    });

    return json({ 
      success: true, 
      importedCount: validEmails.length,
      ignoredCount: emails.length - validEmails.length 
    });
  } catch (e) {
    return handleError(e);
  }
}
