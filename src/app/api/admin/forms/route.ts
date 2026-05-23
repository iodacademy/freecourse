import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();
    
    const snapshot = await db.collection("forms").orderBy("createdAt", "desc").get();
    const forms = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      };
    });

    return json(forms);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();
    const body = await req.json();

    const newForm = {
      title: body.title || "Form Baru",
      isActive: false,
      sections: body.sections || [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("forms").add(newForm);
    
    return json({
      id: docRef.id,
      ...newForm,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, 201);
  } catch (e) {
    return handleError(e);
  }
}
