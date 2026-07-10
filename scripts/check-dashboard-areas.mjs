/**
 * Uji integrasi aggregateDashboard(): card Per Area, mode cleanOnly, dan
 * ketiga mode export — memakai Firestore palsu (tanpa menyentuh produksi).
 *
 * Jalankan: node --experimental-strip-types scripts/check-dashboard-areas.mjs
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// ── Loader: (a) ganti firebase-admin dengan stub, (b) resolusi import TS
//    tanpa ekstensi ("./regions" -> "./regions.ts") seperti bundler Next.
const STUB = pathToFileURL("./scripts/_stub-firebase-admin.mjs").href;
register(
  `data:text/javascript,
   import { existsSync } from "node:fs";
   import { fileURLToPath } from "node:url";
   export async function resolve(spec, ctx, next) {
     if (spec.endsWith("/firebase-admin") || spec.endsWith("firebase-admin.ts")) {
       return { url: ${JSON.stringify(STUB)}, shortCircuit: true };
     }
     if (spec.startsWith(".") && !/\\.(ts|js|mjs|json)$/.test(spec)) {
       try {
         const asTs = await next(spec + ".ts", ctx);
         return asTs;
       } catch {}
     }
     return next(spec, ctx);
   }`,
  import.meta.url
);

const { setFakeData } = await import("./_stub-firebase-admin.mjs");

// ── Data uji ──────────────────────────────────────────────────────────────
// status "certified" -> Tersertifikasi. "completed"? lihat deriveStatus.
const mkUser = (uid, { kota, umur, gender = "Laki-laki", dis = "Tidak" }) => {
  // umur -> tanggal lahir kira-kira (cukup untuk calcAge)
  const now = new Date();
  const dob = umur == null ? null : `${now.getFullYear() - umur}-01-01`;
  return {
    uid,
    email: `${uid}@t.id`,
    role: "student",
    profileCompleted: true,
    channelSource: "umum",
    profileData: {
      nama_lengkap: uid,
      jenis_kelamin: gender,
      disabilitas: dis,
      asal_daerah: { province: "X", city: kota },
      ...(dob ? { tanggal_lahir: dob } : {}),
    },
  };
};

const USERS = [
  // Jabodetabek
  mkUser("jkt-25", { kota: "Jakarta Selatan", umur: 25 }),
  mkUser("bgr-30", { kota: "Kab. Bogor", umur: 30 }),                       // gagal usia
  mkUser("dpk-31-dis", { kota: "Depok", umur: 31, dis: "Ya" }),             // lolos (dis <=35)
  // Medan
  mkUser("mdn-22", { kota: "Medan", umur: 22, gender: "Perempuan" }),
  mkUser("dls-28", { kota: "Kab. Deli Serdang", umur: 28 }),
  mkUser("mdn-36-dis", { kota: "Medan", umur: 36, dis: "Ya" }),             // gagal (>35)
  // Surabaya
  mkUser("sby-29", { kota: "Surabaya", umur: 29 }),
  mkUser("sda-40", { kota: "Kab. Sidoarjo", umur: 40 }),                    // gagal usia
  // Luar area
  mkUser("smd-25", { kota: "Kab. Sumedang", umur: 25 }),                    // JEBAKAN "su-medan-g"
  mkUser("smg-24", { kota: "Semarang", umur: 24 }),
  // Tanpa DOB (di area, tapi usia tak diketahui)
  mkUser("mdn-nodob", { kota: "Medan", umur: null }),
  // Di bawah batas bawah 18 — bisa masuk lewat import/edit admin, bukan form.
  mkUser("jkt-16", { kota: "Jakarta Barat", umur: 16 }),                   // gagal (<18)
  mkUser("sby-17-dis", { kota: "Surabaya", umur: 17, dis: "Ya" }),         // gagal juga (<18)
];

// Semua tersertifikasi, biar `completed` = jumlah orang di area.
const ENROLLMENTS = USERS.map((u) => ({
  id: u.uid,
  userId: u.uid,
  email: u.email,
  courseId: "course-main",
  status: "certified",
  channelSource: "umum",
}));

setFakeData({
  users: USERS,
  enrollments: ENROLLMENTS,
  courses: [{ id: "course-main", isMainCourse: true }],
  courseSteps: [{ id: "s1", courseId: "course-main", order: 1, title: "Materi" }],
  events: [],
  partnerCodes: [],
  bonusCourseTopics: [],
  settings: { app: { mainCourseId: "course-main", targets: {} } },
});

const { aggregateDashboard } = await import("../src/lib/dashboard-aggregator.ts");

let fail = 0;
const eq = (got, want, name) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} => ${got}${ok ? "" : ` (want ${want})`}`);
};
const areaOf = (stats, key) => stats.areaStats.find((a) => a.key === key);

// ── 1. Card Per Area (mode normal, tanpa cleanOnly) ───────────────────────
console.log("== 1. Card Per Area ==");
const base = await aggregateDashboard({}, { bypassCache: true });
const jab = areaOf(base.stats, "jabodetabek");
const mdn = areaOf(base.stats, "medan");
const sby = areaOf(base.stats, "surabaya");
const luar = areaOf(base.stats, "luar");

eq(jab.registered, 4, "jabodetabek.registered (+ jkt-16)");
eq(jab.completed, 4, "jabodetabek.completed");
eq(jab.cleanCompleted, 2, "jabodetabek.cleanCompleted (jkt-25 + dpk-31-dis; jkt-16 gagal <18)");

eq(mdn.registered, 4, "medan.registered (mdn-22, dls-28, mdn-36-dis, mdn-nodob)");
eq(mdn.completed, 4, "medan.completed");
eq(mdn.cleanCompleted, 2, "medan.cleanCompleted (mdn-22 + dls-28)");

eq(sby.registered, 3, "surabaya.registered (+ sby-17-dis)");
eq(sby.cleanCompleted, 1, "surabaya.cleanCompleted (sby-29; sby-17-dis gagal <18)");

eq(luar.registered, 2, "luar.registered (Sumedang + Semarang)");
eq(luar.cleanCompleted, 0, "luar.cleanCompleted selalu 0");

// Total: kartu utama menghitung SEMUA (13 orang)
eq(base.stats.total, 13, "stats.total tanpa cleanOnly = semua tersertifikasi");
eq(base.stats.cleanOnly, false, "stats.cleanOnly=false");

// INVARIAN: jumlah `completed` semua kartu area == stats.total.
// Tiap peserta punya tepat satu area (atau "luar"), jadi ini harus selalu benar.
// Inilah yang gagal di bug "Jabodetabek 7.768 > Total Completion 6.736".
const sumCompleted = (s) => s.areaStats.reduce((n, a) => n + a.completed, 0);
const sumRegistered = (s) => s.areaStats.reduce((n, a) => n + a.registered, 0);
eq(sumCompleted(base.stats), base.stats.total, "INVARIAN: Σ area.completed == stats.total");
eq(sumRegistered(base.stats), base.stats.totalCompleted, "INVARIAN: Σ area.registered == totalCompleted");
eq(base.stats.areaStats.length, 4, "tanpa cleanOnly: 3 area + Luar Area");

// ── 2. Mode cleanOnly — HARUS memfilter semua kartu, bukan cuma KPI ───────
console.log("\n== 2. cleanOnly ==");
const clean = await aggregateDashboard({}, { cleanOnly: true });
eq(clean.stats.total, 5, "cleanOnly total = 2 jabo + 2 medan + 1 sby");
eq(clean.stats.cleanOnly, true, "stats.cleanOnly=true");
eq(clean.stats.totalCompleted, 5, "cleanOnly totalCompleted");

// Kartu area IKUT menyusut (regresi bug: dulu tetap pakai populasi mentah)
eq(areaOf(clean.stats, "jabodetabek").completed, 2, "cleanOnly: jabodetabek.completed menyusut 4->2");
eq(areaOf(clean.stats, "medan").registered, 2, "cleanOnly: medan.registered menyusut 4->2");
eq(areaOf(clean.stats, "medan").completed, 2, "cleanOnly: medan.completed");
eq(areaOf(clean.stats, "surabaya").completed, 1, "cleanOnly: surabaya.completed");
// Kartu "Daerah Lainnya" tetap ditampilkan (selalu 4 kartu), tapi nilainya 0.
eq(clean.stats.areaStats.length, 4, "cleanOnly: tetap 4 kartu");
eq(areaOf(clean.stats, "luar").completed, 0, "cleanOnly: Daerah Lainnya = 0");
eq(areaOf(clean.stats, "luar").registered, 0, "cleanOnly: Daerah Lainnya pendaftar = 0");
// Urutan kartu: Jabodetabek, Surabaya, Medan, Daerah Lainnya.
eq(clean.stats.areaStats.map((a) => a.key).join(","), "jabodetabek,surabaya,medan,luar",
   "urutan kartu area");

// INVARIAN yang sama harus tetap berlaku saat toggle aktif.
eq(sumCompleted(clean.stats), clean.stats.total, "INVARIAN cleanOnly: Σ area.completed == stats.total");
eq(sumRegistered(clean.stats), clean.stats.totalCompleted, "INVARIAN cleanOnly: Σ area.registered == totalCompleted");
// Tidak ada satu pun kartu area yang boleh melebihi Total Completion.
eq(clean.stats.areaStats.every((a) => a.completed <= clean.stats.total), true,
   "tak ada kartu area > Total Completion");
eq(base.stats.areaStats.every((a) => a.completed <= base.stats.total), true,
   "tak ada kartu area > Total Completion (mode normal)");

// Dalam cleanOnly, completed == cleanCompleted (semua baris sudah clean).
eq(clean.stats.areaStats.every((a) => a.completed === a.cleanCompleted), true,
   "cleanOnly: completed == cleanCompleted di tiap area");

// cleanOnly + subset area
const cleanMedan = await aggregateDashboard({}, { cleanOnly: true, areas: ["medan"] });
eq(cleanMedan.stats.total, 2, "cleanOnly areas=[medan] -> 2");
eq(sumCompleted(cleanMedan.stats), cleanMedan.stats.total, "INVARIAN areas=[medan]");
eq(areaOf(cleanMedan.stats, "jabodetabek").completed, 0, "areas=[medan]: jabodetabek jadi 0");

// ── 3. Export ─────────────────────────────────────────────────────────────
console.log("\n== 3. Export ==");
const rawEx = await aggregateDashboard({}, { includeStudents: true, rawExport: true });
eq(rawEx.students.length, 13, "raw export = semua Selesai/Tersertifikasi");

const cleanEx = await aggregateDashboard({}, {
  includeStudents: true, exportOnlyCertified: true, cleanExport: true,
});
eq(cleanEx.students.length, 5, "clean export = 5 baris");

const cleanMedanEx = await aggregateDashboard({}, {
  includeStudents: true, exportOnlyCertified: true, cleanExport: true, areas: ["medan"],
});
eq(cleanMedanEx.students.length, 2, "clean export areas=[medan] = 2 baris");
eq(cleanMedanEx.students.every((s) => s.kota.toLowerCase().includes("medan") || s.kota.toLowerCase().includes("serdang")), true, "semua baris dari area medan");

const cleanMultiEx = await aggregateDashboard({}, {
  includeStudents: true, exportOnlyCertified: true, cleanExport: true,
  areas: ["medan", "surabaya"],
});
eq(cleanMultiEx.students.length, 3, "clean export areas=[medan,surabaya] = 3 baris");

const misEx = await aggregateDashboard({}, { includeStudents: true, mismatchExport: true });
eq(misEx.students.length, 8, "mismatch = 13 - 5 clean");
// mismatch harus memuat Sumedang (bukti tidak salah masuk area Medan)
eq(misEx.students.some((s) => s.kota === "Kab. Sumedang"), true, "Sumedang ada di Data Tidak Sesuai");
eq(misEx.students.some((s) => s.namaLengkap === "mdn-nodob"), true, "peserta tanpa DOB masuk Data Tidak Sesuai");
// peserta di bawah 18 harus muncul di Data Tidak Sesuai, bukan hilang diam-diam
eq(misEx.students.some((s) => s.namaLengkap === "jkt-16"), true, "peserta 16 th masuk Data Tidak Sesuai");
eq(misEx.students.some((s) => s.namaLengkap === "sby-17-dis"), true, "disabilitas 17 th masuk Data Tidak Sesuai");
// mismatch mengabaikan `areas`
const misAreaEx = await aggregateDashboard({}, {
  includeStudents: true, mismatchExport: true, areas: ["medan"],
});
eq(misAreaEx.students.length, 8, "mismatch abaikan areas");

// ── 4. clean + mismatch = raw (tidak ada baris hilang/dobel) ──────────────
console.log("\n== 4. Konsistensi clean + mismatch = raw ==");
eq(cleanEx.students.length + misEx.students.length, rawEx.students.length,
   "5 + 8 = 13");
const names = new Set([...cleanEx.students, ...misEx.students].map((s) => s.namaLengkap));
eq(names.size, 13, "tidak ada baris dobel antara clean & mismatch");

// ── 5. Field internal tidak bocor ────────────────────────────────────────
console.log("\n== 5. Kebersihan payload ==");
const leaked = Object.keys(rawEx.students[0]).filter((k) => k.startsWith("_"));
eq(leaked.length, 0, `tak ada field "_" bocor (${leaked.join(",") || "none"})`);

console.log(`\n${fail === 0 ? "SEMUA LULUS" : `${fail} GAGAL`}`);
process.exit(fail ? 1 : 0);
