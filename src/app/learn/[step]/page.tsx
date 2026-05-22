"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import LMSPlayer from "@/components/LMSPlayer";
import type { QuizQuestion, LMSScreen } from "@/components/LMSPlayer";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";

// ─── Helpers ─────────────────────────────────────────────────────
function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

const VALID_SCREENS: LMSScreen[] = ["quiz", "review", "survey"];
function parseScreen(raw: string | null, fallback: LMSScreen = "quiz"): LMSScreen {
  return VALID_SCREENS.includes(raw as LMSScreen) ? (raw as LMSScreen) : fallback;
}

// ─── Page ────────────────────────────────────────────────────────
export default function StepPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();

  const stepNumber = parseInt(params.step as string, 10) || 1;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseData, setCourseData] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);

  const [showNameModal, setShowNameModal] = useState(false);
  const [certName, setCertName] = useState("");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (profile) {
      setCertName(profile.profileData?.namaLengkap || profile.displayName || "");
    }
  }, [profile]);

  // ── Read initial state from URL ──
  const rawScreen = searchParams.get("s");
  const initialScreen = rawScreen && VALID_SCREENS.includes(rawScreen as LMSScreen) 
    ? (rawScreen as LMSScreen) 
    : undefined;
  const initialQIdx = Math.max(parseInt(searchParams.get("q") || "0", 10), 0);
  const initialRevIdx = Math.max(parseInt(searchParams.get("rev") || "0", 10), 0);
  const initialSurvSec = Math.max(parseInt(searchParams.get("sec") || "0", 10), 0);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        const idToken = await user.getIdToken();
        const headers = { Authorization: `Bearer ${idToken}` };

        // Load Course
        const cRes = await fetch("/api/courses/main", { headers, cache: 'no-store' });
        if (!cRes.ok) throw new Error("Gagal memuat materi");
        const cData = await cRes.json();
        setCourseData(cData);

        // Load Enrollment
        const eRes = await fetch("/api/enrollments", { headers, cache: 'no-store' });
        if (!eRes.ok) throw new Error("Gagal memuat progress belajar");
        const eData = await eRes.json();
        let mainEn = eData.find((e: any) => e.courseId === "course-main");
        
        if (!mainEn) {
          const enrollRes = await fetch("/api/enrollments/auto-enroll", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ courseId: "course-main" })
          });
          if (!enrollRes.ok) throw new Error("Kamu belum terdaftar di kelas ini.");
          const enrollData = await enrollRes.json();
          mainEn = enrollData.enrollment;
        }

        if (!mainEn) throw new Error("Gagal mendaftar kelas.");
        setEnrollment(mainEn);
        setLoading(false);
      } catch (e: any) {
        setError(e.message);
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  // ── URL update callback ──
  const handleStateChange = useCallback(
    (screen: LMSScreen, q: number, rev: number, sec: number) => {
      const p = new URLSearchParams();
      p.set("s", screen);
      if (screen === "quiz") p.set("q", String(q));
      if (screen === "review") p.set("rev", String(rev));
      if (screen === "survey") p.set("sec", String(sec));
      router.replace(`/learn/${stepNumber}?${p.toString()}`, { scroll: false });
    },
    [router, stepNumber]
  );

  if (loading) {
    return (
      <ProtectedRoute>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh", width: "100%" }}>
          <div className="spinner spinner-lg" />
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !courseData) {
    return (
      <ProtectedRoute>
        <div style={{ textAlign: "center", padding: "40px", width: "100%" }}>
          <h2 style={{ color: "var(--color-red-600)" }}>Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} style={{ padding: "8px 16px", marginTop: "10px" }}>Coba Lagi</button>
        </div>
      </ProtectedRoute>
    );
  }

  const steps = courseData.steps || [];
  const activeStep = steps[stepNumber - 1];
  const isLastStep = stepNumber >= steps.length;
  
  // Can access if stepNumber <= currentStep
  const canAccess = stepNumber <= (enrollment?.currentStep || 1);

  if (!canAccess) {
    return (
      <ProtectedRoute>
        <div className={styles.lockedWrapper}>
          <div className={styles.lockedCard}>
            <div className={styles.lockedIcon}>🔒</div>
            <h2>Materi Terkunci</h2>
            <p>Selesaikan materi sebelumnya terlebih dahulu untuk membuka materi ini.</p>
            <button className={styles.backBtn} onClick={() => router.push("/learn")}>
              Kembali ke Materi Terakhir
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!activeStep) {
    return (
      <ProtectedRoute>
        <div style={{ textAlign: "center", padding: "40px", width: "100%" }}>
          <h2>Materi Tidak Ditemukan</h2>
          <button onClick={() => router.push("/learn")} style={{ padding: "8px 16px", marginTop: "10px" }}>Kembali</button>
        </div>
      </ProtectedRoute>
    );
  }



  async function handleProceedToNext(results?: { assessment?: any; survey?: any; }) {
    try {
      const idToken = await user!.getIdToken();
      const res = await fetch(`/api/enrollments/${enrollment.id}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        cache: 'no-store',
        body: JSON.stringify({
          stepId: activeStep.id,
          assessmentResult: results?.assessment,
          surveyResult: results?.survey,
          isCompleted: true,
          nextStepNumber: isLastStep ? stepNumber : stepNumber + 1
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal menyimpan progress");
      }

      if (!isLastStep) {
        router.push(`/learn/${stepNumber + 1}`);
      } else {
        setShowNameModal(true);
      }
    } catch (e: any) {
      console.error("Failed to save progress", e);
      alert("Gagal menyimpan progress: " + (e.message || "Coba ulangi."));
    }
  }

  async function handleClaimCert() {
    if (!certName.trim()) return alert("Nama tidak boleh kosong");
    setClaiming(true);
    try {
      const idToken = await user!.getIdToken();
      const res = await fetch(`/api/enrollments/${enrollment.id}/claim-cert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ customName: certName })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal klaim sertifikat");
      }

      router.push("/learn/certificate");
    } catch (e: any) {
      console.error("Failed to claim cert", e);
      alert("Gagal klaim sertifikat: " + (e.message || "Coba ulangi."));
      setClaiming(false);
    }
  }

  const questions = (activeStep.hasAssessment && activeStep.assessment?.questions) || [];
  const surveyQuestions = (activeStep.hasSurvey && activeStep.survey?.questions) || [];
  const kkm = activeStep.assessment?.kkm || 70;

  // Use progress from Firestore for initial answers
  const currentStepProgress = enrollment?.stepProgress?.[activeStep.id] || {};
  const initialAnswers = currentStepProgress.assessmentResult?.answers || {};
  const initialSurveyAnswers = currentStepProgress.surveyResult || {};

  return (
    <ProtectedRoute>
      <div className={styles.wrapper}>
        <LMSPlayer
          youtubeId={activeStep.video?.youtubeId || ""}
          questions={questions}
          kkm={kkm}
          surveyEnabled={activeStep.hasSurvey && surveyQuestions.length > 0}
          surveyQuestions={surveyQuestions}
          onProceedToNext={handleProceedToNext}
          isLastStep={isLastStep}
          stepId={`step-${activeStep.id}`}
          stepNumber={stepNumber}
          totalSteps={steps.length}
          stepTitle={activeStep.title}
          initialScreen={initialScreen}
          initialQIdx={clamp(initialQIdx, 0, Math.max(0, questions.length - 1))}
          initialRevIdx={clamp(initialRevIdx, 0, Math.max(0, questions.length - 1))}
          initialSurvSec={clamp(initialSurvSec, 0, Math.max(0, surveyQuestions.length - 1))}
          onStateChange={handleStateChange}
          initialAnswers={initialAnswers}
          initialSurveyAnswers={initialSurveyAnswers}
        />
      </div>

      {showNameModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: 'white', padding: '30px', borderRadius: '12px',
            width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>Konfirmasi Nama Sertifikat</h2>
            <p style={{ fontSize: '14px', color: '#555', marginBottom: '20px' }}>
              Silakan periksa nama yang akan dicetak pada sertifikat. Anda dapat mengubahnya atau menambahkan gelar jika perlu.
            </p>
            <input 
              type="text" 
              value={certName}
              onChange={e => setCertName(e.target.value)}
              style={{
                width: '100%', padding: '12px', border: '1.5px solid #E5E5E5',
                borderRadius: '8px', marginBottom: '20px', fontSize: '16px'
              }}
              placeholder="Masukkan nama lengkap"
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={handleClaimCert}
                disabled={claiming}
                style={{
                  padding: '10px 20px', background: '#CC0000', color: 'white',
                  border: 'none', borderRadius: '8px', cursor: claiming ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {claiming ? "Memproses..." : "Klaim Sertifikat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
