import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    
    if (!id) {
      return json({ error: "ID tidak valid" }, 400);
    }

    const db = getAdminDb();
    await db.collection("admin").doc(id).delete();

    return json({ success: true, message: "Akses admin berhasil dihapus" });
  } catch (e) {
    return handleError(e);
  }
}
