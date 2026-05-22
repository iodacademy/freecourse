/**
 * Server-side auth helper.
 * Verifikasi Firebase ID Token dari header Authorization.
 */
import { getAdminAuth } from "./firebase-admin";
import type { DecodedIdToken } from "firebase-admin/auth";

export async function verifyToken(
  authHeader: string | null
): Promise<DecodedIdToken | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}

/** Ambil token dari request, verifikasi, throw Response jika gagal */
export async function requireAuth(req: Request): Promise<DecodedIdToken> {
  const decoded = await verifyToken(req.headers.get("Authorization"));
  if (!decoded) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  return decoded;
}

/** Sama seperti requireAuth, tapi juga cek role admin di Firestore */
export async function requireAdmin(req: Request): Promise<DecodedIdToken> {
  const decoded = await requireAuth(req);
  const { getAdminDb } = await import("./firebase-admin");
  const userDoc = await getAdminDb().collection("users").doc(decoded.uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== "admin") {
    throw new Response(
      JSON.stringify({ error: "Forbidden: Admin only" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  return decoded;
}

/** Helper: return JSON response */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Helper: handle thrown Response or unknown error */
export function handleError(e: unknown): Response {
  if (e instanceof Response) return e;
  console.error("[API Error]", e);
  return json({ error: "Internal Server Error" }, 500);
}
