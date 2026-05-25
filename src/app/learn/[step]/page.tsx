"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import LMSPlayer from "@/components/LMSPlayer";
import type { QuizQuestion, LMSScreen } from "@/components/LMSPlayer";
import { useAuth } from "@/contexts/AuthContext";
import { useLearnLoading } from "@/contexts/LearnLoadingContext";
import { createSlug } from "@/lib/utils";
import CourseMenuDrawer from "@/components/CourseMenuDrawer/CourseMenuDrawer";
import type { StepNavItem } from "@/components/StepNav";
import WorkshopBanner from "@/components/WorkshopBanner/WorkshopBanner";
import type { WorkshopData } from "@/components/LandingTemplate/LandingTemplate";

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

  const paramStep = params.step as string;
  let stepNumber = 1;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseData, setCourseData] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);

  const [showNameModal, setShowNameModal] = useState(false);
  const [certName, setCertName] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [workshopData, setWorkshopData] = useState<WorkshopData | null>(null);

  // Claim modal
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimStep, setClaimStep] = useState(0); // 0=saving, 1=generating, 2=done, -1=error
  const [claimErrorMsg, setClaimErrorMsg] = useState("");

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

        // ── Try sessionStorage cache for course data ──
        let cachedCourse: any = null;
        try {
          const raw = sessionStorage.getItem("__courseData");
          if (raw) {
            const parsed = JSON.parse(raw);
            // Cache valid for 5 minutes
            if (parsed._ts && Date.now() - parsed._ts < 5 * 60 * 1000) {
              cachedCourse = parsed.data;
            }
          }
        } catch {}

        // ── Parallel fetch: course (if not cached) + enrollment ──
        const coursePromise = cachedCourse
          ? Promise.resolve(cachedCourse)
          : fetch("/api/courses/main", { headers }).then(async (r) => {
              if (!r.ok) throw new Error("Gagal memuat materi");
              const d = await r.json();
              try { sessionStorage.setItem("__courseData", JSON.stringify({ data: d, _ts: Date.now() })); } catch {}
              return d;
            });

        const enrollPromise = fetch("/api/enrollments", { headers }).then(async (r) => {
          if (!r.ok) throw new Error("Gagal memuat progress belajar");
          return r.json();
        });

        const [cData, eData] = await Promise.all([coursePromise, enrollPromise]);

        setCourseData(cData);

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

        // ── Load workshop data jika channelSource = workshop ──
        const enChannelSource = mainEn.channelSource || "";
        const enEventId = mainEn.eventId || "";
        if (enChannelSource === "workshop" && enEventId) {
          // Fire and forget — don't block rendering
          fetch(`/api/events/public/${enEventId}`)
            .then(r => r.ok ? r.json() : null)
            .then(wsData => {
              if (wsData?.workshopData) {
                setWorkshopData(wsData.workshopData);
                localStorage.setItem("activeWorkshopData", JSON.stringify(wsData.workshopData));
                localStorage.setItem("activeWorkshopEventId", enEventId);
              }
            })
            .catch(() => {});
        }

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
      router.replace(`/learn/${paramStep}?${p.toString()}`, { scroll: false });
    },
    [router, paramStep]
  );

  // Beritahu layout bahwa konten sudah siap → overlay hilang
  const { signalReady } = useLearnLoading();
  useEffect(() => {
    if (!loading && courseData) signalReady();
  }, [loading, courseData, signalReady]);

  // Selama loading, return null — overlay dari layout yang tampil
  if (loading) return null;

  if (error || !courseData) {
    return (
      <div style={{ textAlign: "center", padding: "40px", width: "100%" }}>
        <h2 style={{ color: "var(--color-red-600)" }}>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} style={{ padding: "8px 16px", marginTop: "10px" }}>Coba Lagi</button>
      </div>
    );
  }

  const steps = courseData.steps || [];
  
  // Determine stepNumber dynamically based on slug or number
  const matchedIndex = steps.findIndex((s: any) => createSlug(s.title) === paramStep);
  if (matchedIndex !== -1) {
    stepNumber = matchedIndex + 1;
  } else {
    stepNumber = parseInt(paramStep, 10) || 1;
  }

  const activeStep = steps[stepNumber - 1];
  const isLastStep = stepNumber >= steps.length;
  
  // Can access if stepNumber <= currentStep
  const canAccess = stepNumber <= (enrollment?.currentStep || 1);

  if (!canAccess) {
    return (
      <>
        <div className="step-locked-wrap">
          <div className="step-locked-card">
            <div className="step-locked-icon">🔒</div>
            <h2>Materi Terkunci</h2>
            <p>Selesaikan materi sebelumnya terlebih dahulu untuk membuka materi ini.</p>
            <button className="step-back-btn" onClick={() => router.push("/learn")}>
              Kembali ke Materi Terakhir
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!activeStep) {
    return (
      <>
        <div style={{ textAlign: "center", padding: "40px", width: "100%" }}>
          <h2>Materi Tidak Ditemukan</h2>
          <button onClick={() => router.push("/learn")} style={{ padding: "8px 16px", marginTop: "10px" }}>Kembali</button>
        </div>
      </>
    );
  }



  async function handleProceedToNext(results?: { assessment?: any; survey?: any; }, shouldNavigate: boolean = true) {
    try {
      const idToken = await user!.getIdToken();
      const res = await fetch(`/api/enrollments/${enrollment.id}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
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

      // Update local state instantly so the sidebar marks it as completed
      setEnrollment((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentStep: isLastStep ? prev.currentStep : Math.max(prev.currentStep, stepNumber + 1),
          stepProgress: {
            ...(prev.stepProgress || {}),
            [activeStep.id]: {
              ...((prev.stepProgress || {})[activeStep.id] || {}),
              completed: true,
              assessmentResult: results?.assessment,
              surveyResult: results?.survey,
            }
          }
        };
      });

      if (shouldNavigate) {
        if (!isLastStep) {
          const nextStep = steps[stepNumber];
          if (nextStep) {
            router.push(`/learn/${createSlug(nextStep.title)}`);
          } else {
            router.push(`/learn/${stepNumber + 1}`);
          }
        } else {
          // ── LAST STEP: Show modal + claim cert ──
          setClaimModalOpen(true);
          setClaimStep(0); // saving progress

          // Small delay for visual feedback
          await new Promise(r => setTimeout(r, 600));
          setClaimStep(1); // generating cert

          try {
            const claimRes = await fetch(`/api/enrollments/${enrollment.id}/claim-cert`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ customName: certName.trim() || undefined }),
            });
            const claimData = await claimRes.json();

            if (!claimRes.ok) {
              setClaimStep(-1);
              setClaimErrorMsg(claimData.error || "Gagal generate sertifikat");
              return;
            }

            setClaimStep(2); // done!

            // Auto-download PDF jika ada driveUrl
            const driveUrl = claimData.driveUrl || claimData.downloadUrl;
            if (driveUrl) {
              try {
                const fileId = driveUrl.match(/\/d\/([^/]+)/)?.[1];
                const downloadLink = fileId
                  ? `https://drive.google.com/uc?export=download&id=${fileId}`
                  : driveUrl;
                window.open(downloadLink, "_blank");
              } catch {
                // download gagal, tidak apa-apa — user bisa download di halaman sertifikat
              }
            }

            await new Promise(r => setTimeout(r, 1500));
            router.push("/learn/certificate");
          } catch {
            setClaimStep(-1);
            setClaimErrorMsg("Terjadi kesalahan. Coba lagi.");
          }
          return; // don't fall through
        }
      }
    } catch (e: any) {
      console.error("Failed to save progress", e);
      alert("Gagal menyimpan progress: " + (e.message || "Coba ulangi."));
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
    <>
      <div className="step-wrapper">
        {/* Workshop Banner — tampil di atas LMSPlayer jika channelSource=workshop */}
        {workshopData && enrollment?.eventId && (
          <WorkshopBanner
            workshopData={workshopData}
            eventId={enrollment.eventId}
            enrollmentId={enrollment.id}
          />
        )}
        <LMSPlayer
          youtubeId={activeStep.video?.youtubeId || ""}
          questions={questions}
          kkm={kkm}
          surveyEnabled={activeStep.hasSurvey && surveyQuestions.length > 0}
          surveyQuestions={surveyQuestions}
          additionalMaterial={activeStep.hasAdditionalMaterial ? activeStep.additionalMaterial : undefined}
          onProceedToNext={handleProceedToNext}
          isLastStep={isLastStep}
          alreadyCompleted={!!currentStepProgress.completed || !!currentStepProgress.isCompleted}
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
          onOpenMenu={() => setMenuOpen(true)}
        />
      </div>

      <CourseMenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        steps={steps.map((s: any, idx: number) => {
          const num = idx + 1;
          const progress = enrollment?.stepProgress?.[s.id];
          
          let status: "locked" | "current" | "completed" = "locked";
          if (progress?.completed || progress?.isCompleted) status = "completed";
          else if (num === (enrollment?.currentStep || 1)) status = "current";
          else if (num < (enrollment?.currentStep || 1)) status = "completed"; // fallback

          return {
            stepNumber: num,
            title: s.title,
            status,
            hasAssessment: s.hasAssessment,
            assessmentPassed: s.hasAssessment ? (progress?.assessmentResult?.score >= (s.assessment?.kkm || 70)) : undefined
          };
        })}
        currentStep={stepNumber}
        courseName={courseData?.title || "Modul Financial Literacy"}
      />

      {/* ── Claim Certificate Modal ── */}
      {claimModalOpen && (
        <div className="ccm-overlay">
          <div className="ccm-modal">
            {claimStep >= 0 ? (
              <>
                <div className="ccm-icon">
                  {claimStep < 2 ? (
                    <div className="ccm-spinner" />
                  ) : (
                    <div className="ccm-check">✓</div>
                  )}
                </div>
                <h3 className="ccm-title">
                  {claimStep === 0 && "Menyimpan progress..."}
                  {claimStep === 1 && "Membuat sertifikat..."}
                  {claimStep === 2 && "Sertifikat berhasil dibuat! 🎉"}
                </h3>
                <div className="ccm-steps">
                  <div className={`ccm-step ${claimStep >= 0 ? 'ccm-step--done' : ''}`}>
                    <span className="ccm-dot">{claimStep > 0 ? '✓' : '⏳'}</span>
                    Menyimpan progress materi
                  </div>
                  <div className={`ccm-step ${claimStep >= 1 ? (claimStep > 1 ? 'ccm-step--done' : 'ccm-step--active') : ''}`}>
                    <span className="ccm-dot">{claimStep > 1 ? '✓' : claimStep === 1 ? '⏳' : '○'}</span>
                    Generate sertifikat digital
                  </div>
                  <div className={`ccm-step ${claimStep >= 2 ? 'ccm-step--done' : ''}`}>
                    <span className="ccm-dot">{claimStep >= 2 ? '✓' : '○'}</span>
                    Selesai
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="ccm-icon">
                  <div className="ccm-error-icon">✕</div>
                </div>
                <h3 className="ccm-title" style={{ color: 'var(--color-primary)' }}>Gagal Membuat Sertifikat</h3>
                <p className="ccm-error-msg">{claimErrorMsg}</p>
                <button className="ccm-retry-btn" onClick={() => { setClaimModalOpen(false); }}>Tutup</button>
              </>
            )}
          </div>
        </div>
      )}

    </>
  );
}
