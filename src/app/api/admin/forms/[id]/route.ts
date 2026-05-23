import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();
    const { id } = await params;
    const body = await req.json();

    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.sections !== undefined) updateData.sections = body.sections;
    
    // If setting to active, we might need to deactivate others first
    if (body.isActive === true) {
      updateData.isActive = true;
      const batch = db.batch();
      const snapshot = await db.collection("forms").where("isActive", "==", true).get();
      snapshot.docs.forEach(doc => {
        if (doc.id !== id) {
          batch.update(doc.ref, { isActive: false, updatedAt: FieldValue.serverTimestamp() });
        }
      });
      batch.update(db.collection("forms").doc(id), updateData);
      await batch.commit();
    } else if (body.isActive === false) {
      updateData.isActive = false;
      await db.collection("forms").doc(id).update(updateData);
    } else {
      await db.collection("forms").doc(id).update(updateData);
    }

    return json({ success: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();
    const { id } = await params;

    await db.collection("forms").doc(id).delete();
    
    return json({ success: true });
  } catch (e) {
    return handleError(e);
  }
}
