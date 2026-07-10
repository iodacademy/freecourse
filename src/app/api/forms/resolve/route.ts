import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

async function getGlobalForm(db: FirebaseFirestore.Firestore) {
  const snapshot = await db.collection("forms").where("isActive", "==", true).limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0];
}

function toPublicForm(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    title: data.title,
    sections: data.sections || [],
  };
}

export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb();
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId")?.trim();

    if (eventId) {
      const eventDoc = await db.collection("events").doc(eventId).get();
      const formId = eventDoc.exists ? eventDoc.data()?.formId : null;

      if (formId) {
        const customForm = await db.collection("forms").doc(String(formId)).get();
        if (customForm.exists) {
          return json(toPublicForm(customForm));
        }
      }
    }

    const globalForm = await getGlobalForm(db);
    if (!globalForm) {
      return json({ error: "No active form found" }, 404);
    }

    return json(toPublicForm(globalForm));
  } catch (e) {
    return handleError(e);
  }
}
