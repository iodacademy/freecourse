/**
 * scripts/copy-standalone.js
 * Dijalankan otomatis setelah `next build` (via postbuild).
 * Menyalin static files & public folder ke dalam .next/standalone
 * supaya CSS, JS, dan gambar bisa di-serve dengan benar di Hostinger.
 *
 * Setelah copy, script melakukan sanity check: hitung jumlah file di
 * source vs target. Kalau tidak match, build dianggap GAGAL (exit 1)
 * supaya masalah ketahuan dari log deploy, bukan baru kelihatan saat
 * siswa kena chunk 404 di browser.
 */
const fs   = require("fs");
const path = require("path");

function copyDir(src, dst) {
  if (!fs.existsSync(src)) {
    console.log(`[copy-standalone] Skip (not found): ${src}`);
    return;
  }
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const dstPath = path.join(dst, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function countFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (fs.statSync(p).isDirectory()) {
      count += countFilesRecursive(p);
    } else {
      count++;
    }
  }
  return count;
}

const root = path.resolve(__dirname, "..");

// Copy .next/static → .next/standalone/.next/static  (CSS, JS chunks)
copyDir(
  path.join(root, ".next", "static"),
  path.join(root, ".next", "standalone", ".next", "static")
);

// Copy public → .next/standalone/public  (images, fonts, icons)
copyDir(
  path.join(root, "public"),
  path.join(root, ".next", "standalone", "public")
);

// ─── Sanity check ───
// Verifikasi: jumlah file di .next/static (sumber Next.js build) HARUS sama
// dengan jumlah file di .next/standalone/.next/static (target untuk Hostinger).
// Kalau tidak sama, server akan kena 404 untuk chunk yang tertinggal.
const srcStatic = path.join(root, ".next", "static");
const dstStatic = path.join(root, ".next", "standalone", ".next", "static");
const srcCount = countFilesRecursive(srcStatic);
const dstCount = countFilesRecursive(dstStatic);

if (srcCount !== dstCount) {
  console.error(
    `[copy-standalone] ❌ MISMATCH: source has ${srcCount} files, target has ${dstCount} files`
  );
  console.error(
    `[copy-standalone] ❌ Build dibatalkan — chunk JS akan 404 di production!`
  );
  process.exit(1);
}

console.log(
  `[copy-standalone] ✓ Static files copied (${srcCount} files verified) to .next/standalone/`
);
