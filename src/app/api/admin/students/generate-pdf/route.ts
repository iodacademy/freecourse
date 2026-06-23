import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin, json, handleError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();

    let reqBody: any = {};
    try { reqBody = await req.json(); } catch(e) {}
    
    const userId = reqBody.userId;
    if (!userId) {
      return json({ error: "userId tidak valid." }, 400);
    }

    // Cari enrollment main course
    const enrollmentsSnap = await db.collection("enrollments")
      .where("userId", "==", userId)
      .where("courseId", "==", "course-main")
      .get();

    if (enrollmentsSnap.empty) {
      return json({ error: "Enrollment tidak ditemukan." }, 404);
    }

    const enrollDoc = enrollmentsSnap.docs[0];
    const enrollData = enrollDoc.data();

    if (!enrollData.certificateClaimed || !enrollData.certificateId) {
      return json({ error: "Peserta belum diluluskan secara sistem." }, 400);
    }

    if (enrollData.certificateDriveUrl) {
      return json({ message: "PDF sudah ada.", driveUrl: enrollData.certificateDriveUrl });
    }

    const settingsDoc = await db.collection("settings").doc("app").get();
    const settings = settingsDoc.data() || {};
    const gasWebAppUrl = settings.gasWebAppUrl || "";
    const mainCertSlideTemplateId = settings.mainCertSlideTemplateId || "";

    if (!gasWebAppUrl) {
      return json({ error: "URL GAS belum disetel di Pengaturan." }, 500);
    }
    if (!mainCertSlideTemplateId) {
      return json({ error: "Template sertifikat (mainCertSlideTemplateId) belum disetel di Pengaturan." }, 500);
    }
    if (!enrollData.certificateName) {
      return json({ error: "Nama sertifikat peserta kosong." }, 400);
    }

    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    let claimDateStr: string;
    
    if (enrollData.certificateClaimedAt) {
      const origDate = typeof enrollData.certificateClaimedAt === "object" && enrollData.certificateClaimedAt._seconds
        ? new Date(enrollData.certificateClaimedAt._seconds * 1000)
        : new Date(enrollData.certificateClaimedAt);
      claimDateStr = `${origDate.getDate()} ${months[origDate.getMonth()]} ${origDate.getFullYear()}`;
    } else {
      const now = new Date();
      claimDateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }

    // Ambil email student
    const studentDoc = await db.collection("users").doc(userId).get();
    const studentEmail = studentDoc.data()?.email || "unknown@example.com";

    const gasPayload = {
      action: "generate_main_cert",
      templateId: mainCertSlideTemplateId,
      certId: enrollData.certificateId,
      userName: enrollData.certificateName,
      courseName: enrollData.certificateCourseName || "Literasi Finansial Dasar",
      claimDate: claimDateStr,
      email: studentEmail,
    };

    const gasRes = await fetch(gasWebAppUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gasPayload),
    });

    // Baca body GAS sekali sebagai teks supaya bisa dipakai untuk pesan error.
    const gasText = await gasRes.text();

    if (!gasRes.ok) {
      const snippet = gasText.slice(0, 200).replace(/\s+/g, " ").trim();
      return json({ error: `GAS menolak (HTTP ${gasRes.status}): ${snippet || "tanpa pesan"}` }, 500);
    }

    let gasData: any = null;
    try { gasData = gasText ? JSON.parse(gasText) : null; } catch {
      const snippet = gasText.slice(0, 200).replace(/\s+/g, " ").trim();
      // GAS sering balas halaman HTML login bila URL deploy salah/akses dibatasi.
      return json({ error: `GAS membalas non-JSON (kemungkinan URL deploy salah / butuh akses). Cuplikan: ${snippet}` }, 500);
    }

    const driveUrl = gasData?.downloadUrl || gasData?.pdfUrl || null;
    const driveFileId = gasData?.fileId || null;

    if (driveUrl) {
      await enrollDoc.ref.update({
        certificateDriveUrl: driveUrl,
        certificateDriveFileId: driveFileId || "",
      });
      return json({ success: true, driveUrl });
    }

    // OK tapi tanpa URL → biasanya GAS mengembalikan {error: "..."}.
    const gasErr = gasData?.error || gasData?.message || JSON.stringify(gasData).slice(0, 200);
    return json({ error: `GAS OK tapi tidak ada URL sertifikat. Pesan GAS: ${gasErr}` }, 500);

  } catch (e) {
    return handleError(e);
  }
}
