"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";

// ═══ DATA DUMMY untuk development ═══
// Nanti akan diganti dengan data dari Firestore
interface StepNavItem {
  stepNumber: number;
  title: string;
  status: "locked" | "current" | "completed";
  hasAssessment: boolean;
  assessmentPassed?: boolean;
}

const DUMMY_STEPS: StepNavItem[] = [
  { stepNumber: 1, title: "Apa Itu Literasi Finansial?", status: "completed", hasAssessment: true, assessmentPassed: true },
  { stepNumber: 2, title: "Mengenal Jenis Pendapatan", status: "current", hasAssessment: true, assessmentPassed: false },
  { stepNumber: 3, title: "Cara Mengatur Anggaran", status: "locked", hasAssessment: true },
  { stepNumber: 4, title: "Menabung vs Investasi", status: "locked", hasAssessment: true },
  { stepNumber: 5, title: "Pentingnya Dana Darurat", status: "locked", hasAssessment: true },
  { stepNumber: 6, title: "Mengenal Produk Perbankan", status: "locked", hasAssessment: false },
  { stepNumber: 7, title: "Manajemen Utang yang Sehat", status: "locked", hasAssessment: true },
  { stepNumber: 8, title: "Perencanaan Keuangan Jangka Panjang", status: "locked", hasAssessment: true },
  { stepNumber: 9, title: "Survei Akhir", status: "locked", hasAssessment: false },
  { stepNumber: 10, title: "Klaim Sertifikat", status: "locked", hasAssessment: false },
];

export default function LearnPage() {
  const router = useRouter();
  const [steps] = useState<StepNavItem[]>(DUMMY_STEPS);

  // Cari step pertama yang belum selesai
  useEffect(() => {
    const currentStep = steps.find((s) => s.status === "current");
    const firstIncomplete = steps.find((s) => s.status !== "completed");
    const target = currentStep || firstIncomplete || steps[0];
    router.replace(`/learn/${target.stepNumber}`);
  }, [steps, router]);

  return (
    <ProtectedRoute>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: "60vh" }}>
        <div className="loading-overlay">
          <div className="spinner spinner-lg" />
          <p style={{ marginTop: "16px", color: "var(--color-gray-500)", fontWeight: 600 }}>Mengarahkan ke materi...</p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
