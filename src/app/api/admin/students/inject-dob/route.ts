import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";
import { getAdminDb } from "@/lib/firebase-admin";
import { invalidateDashboardCache } from "@/lib/dashboard-aggregator";

export async function POST(req: NextRequest) {
  try {
    const adminAuth = await requireAdmin(req);
    if (!adminAuth) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { userIds } = await req.json();
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return json({ error: "Tidak ada user yang dipilih" }, 400);
    }

    const db = getAdminDb();
    
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

    // Hanya ambil dari DB user yang ada di userIds
    const chunkSize = 10;
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      const snaps = await Promise.all(chunk.map((id: string) => db.collection("users").doc(id).get()));
      
      snaps.forEach((doc) => {
        if (!doc.exists) return;
        const data = doc.data();
        if (data?.role === "admin" || !data?.profileCompleted) return;
        
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
              dobKey = k;
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
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    invalidateDashboardCache();

    return json({
      success: true,
      message: `Berhasil menyuntikkan tanggal lahir acak (usia 18-29) untuk ${injectedCount} peserta terpilih.`
    });
    
  } catch (error: any) {
    console.error("[INJECT DOB ERROR]", error);
    return handleError(error);
  }
}
