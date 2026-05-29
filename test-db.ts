import { getAdminDb } from "./src/lib/firebase-admin";

async function run() {
  const db = getAdminDb();
  
  const snap = await db.collection("courses").get();
  const courses = snap.docs.map(d => ({
    id: d.id,
    title: (d.data() as any).title,
    isMainCourse: (d.data() as any).isMainCourse
  }));
  
  console.log("Courses:", JSON.stringify(courses, null, 2));

  const settingsDoc = await db.collection("settings").doc("app").get();
  console.log("Settings/app:", settingsDoc.exists ? settingsDoc.data() : "NOT_FOUND");
}

run().catch(console.error);
