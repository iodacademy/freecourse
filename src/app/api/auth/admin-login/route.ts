/**
 * POST /api/auth/admin-login
 * Admin login via access code + Firebase Anonymous Auth.
 * 
 * Flow:
 * 1. Client signs in anonymously (Firebase Auth)
 * 2. Client sends idToken + accessCode to this endpoint
 * 3. We verify the code against env ADMIN_ACCESS_CODE
 * 4. If valid, set role "admin" on the anonymous user doc in Firestore
 * 5. Return admin profile
 */
import { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { json, handleError } from "@/lib/api-helpers";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const { idToken, accessCode } = await req.json();

    if (!idToken || !accessCode) {
      return json({ error: "idToken dan accessCode wajib diisi" }, 400);
    }

    // 1. Verify access code
    const validCode = process.env.ADMIN_ACCESS_CODE;
    if (!validCode || accessCode !== validCode) {
      return json({ error: "Kode akses salah" }, 401);
    }

    // 2. Verify the Firebase ID token (anonymous auth)
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const { uid } = decoded;
    const db = getAdminDb();

    // 3. Create/update user doc with admin role
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // New admin user
      const adminData = {
        uid,
        email: "admin@ioda.id",
        emailUsername: "admin",
        displayName: "Admin IODA",
        photoURL: null,
        role: "admin",
        profileCompleted: true,
        profileData: { namaLengkap: "Admin IODA" },
        channelSource: null,
        eventId: null,
        partnerCode: null,
        utmData: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      await userRef.set(adminData);
      return json({ status: "new", user: adminData });
    } else {
      // Existing doc — just update role to admin
      await userRef.update({
        role: "admin",
        updatedAt: FieldValue.serverTimestamp(),
      });
      const updated = await userRef.get();
      return json({ status: "existing", user: updated.data() });
    }
  } catch (e) {
    return handleError(e);
  }
}
