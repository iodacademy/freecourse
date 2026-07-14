/**
 * Verifikasi pola area & aturan usia Data Clean.
 * Jalankan: node scripts/check-regions.mjs
 *
 * Mengimpor langsung dari src/lib/regions.ts (lewat transpile on-the-fly)
 * supaya yang diuji benar-benar kode produksi, bukan salinannya.
 */
import fs from "node:fs";
import { areaOfCity, isAgeEligible, maxAgeFor, AREAS } from "../src/lib/regions.ts";

function loadWilayah() {
  const src = fs.readFileSync("src/lib/wilayah.ts", "utf8");
  const m = src.match(/export const WILAYAH_INDONESIA[^=]*=\s*(\[[\s\S]*?\n\];)/);
  if (!m) throw new Error("WILAYAH_INDONESIA tidak ketemu");
  return eval(m[1].replace(/;$/, ""));
}

let fail = 0;
const eq = (got, want, name) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} => ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

// ── 1. Tidak ada false positive / tumpang tindih di seluruh wilayah Indonesia ──
console.log("== 1. Sapu seluruh daftar kota wilayah.ts ==");
const EXPECTED_PROV = {
  jabodetabek: new Set(["DKI Jakarta", "Jawa Barat", "Banten"]),
  medan: new Set(["Sumatera Utara"]),
  surabaya: new Set(["Jawa Timur"]),
};
const tally = { jabodetabek: 0, medan: 0, surabaya: 0 };
for (const prov of loadWilayah()) {
  for (const city of prov.cities) {
    const a = areaOfCity(city);
    if (!a) continue;
    tally[a]++;
    if (!EXPECTED_PROV[a].has(prov.name)) {
      console.log(`FAIL false positive: "${city}" (${prov.name}) -> ${a}`);
      fail++;
    }
  }
}
console.log(`     jabodetabek=${tally.jabodetabek} medan=${tally.medan} surabaya=${tally.surabaya}`);
eq(tally.jabodetabek, 12, "jumlah kota jabodetabek");
eq(tally.medan, 5, "jumlah kota medan");
eq(tally.surabaya, 2, "jumlah kota surabaya");

// ── 2. Kasus jebakan substring & variasi penulisan ──
console.log("\n== 2. areaOfCity() ==");
const cityCases = [
  ["Kab. Sumedang", null], ["Sumedang", null], // "su-MEDAN-g"
  ["Medan", "medan"], ["MEDAN", "medan"], ["  medan  ", "medan"], ["Kota Medan", "medan"],
  ["Kab. Deli Serdang", "medan"], ["Deli Serdang", "medan"],
  ["Kab. Serdang Bedagai", "medan"], ["Binjai", "medan"], ["Kab. Langkat", "medan"],
  ["Surabaya", "surabaya"], ["Kab. Sidoarjo", "surabaya"], ["Sidoarjo", "surabaya"],
  ["Kab. Gresik", null], ["Malang", null], ["Semarang", null],
  ["Jakarta Selatan", "jabodetabek"], ["Kab. Bogor", "jabodetabek"],
  ["Kab. Bekasi", "jabodetabek"], ["Depok", "jabodetabek"],
  // Ketiga bentuk resmi "Tangerang" di wilayah.ts harus ikut Jabodetabek.
  // Pola dicocokkan sebagai kata utuh DI DALAM nama, bukan sama persis.
  ["Tangerang", "jabodetabek"],
  ["Tangerang Selatan", "jabodetabek"],
  ["Kab. Tangerang", "jabodetabek"],
  ["TANGERANG SELATAN", "jabodetabek"],
  // Singkatan SENGAJA tidak dikenali (keputusan: nama resmi saja). Nilai
  // seperti ini hanya bisa masuk lewat import/edit admin, dan lebih baik
  // muncul di "Data Tidak Sesuai" agar ketahuan daripada salah dihitung.
  ["Tangsel", null], ["Jaksel", null],
  ["", null], [null, null], [undefined, null], ["   ", null], ["-", null],
];
for (const [input, want] of cityCases) eq(areaOfCity(input), want, `areaOfCity(${JSON.stringify(input)})`);

// ── 3. Rentang usia: 18–29 umum, 18–35 disabilitas ──
console.log("\n== 3. isAgeEligible() ==");
eq(maxAgeFor(false), 29, "maxAgeFor(non-disabilitas)");
eq(maxAgeFor(true), 35, "maxAgeFor(disabilitas)");
const ageCases = [
  // batas atas
  [29, false, true], [30, false, false],
  [30, true, true], [35, true, true], [36, true, false],
  // batas bawah — berlaku untuk keduanya
  [18, false, true], [17, false, false], [15, false, false],
  [18, true, true], [17, true, false],
  [0, false, false], [0, true, false],        // umur 0 (data rusak) -> TIDAK clean
  [-1, false, false],
  // tanpa tanggal lahir
  [null, false, false], [null, true, false], [NaN, false, false],
];
for (const [age, dis, want] of ageCases) {
  eq(isAgeEligible(age, dis), want, `isAgeEligible(${age}, dis=${dis})`);
}

// ── 4. isCleanEligible = area != null && usia lolos (replika baris aggregator) ──
console.log("\n== 4. isCleanEligible (area + usia) ==");
const isCleanEligible = (kota, umur, dis) => areaOfCity(kota) !== null && isAgeEligible(umur, dis);
const cleanCases = [
  ["Medan", 25, false, true, "Medan 25 non-dis"],
  ["Medan", 32, false, false, "Medan 32 non-dis -> gagal usia"],
  ["Medan", 32, true, true, "Medan 32 disabilitas -> lolos (<=35)"],
  ["Medan", 36, true, false, "Medan 36 disabilitas -> gagal (>35)"],
  ["Kab. Sumedang", 25, false, false, "Sumedang -> luar area"],
  ["Kab. Sidoarjo", 29, false, true, "Sidoarjo 29"],
  ["Surabaya", 30, false, false, "Surabaya 30 non-dis"],
  ["Jakarta Timur", 22, false, true, "Jakarta Timur 22"],
  ["Semarang", 22, false, false, "Semarang -> luar area"],
  ["Medan", null, false, false, "Medan tanpa DOB -> tidak clean"],
  // batas bawah 18 berlaku di semua area, juga untuk disabilitas
  ["Jakarta Barat", 17, false, false, "Jakarta 17 -> di bawah 18"],
  ["Jakarta Barat", 18, false, true, "Jakarta 18 -> pas batas bawah"],
  ["Medan", 17, true, false, "Medan 17 disabilitas -> tetap gagal (<18)"],
  ["Medan", 18, true, true, "Medan 18 disabilitas"],
];
for (const [kota, umur, dis, want, name] of cleanCases) eq(isCleanEligible(kota, umur, dis), want, name);

// ── 5. AREAS metadata utuh ──
console.log("\n== 5. metadata AREAS ==");
eq(AREAS.length, 3, "jumlah area");
// Urutan ini menentukan urutan kartu dashboard & checkbox di modal export.
eq(AREAS.map((a) => a.key).join(","), "jabodetabek,surabaya,medan", "urutan key");
eq(AREAS.every((a) => a.label && a.desc && a.patterns.length > 0), true, "tiap area punya label/desc/patterns");

console.log(`\n${fail === 0 ? "SEMUA LULUS" : `${fail} GAGAL`}`);
process.exit(fail ? 1 : 0);
