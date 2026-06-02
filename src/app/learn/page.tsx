"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createSlug } from "@/lib/utils";

export default function LearnPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/enrollments", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: 'no-store',
        });
        
        if (!res.ok) throw new Error("Gagal memuat data enrollment");
        
        const data = await res.json();
        let mainEnrollment = data.find((e: any) => e.courseId === "course-main");

        // Fetch course steps to get the title for the slug
        const courseRes = await fetch("/api/courses/main", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: 'no-store',
        });
        if (!courseRes.ok) throw new Error("Gagal memuat materi kursus");
        const courseData = await courseRes.json();
        const steps = courseData.steps || [];

        if (mainEnrollment) {
          if (mainEnrollment.certificateClaimed || mainEnrollment.status === "certified") {
            router.replace('/learn/certificate');
            return;
          }

          const targetStepNum = mainEnrollment.currentStep || 1;
          const targetStepData = steps[targetStepNum - 1] || steps[0];
          if (targetStepData) {
            router.replace(`/learn/${createSlug(targetStepData.title)}`);
          } else {
            router.replace(`/learn/${targetStepNum}`);
          }
        } else {
          // If no enrollment, start at step 1
          const firstStep = steps[0];
          if (firstStep) {
            router.replace(`/learn/${createSlug(firstStep.title)}`);
          } else {
            router.replace(`/learn/1`);
          }
        }
      } catch (e: any) {
        console.error(e);
        setError(e.message);
      }
    };

    init();
  }, [user, router]);

  // Saat loading, tidak perlu tampilkan apapun — LearnLayout sudah handle
  // Error saja yang perlu ditampilkan ke user
  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
        <p style={{ color: "red", textAlign: "center" }}>{error}</p>
        <button onClick={() => window.location.reload()} style={{ padding: "8px 16px", borderRadius: "4px", border: "1px solid #ccc" }}>Coba Lagi</button>
      </div>
    );
  }

  // Redirect sedang dalam proses — tampilkan null agar tidak ada spinner ganda
  return null;
}
