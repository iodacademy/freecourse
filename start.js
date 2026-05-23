// start.js — Entry point untuk Hostinger Node.js hosting
// Menjalankan Next.js standalone server dari hasil build
const path = require("path");
process.chdir(path.join(__dirname, ".next", "standalone"));
require(path.join(__dirname, ".next", "standalone", "server.js"));
