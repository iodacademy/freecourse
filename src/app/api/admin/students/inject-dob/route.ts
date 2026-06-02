import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const adminAuth = await requireAdmin(req);
    if (!adminAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    const usersSnap = await db.collection("users").get();
    
    let injectedCount = 0;
    const batch = db.batch();
    let batchCount = 0;

    function getRandomDob18to29() {
      const now = new Date();
      // Age between 18 and 29
      const minAge = 18;
      const maxAge = 29;
      
      const minDate = new Date(now.getFullYear() - maxAge - 1, now.getMonth(), now.getDate() + 1).getTime();
      const maxDate = new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate()).getTime();
      
      const randomTime = minDate + Math.random() * (maxDate - minDate);
      const randomDate = new Date(randomTime);
      
      const yyyy = randomDate.getFullYear();
      const mm = String(randomDate.getMonth() + 1).padStart(2, '0');
      const dd = String(randomDate.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    usersSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.role === "admin" || !data.profileCompleted) return;
      
      const profileData = data.profileData || {};
      let hasDob = false;
      let dobKey = "tanggal_lahir";
      
      // Cari jika sudah punya key tanggal lahir
      for (const k of Object.keys(profileData)) {
        const kl = k.toLowerCase();
        if (kl.includes("tanggal") && kl.includes("lahir")) {
          const val = profileData[k];
          if (val && typeof val === "string" && val.trim() !== "" && !val.startsWith("__display:")) {
            hasDob = true;
          } else {
            dobKey = k; // Reuse existing key if it was empty
          }
          break;
        }
      }

      if (!hasDob) {
        const randomDob = getRandomDob18to29();
        profileData[dobKey] = randomDob;
        
        batch.update(doc.ref, {
          profileData: profileData
        });
        
        injectedCount++;
        batchCount++;
      }
    });

    if (batchCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ 
      success: true, 
      message: `Berhasil menyuntikkan tanggal lahir acak (usia 18-29) untuk ${injectedCount} peserta yang datanya kosong.`
    });
    
  } catch (error: any) {
    console.error("[INJECT DOB ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
