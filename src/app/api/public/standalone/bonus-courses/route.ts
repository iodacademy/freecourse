import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    // Public endpoint for standalone journey - no auth required
    const snap = await getAdminDb().collection("bonusCourseTopics")
      .where("status", "==", "active")
      .get();
      
    const docs = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || "",
          category: data.category || "vl",
          description: data.description || "",
          portalUrl: data.portalUrl || "",
          groupLink: data.groupLink || "",
        };
      })
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
      
    return json(docs);
  } catch (e) {
    return handleError(e);
  }
}
