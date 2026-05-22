"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";

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

        if (mainEnrollment) {
          const targetStep = mainEnrollment.currentStep || 1;
          router.replace(`/learn/${targetStep}`);
        } else {
          // If no enrollment, start at step 1
          router.replace(`/learn/1`);
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
