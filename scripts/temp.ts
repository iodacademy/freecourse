import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
env.split("\n").forEach(line => {
  if (line.includes("=")) {
    const [key, ...val] = line.split("=");
    process.env[key.trim()] = val.join("=").trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
  }
});

import { getAdminDb } from "../src/lib/firebase-admin";

async function run() {
  const db = getAdminDb();
  const users = await db.collection("users").get();
  const allKeys = new Set();
  for (const doc of users.docs) {
    const data = doc.data();
    if (!data.profileData) continue;
    Object.keys(data.profileData).forEach(k => allKeys.add(k));
  }
  console.log("All profileData keys:");
  console.log(Array.from(allKeys).join("\n"));
}
run();
