/**
 * GET /api/health
 * Diagnostic endpoint — test if Firebase Admin SDK + Firestore can connect.
 * No auth required. Hit /api/health in browser to check.
 */
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
      hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      privateKeyLength: (process.env.FIREBASE_PRIVATE_KEY || "").length,
      privateKeyStartsWith: (process.env.FIREBASE_PRIVATE_KEY || "").substring(0, 20),
    },
  };

  try {
    const { getAdminDb } = await import("@/lib/firebase-admin");
    const db = getAdminDb();
    checks.firebaseInit = "OK";

    // Quick Firestore read
    const testDoc = await db.collection("appSettings").doc("global").get();
    checks.firestoreRead = testDoc.exists ? "OK" : "doc not found (but Firestore connected)";
    checks.firestoreData = testDoc.exists ? Object.keys(testDoc.data()!) : [];
  } catch (e: any) {
    checks.firebaseInit = "FAILED";
    checks.error = e?.message || String(e);
    checks.errorCode = e?.code;
    checks.errorStack = e?.stack?.split("\n").slice(0, 5);
  }

  // Also test token verification with a dummy to see if Auth SDK works
  try {
    const { getAdminAuth } = await import("@/lib/firebase-admin");
    const auth = getAdminAuth();
    checks.authInit = "OK";
    // Don't verify a real token — just confirm auth object is created
  } catch (e: any) {
    checks.authInit = "FAILED";
    checks.authError = e?.message;
  }

  // Check if Authorization header reaches us
  checks.headers = {
    authorization: req.headers.get("Authorization") ? "present" : "missing",
    xFirebaseToken: req.headers.get("X-Firebase-Token") ? "present" : "missing",
    contentType: req.headers.get("Content-Type"),
    host: req.headers.get("Host"),
  };

  return new Response(JSON.stringify(checks, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
