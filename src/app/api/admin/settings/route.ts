import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();
    const doc = await db.collection("settings").doc("app").get();
    
    if (!doc.exists) {
      return json({});
    }

    return json(doc.data());
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const db = getAdminDb();
    
    await db.collection("settings").doc("app").set({
      ...body,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return json({ success: true, message: "Pengaturan berhasil disimpan" });
  } catch (e) {
    return handleError(e);
  }
}
