/**
 * FIX (write): perbaiki dokumen studentsIndex yang BASI — status "Tersertifikasi"
 * tapi linkSertifikat kosong PADAHAL enrollment course-main sudah punya
 * certificateDriveUrl. Tulis ulang linkSertifikat + certStatus pada dokumen index.
 *
 * Hanya menyentuh dokumen yang benar-benar basi (idempoten & terbatas).
 * Dry-run default; jalankan dengan argumen --apply untuk benar-benar menulis.
 *
 *   node --env-file=.env.local scripts/fix-index-link-drift.mjs          (laporan)
 *   node --env-file=.env.local scripts/fix-index-link-drift.mjs --apply  (perbaiki)
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

console.log(`Project: ${projectId}  mode: ${APPLY ? "APPLY (menulis)" : "DRY-RUN (laporan)"}\n`);

const idxSnap = await db.collection("studentsIndex").get();
const suspect = idxSnap.docs.filter((d) => {
  const x = d.data();
  return x.status === "Tersertifikasi" && !(x.linkSertifikat && String(x.linkSertifikat).trim());
});
console.log(`Index "Tersertifikasi" tanpa link: ${suspect.length}\n`);

let fixed = 0, stillEmpty = 0;
for (const doc of suspect) {
  const uid = doc.id;
  const enrSnap = await db.collection("enrollments")
    .where("userId", "==", uid).where("courseId", "==", "course-main").limit(1).get();
  const enr = enrSnap.docs[0]?.data();
  const url = enr?.certificateDriveUrl && String(enr.certificateDriveUrl).trim()
    ? String(enr.certificateDriveUrl).trim() : "";

  if (!url) {
    // Enrollment memang belum punya URL → bukan kasus basi; biarkan.
    stillEmpty++;
    const certStatus = enr?.pdfPending === true ? "processing" : "stuck";
    console.log(`  [SKIP/${certStatus}] ${doc.data().email || uid} (enrollment belum punya URL)`);
    continue;
  }

  console.log(`  [FIX] ${doc.data().email || uid} → ${url.slice(0, 50)}...`);
  if (APPLY) {
    await doc.ref.update({ linkSertifikat: url, certStatus: "ready" });
  }
  fixed++;
}

console.log(`\n=== RINGKASAN ===`);
console.log(`Basi diperbaiki   : ${fixed} ${APPLY ? "(ditulis)" : "(akan ditulis bila --apply)"}`);
console.log(`Dilewati (belum jadi): ${stillEmpty}`);
process.exit(0);
