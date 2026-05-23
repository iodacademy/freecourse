import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb();
    
    const snapshot = await db.collection("forms").where("isActive", "==", true).limit(1).get();
    
    if (snapshot.empty) {
      return json({ error: "No active form found" }, 404);
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return json({
      id: doc.id,
      title: data.title,
      sections: data.sections || [],
    });
  } catch (e) {
    return handleError(e);
  }
}
