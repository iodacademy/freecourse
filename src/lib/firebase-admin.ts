/**
 * Firebase Admin SDK — singleton untuk server-side (API Routes).
 * Jangan import file ini di client components.
 */
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";

let app: App;
let adminAuth: Auth;
let adminDb: Firestore;
let adminStorage: Storage;

function getPrivateKey(): string {
  const raw = process.env.FIREBASE_PRIVATE_KEY || "";

  // Jika base64-encoded (tidak diawali "-----")
  if (raw && !raw.startsWith("-----")) {
    try {
      return Buffer.from(raw, "base64").toString("utf-8");
    } catch {
      // fallback ke raw
    }
  }

  // Format biasa: ganti literal \n dengan newline asli
  return raw.replace(/\\n/g, "\n");
}

function getAdminApp(): App {
  if (getApps().length === 0) {
    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: getPrivateKey(),
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET ||
        `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
    });
  } else {
    app = getApps()[0];
  }
  return app;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }
  return adminDb;
}

export function getAdminStorage(): Storage {
  if (!adminStorage) {
    adminStorage = getStorage(getAdminApp());
  }
  return adminStorage;
}
