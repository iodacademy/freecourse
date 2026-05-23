/**
 * Firebase Admin SDK — Student Center IODA (project terpisah).
 * Digunakan untuk menulis ke users_vl setelah redeem bonus course.
 * Credentials dari env vars: SC_FIREBASE_*
 */
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

const SC_APP_NAME = "student-center-ioda";

let scApp: App | null = null;
let scDb: Firestore | null = null;

function getScPrivateKey(): string {
  const raw = process.env.SC_FIREBASE_PRIVATE_KEY || "";

  // Jika base64-encoded (tidak diawali "-----")
  if (raw && !raw.startsWith("-----")) {
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf-8");
      // Decoded mungkin masih punya literal \n → convert ke newline asli
      return decoded.replace(/\\n/g, "\n");
    } catch {
      // fallback ke raw
    }
  }

  // Format biasa: ganti literal \n dengan newline asli
  return raw.replace(/\\n/g, "\n");
}

function getScApp(): App {
  const existing = getApps().find((a) => a.name === SC_APP_NAME);
  if (existing) return existing;

  return initializeApp(
    {
      credential: cert({
        projectId:   process.env.SC_FIREBASE_PROJECT_ID!,
        clientEmail: process.env.SC_FIREBASE_CLIENT_EMAIL!,
        privateKey:  getScPrivateKey(),
      }),
    },
    SC_APP_NAME
  );
}

export function getScDb(): Firestore {
  if (!scDb) {
    scDb = getFirestore(getScApp());
  }
  return scDb;
}
