import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const adminAuth = await requireAdmin(req);
    if (!adminAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    const usersSnap = await db.collection("users").get();
    
    const missingUsers: { id: string; name: string; email: string }[] = [];

    usersSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.role === "admin" || !data.profileCompleted) return;
      
      const profileData = data.profileData || {};
      let hasDob = false;
      
      for (const k of Object.keys(profileData)) {
        const kl = k.toLowerCase();
        if (kl.includes("tanggal") && kl.includes("lahir")) {
          const val = profileData[k];
          if (val && typeof val === "string" && val.trim() !== "" && !val.startsWith("__display:")) {
            hasDob = true;
          }
          break;
        }
      }

      if (!hasDob) {
        missingUsers.push({
          id: doc.id,
          name: data.displayName || data.profileData?.nama_lengkap || data.profileData?.nama || "Tanpa Nama",
          email: data.email || "Tanpa Email"
        });
      }
    });

    return NextResponse.json({ success: true, data: missingUsers });
    
  } catch (error: any) {
    console.error("[MISSING DOB ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
