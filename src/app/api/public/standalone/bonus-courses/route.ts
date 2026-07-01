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
        const cat = data.category || "vl";
        return {
          id: d.id,
          name: data.name || "",
          category: cat,
          benefitType:
            data.benefitType ||
            (cat === "review_cv" ? "review_cv" : cat === "downloadable" ? "downloadable" : "course"),
          description: data.description || "",
          portalUrl: data.portalUrl || "",
          groupLink: data.groupLink || "",
          workshopData: data.workshopData || null,
          downloadUrl: data.downloadUrl || "",
        };
      })
      // Sembunyikan review_cv dari jalur standalone (login-only).
      .filter((c) => c.category !== "review_cv")
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
      
    return json(docs);
  } catch (e) {
    return handleError(e);
  }
}
