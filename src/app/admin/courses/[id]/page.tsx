"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "./page.module.css";
import type { CourseStep } from "@/lib/types";
import { Video, FileText, ClipboardList, MousePointer2 } from "lucide-react";

// Dummy data
const DUMMY_STEPS: CourseStep[] = [
  {
    id: "step-1",
    courseId: "course-main",
    order: 1,
    title: "Pengantar Literasi Finansial",
    video: { youtubeId: "dQw4w9WgXcQ", url: "https://youtube.com/watch?v=dQw4w9WgXcQ", duration: 120 },
    companionType: "none",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "step-2",
    courseId: "course-main",
    order: 2,
    title: "Mengelola Arus Kas",
    video: { youtubeId: "dQw4w9WgXcQ", url: "https://youtube.com/watch?v=dQw4w9WgXcQ", duration: 300 },
    companionType: "assessment",
    assessment: {
      kkm: 80,
      questions: [{ id: "q1", text: "Apa itu Cashflow?", options: [], correctAnswer: "", feedbackCorrect: "", feedbackWrong: "", hint: "" }]
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "step-3",
    courseId: "course-main",
    order: 3,
    title: "Survei Kepuasan Modul 1",
    video: { youtubeId: "", url: "", duration: 0 },
    companionType: "survey",
    survey: { questions: [] },
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

export default function CourseEditorPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  
  const [steps, setSteps] = useState(DUMMY_STEPS);

  // Fungsi sederhana untuk geser urutan
  const moveStep = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index > 0) {
      const newSteps = [...steps];
      [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
      setSteps(newSteps);
    } else if (direction === "down" && index < steps.length - 1) {
      const newSteps = [...steps];
      [newSteps[index + 1], newSteps[index]] = [newSteps[index], newSteps[index + 1]];
      setSteps(newSteps);
    }
  };

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <Link href="/admin/courses" className={styles.backBtn}>
            ← Kembali ke Daftar Kursus
          </Link>
          <div className={styles.topActions}>
            <button className="btn btn-secondary">Preview Kursus</button>
            <button className="btn btn-primary">Simpan Perubahan</button>
          </div>
        </div>

        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Edit Kursus: Literasi Finansial Dasar</h1>
            <p className={styles.subtitle}>ID: {courseId}</p>
          </div>
        </header>

        <div className={styles.content}>
          {/* Left Column: List of Steps */}
          <div className={styles.stepsPanel}>
            <div className={styles.panelHeader}>
              <h2>Urutan Materi</h2>
              <button className={styles.textBtn}>+ Tambah Step</button>
            </div>
            
            <div className={styles.stepList}>
              {steps.map((step, index) => (
                <div key={step.id} className={styles.stepCard}>
                  <div className={styles.stepControls}>
                    <button onClick={() => moveStep(index, "up")} disabled={index === 0}>▲</button>
                    <span>{index + 1}</span>
                    <button onClick={() => moveStep(index, "down")} disabled={index === steps.length - 1}>▼</button>
                  </div>
                  
                  <div className={styles.stepInfo}>
                    <h4 className={styles.stepTitle}>{step.title}</h4>
                    <div className={styles.stepBadges}>
                      {step.video.youtubeId && <span className={styles.badgeVideo}><Video size={14} style={{ display: 'inline-block', verticalAlign: 'text-bottom', marginRight: '4px' }} /> Video</span>}
                      {step.companionType === "assessment" && <span className={styles.badgeAssessment}><FileText size={14} style={{ display: 'inline-block', verticalAlign: 'text-bottom', marginRight: '4px' }} /> Assessment</span>}
                      {step.companionType === "survey" && <span className={styles.badgeSurvey}><ClipboardList size={14} style={{ display: 'inline-block', verticalAlign: 'text-bottom', marginRight: '4px' }} /> Survei</span>}
                    </div>
                  </div>
                  
                  <button className={styles.editBtn}>Edit</button>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Editor (Placeholder for now) */}
          <div className={styles.editorPanel}>
            <div className={styles.emptyEditor}>
              <span className={styles.emptyIcon}><MousePointer2 size={48} style={{ color: 'var(--color-gray-400)' }} /></span>
              <h3>Pilih Materi untuk Diedit</h3>
              <p>Klik tombol Edit pada daftar materi di sebelah kiri.</p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
