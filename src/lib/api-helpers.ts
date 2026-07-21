/**
 * Server-side auth helper.
 * Verifikasi Firebase ID Token dari header Authorization.
 */
import { getAdminAuth } from "./firebase-admin";
import type { DecodedIdToken } from "firebase-admin/auth";

function normalizeAdminCode(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

async function findAdminByCode(rawCode: string) {
  const code = normalizeAdminCode(rawCode);
  if (!code) return null;
  const { getAdminDb } = await import("./firebase-admin");
  const snap = await getAdminDb().collection("admin").get();
  return snap.docs.find((doc) => normalizeAdminCode(doc.data().code) === code) || null;
}

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

export async function requireAuth(req: Request): Promise<DecodedIdToken> {
  // Baca dari Authorization header, atau fallback ke X-Firebase-Token
  // (beberapa hosting strip header Authorization)
  const rawToken =
    req.headers.get("Authorization")?.replace(/^Bearer /, "") ||
    req.headers.get("X-Firebase-Token") ||
    "";

  if (!rawToken) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized: no token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const authHeader = `Bearer ${rawToken}`;
  const decoded = await verifyToken(authHeader);
  if (decoded) return decoded;

  // Fallback: Cek apakah token ini adalah kode admin
  const adminDoc = await findAdminByCode(rawToken);
  if (adminDoc) {
    return { uid: "admin", role: adminDoc.data().role || "admin", email: "admin@ioda.id" } as unknown as DecodedIdToken;
  }

  console.error("[requireAuth] Token not valid as Firebase ID token or admin code");
  throw new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

/** Sama seperti requireAuth, tapi juga cek role admin di Firestore */
export async function requireAdmin(req: Request): Promise<DecodedIdToken> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  
  const token = authHeader.slice(7);
  const adminDoc = await findAdminByCode(token);

  if (!adminDoc) {
    throw new Response(
      JSON.stringify({ error: "Forbidden: Admin only" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Mengembalikan mock DecodedIdToken agar API tidak error (uid="admin")
  return { uid: "admin", role: adminDoc.data().role || "admin", email: "admin@ioda.id" } as unknown as DecodedIdToken;
}

/**
 * Seperti requireAdmin, tapi WAJIB Super Admin (doc id "superadmin" di
 * collection `admin`). Dipakai untuk aksi sensitif (mis. percepat penyelesaian
 * semua lead tanpa menunggu batas 5 hari).
 */
export async function requireSuperAdmin(req: Request): Promise<DecodedIdToken> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.slice(7);
  const adminDoc = await findAdminByCode(token);

  if (!adminDoc || adminDoc.id !== "superadmin") {
    throw new Response(
      JSON.stringify({ error: "Forbidden: Super Admin only" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return { uid: "admin", role: "superadmin", email: "admin@ioda.id" } as unknown as DecodedIdToken;
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

/** Validasi sync key untuk endpoint GAS cron. Throw Response 401 kalau invalid. */
export async function requireSyncKey(req: Request): Promise<void> {
  const provided = req.headers.get("X-Sync-Key") || "";
  if (!provided) {
    throw new Response(
      JSON.stringify({ error: "Missing X-Sync-Key header" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  const { getAdminDb } = await import("./firebase-admin");
  const doc = await getAdminDb().collection("settings").doc("app").get();
  const settings = (doc.exists ? doc.data() : {}) || {};
  const expected = (settings.syncKey as string) || "";
  if (!expected || provided !== expected) {
    throw new Response(
      JSON.stringify({ error: "Invalid sync key" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
}

/** Format angka pakai locale id-ID (thousands `.`, decimal `,`) */
export function fmtIntID(n: number): string {
  return Math.round(n).toLocaleString("id-ID");
}

export function fmtDecID(n: number, digits = 1): string {
  return Number(n).toFixed(digits).replace(".", ",");
}

export function pctOf(n: number, target: number): number {
  return target > 0 ? Math.round((n / target) * 100) : 0;
}
