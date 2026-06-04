import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb();
    
    // Find all users containing "reyhan" or "kabilla"
    const usersSnap = await db.collection("users").get();
    const matchingUsers: any[] = [];
    usersSnap.forEach(doc => {
      const data = doc.data();
      const str = JSON.stringify(data).toLowerCase();
      if (str.includes("reyhan") || str.includes("kabilla")) {
        matchingUsers.push({ id: doc.id, ...data });
      }
    });

    const enrollSnap = await db.collection("enrollments").get();
    const matchingEnrolls: any[] = [];
    enrollSnap.forEach(doc => {
      const data = doc.data();
      const str = JSON.stringify(data).toLowerCase();
      if (str.includes("reyhan") || str.includes("kabilla")) {
        matchingEnrolls.push({ id: doc.id, ...data });
      }
    });
    
    let matchingAuth: any[] = [];
    try {
      const auth = getAdminAuth();
      const list = await auth.listUsers(1000);
      list.users.forEach(u => {
        const str = JSON.stringify(u).toLowerCase();
        if (str.includes("reyhan") || str.includes("kabilla")) {
          matchingAuth.push({ uid: u.uid, email: u.email, name: u.displayName });
        }
      });
    } catch (e) {}

    return NextResponse.json({
      matchingUsers,
      matchingEnrolls,
      matchingAuth
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
