/**
 * GET /api/events/public/[id]
 * Public endpoint — tidak butuh autentikasi.
 * Digunakan oleh landing page workshop untuk membaca data event.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!id) return json({ error: "Event ID diperlukan" }, 400);

    const db = getAdminDb();
    const docSnap = await db.collection("events").doc(id).get();

    if (!docSnap.exists) {
      return json({ error: "Event tidak ditemukan" }, 404);
    }

    const data = docSnap.data()!;

    // Hanya expose field yang aman untuk publik
    return json({
      id: docSnap.id,
      name: data.name,
      description: data.description,
      channelType: data.channelType,
      status: data.status,
      landingPageConfig: data.landingPageConfig ?? null,
      workshopData: data.workshopData ?? null,
      beasiswaConfig: data.beasiswaConfig ?? null,
      benefitCategories: data.benefitCategories ?? data.beasiswaConfig?.benefitCategories ?? null,
    });
  } catch (e) {
    return handleError(e);
  }
}
