/**
 * GET /api/verify/[certId]
 * Route publik (tanpa auth) untuk memvalidasi sertifikat via QR Code.
 */
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ certId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { certId } = await params;
    
    const db = getAdminDb();
    const doc = await db.collection("certificateVerifications").doc(certId).get();
    
    if (!doc.exists) {
      return json({ valid: false, error: "Sertifikat tidak ditemukan" }, 404);
    }
    
    const data = doc.data()!;
    if (!data.isValid) {
      return json({ valid: false, error: "Sertifikat sudah ditarik atau tidak valid" }, 400);
    }
    
    return json({
      valid: true,
      data: {
        certId: data.certId,
        userName: data.userName,
        courseName: data.courseName,
        issuerName: data.issuerName,
        claimedAt: data.claimedAt,
      }
    });
  } catch (e) {
    return handleError(e);
  }
}
