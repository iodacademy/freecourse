// start.js — Entry point untuk Hostinger
// Jalankan standalone server dari Next.js build output
process.chdir(__dirname + '/.next/standalone');
require('./server.js');
