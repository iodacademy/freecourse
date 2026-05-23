/**
 * scripts/copy-standalone.js
 * Dijalankan otomatis setelah `next build` (via postbuild).
 * Menyalin static files & public folder ke dalam .next/standalone
 * supaya CSS, JS, dan gambar bisa di-serve dengan benar di Hostinger.
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

console.log("[copy-standalone] ✓ Static files copied to .next/standalone/");
