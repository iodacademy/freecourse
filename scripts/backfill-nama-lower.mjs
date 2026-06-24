/**
 * Script sekali-pakai: isi field `nama_lower` pada semua dokumen `leads`
 * supaya pencarian AWALAN nama di gerbang verifikasi bisa terindeks.
 *
 * Memakai kredensial Firebase Admin dari .env.local (project production).
 * Idempoten — hanya menulis dokumen yang nama_lower-nya belum cocok.
 *
 * Jalankan dari folder freecourse:
 *   node --env-file=.env.local scripts/backfill-nama-lower.mjs
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Kredensial Firebase Admin tidak lengkap di environment.");
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

console.log(`Menyambung ke project: ${projectId}`);
const snap = await db.collection("leads").get();
console.log(`Total dokumen leads: ${snap.size}`);

let updated = 0;
let alreadyOk = 0;
let batch = db.batch();
let ops = 0;

for (const doc of snap.docs) {
  const data = doc.data();
  const nama = String(data.nama || data.profileData?.nama_lengkap || "");
  const want = nama.toLowerCase();
  if (data.nama_lower === want) {
    alreadyOk++;
    continue;
  }
  batch.update(doc.ref, { nama_lower: want });
  ops++;
  updated++;
  if (ops >= 450) {
    await batch.commit();
    batch = db.batch();
    ops = 0;
    console.log(`  ...commit, total terupdate sejauh ini: ${updated}`);
  }
}
if (ops > 0) await batch.commit();

console.log("=== SELESAI ===");
console.log(`Total leads      : ${snap.size}`);
console.log(`Sudah benar      : ${alreadyOk}`);
console.log(`Baru diupdate    : ${updated}`);
process.exit(0);
