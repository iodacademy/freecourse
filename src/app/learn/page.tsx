"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
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

        if (!mainEnrollment) {
          const enrollRes = await fetch("/api/enrollments/auto-enroll", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ courseId: "course-main" })
          });
          if (enrollRes.ok) {
            const enrollData = await enrollRes.json();
            mainEnrollment = enrollData.enrollment;
          }
        }

        // Fetch course steps to get the title for the slug
        const courseRes = await fetch("/api/courses/main", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: 'no-store',
        });
        if (!courseRes.ok) throw new Error("Gagal memuat materi kursus");
        const courseData = await courseRes.json();
        const steps = courseData.steps || [];

        if (mainEnrollment) {
          const targetStepNum = mainEnrollment.currentStep || 1;
          const targetStepData = steps[targetStepNum - 1] || steps[0];
          if (targetStepData) {
            window.location.replace(`/learn/${createSlug(targetStepData.title)}`);
          } else {
            window.location.replace(`/learn/${targetStepNum}`);
          }
        } else {
          // If no enrollment, start at step 1
          const firstStep = steps[0];
          if (firstStep) {
            window.location.replace(`/learn/${createSlug(firstStep.title)}`);
          } else {
            window.location.replace(`/learn/1`);
          }
        }
      } catch (e: any) {
        console.error(e);
        setError(e.message);
      }
    };

    init();
  }, [user, router]);

  return (
    <ProtectedRoute>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: "100%", height: "100%", minHeight: "60vh" }}>
        {error ? (
          <div style={{ color: "red", textAlign: "center" }}>
            <p>{error}</p>
            <button onClick={() => window.location.reload()} style={{ marginTop: 10, padding: "8px 16px", borderRadius: "4px", border: "1px solid #ccc" }}>Coba Lagi</button>
          </div>
        ) : (
          <div className="loading-overlay">
            <div className="spinner spinner-lg" />
            <p style={{ marginTop: "16px", color: "var(--color-gray-500)", fontWeight: 600 }}>Mengarahkan ke materi...</p>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
