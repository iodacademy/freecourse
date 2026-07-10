/**
 * Uji aturan usia yang dipakai validasi form pendaftaran (profile/page.tsx).
 * Mereplika ekspresi di sana, tapi memanggil helper produksi dari regions.ts.
 *
 * Jalankan: node --experimental-strip-types scripts/check-age-validation.mjs
 */
import { ageRangeFor, isDisabilitasValue } from "../src/lib/regions.ts";

let fail = 0;
const eq = (got, want, name) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} => ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

// Replika persis logika di profile/page.tsx
function validateAge(age, answers) {
  const disabilitasAnswered =
    answers.disabilitas !== undefined && String(answers.disabilitas ?? "").trim() !== "";
  const isDisabilitas = !disabilitasAnswered || isDisabilitasValue(answers.disabilitas);
  const [minAge, maxAge] = ageRangeFor(isDisabilitas);
  return age < minAge || age > maxAge
    ? `Usia yang diperbolehkan adalah ${minAge}-${maxAge} tahun (Usia saat ini: ${age} tahun)`
    : null;
}
const ok = (age, answers) => validateAge(age, answers) === null;

console.log("== isDisabilitasValue ==");
eq(isDisabilitasValue("Ya"), true, '"Ya"');
eq(isDisabilitasValue("ya"), true, '"ya" (huruf kecil)');
eq(isDisabilitasValue(" Ya "), true, '" Ya " (spasi)');
eq(isDisabilitasValue("Penyandang Disabilitas"), true, '"Penyandang Disabilitas"');
eq(isDisabilitasValue("Tidak"), false, '"Tidak"');
eq(isDisabilitasValue(""), false, "string kosong");
eq(isDisabilitasValue(undefined), false, "undefined");
eq(isDisabilitasValue(["Ya"]), false, "array -> false (bukan string)");

console.log("\n== non-disabilitas: 18-29 ==");
const TIDAK = { disabilitas: "Tidak" };
eq(ok(17, TIDAK), false, "17 ditolak");
eq(ok(18, TIDAK), true, "18 diterima");
eq(ok(29, TIDAK), true, "29 diterima");
eq(ok(30, TIDAK), false, "30 ditolak");
eq(validateAge(30, TIDAK), "Usia yang diperbolehkan adalah 18-29 tahun (Usia saat ini: 30 tahun)", "pesan error 18-29");

console.log("\n== disabilitas: 18-35 ==");
const YA = { disabilitas: "Ya" };
eq(ok(17, YA), false, "17 ditolak (batas bawah tetap 18)");
eq(ok(18, YA), true, "18 diterima");
eq(ok(30, YA), true, "30 diterima (dulu ditolak!)");
eq(ok(35, YA), true, "35 diterima");
eq(ok(36, YA), false, "36 ditolak");
eq(validateAge(36, YA), "Usia yang diperbolehkan adalah 18-35 tahun (Usia saat ini: 36 tahun)", "pesan error 18-35");

console.log("\n== jawaban disabilitas belum diisi -> pakai batas longgar ==");
// Supaya user tidak ditolak gara-gara urutan pengisian field.
eq(ok(33, {}), true, "33 + belum jawab -> lolos validasi usia");
eq(ok(33, { disabilitas: "" }), true, "33 + jawaban kosong -> lolos");
eq(ok(33, { disabilitas: "   " }), true, "33 + spasi -> lolos");
eq(ok(36, {}), false, "36 tetap ditolak (di atas batas longgar)");
eq(ok(17, {}), false, "17 tetap ditolak (batas bawah)");
// Begitu dijawab "Tidak", batas mengetat lagi
eq(ok(33, TIDAK), false, "33 + jawab Tidak -> ditolak");

console.log(`\n${fail === 0 ? "SEMUA LULUS" : `${fail} GAGAL`}`);
process.exit(fail ? 1 : 0);
