"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { PartyPopper, GraduationCap, X, FileText, Check, Star } from "lucide-react";

// ─── Types ───────────────────────────────────────
export interface QuizQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
  feedbackCorrect: string;
  feedbackWrong: string;
  explanation?: string;
  points?: number; // bobot nilai per soal (opsional, default: bagi rata)
}

export interface SurveyQuestion {
  id: string;
  type: "shortText" | "multipleChoice" | "scale" | "starRating";
  text: string;
  description?: string;
  options?: string[];
  required?: boolean;
  minLabel?: string;
  maxLabel?: string;
  maxStars?: number;
}

export type LMSScreen = "quiz" | "review" | "survey" | "additional";

export interface LMSPlayerProps {
  youtubeId: string;
  questions: QuizQuestion[];
  kkm: number;
  surveyEnabled?: boolean;
  surveyQuestions?: SurveyQuestion[];
  onPass?: (score: number) => void;
  onComplete?: () => void;
  stepNumber?: number;
  totalSteps?: number;
  stepTitle?: string;
  isLastStep?: boolean;
  alreadyCompleted?: boolean;
  onProceedToNext?: (results?: { assessment?: any; survey?: any; }, shouldNavigate?: boolean) => void;
  onOpenMenu?: () => void;
  stepId: string;
  initialScreen?: LMSScreen;
  initialQIdx?: number;
  initialRevIdx?: number;
  initialSurvSec?: number;
  onStateChange?: (screen: LMSScreen, qIdx: number, revIdx: number, survSec: number) => void;
  initialAnswers?: Record<string, string>;
  initialSurveyAnswers?: Record<string, any>;
  additionalMaterial?: {
    description: string;
    linkTitle: string;
    linkUrl: string;
  };
}

// ── Seeded shuffle (Fisher-Yates) ──
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Sub-renders ─────────────────────────────────

function VideoEmbed({ youtubeId }: { youtubeId: string }) {
  return (
    <div className="lms-video-wrap">
      <div className="lms-player">
        <div className="lms-player-inner">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`}
            title="Video Pembelajaran"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="lms-player-iframe"
          />
        </div>
      </div>
    </div>
  );
}

function DonutChart({ score, pass }: { score: number; pass: boolean }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const targetOffset = C - (score / 100) * C;
  const [offset, setOffset] = useState(C);
  useEffect(() => {
    const t = setTimeout(() => setOffset(targetOffset), 120);
    return () => clearTimeout(t);
  }, [targetOffset]);
  const color = pass ? "#CC0000" : "#DC2626";
  return (
    <div className="lms-donut-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#E5E5E5" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={R} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={C.toFixed(2)}
          strokeDashoffset={offset.toFixed(2)}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }}
        />
        <text x="70" y="64" textAnchor="middle" fontFamily="inherit" fontSize="28" fontWeight="800" fill={color}>{score}</text>
        <text x="70" y="81" textAnchor="middle" fontFamily="inherit" fontSize="9" fontWeight="600" fill="#737373" letterSpacing="1">SKOR AKHIR</text>
      </svg>
    </div>
  );
}

// ─── Main Component ───────────────────────────────

export default function LMSPlayer({
  youtubeId,
  questions,
  kkm,
  surveyEnabled = true,
  surveyQuestions = [],
  onPass,
  onComplete,
  isLastStep,
  onProceedToNext,
  stepId,
  stepNumber,
  totalSteps,
  initialScreen,
  initialQIdx = 0,
  initialRevIdx = 0,
  initialSurvSec = 0,
  onStateChange,
  initialAnswers = {},
  initialSurveyAnswers = {},
  additionalMaterial,
  onOpenMenu,
  alreadyCompleted
}: LMSPlayerProps) {
  const hasAssessment = questions.length > 0;
  const hasSurvey = surveyEnabled && surveyQuestions.length > 0;
  const hasAdditionalMaterial = !!additionalMaterial;

  // ── Randomize soal & opsi sekali saat mount ──
  const sessionSeed = useMemo(() => Math.floor(Math.random() * 1000000), []);

  const shuffledQuestions = useMemo(() => {
    if (Object.keys(initialAnswers).length > 0) return questions; // keep order if resuming
    const shuffledQ = seededShuffle(questions, sessionSeed);
    return shuffledQ.map((q, i) => ({
      ...q,
      options: seededShuffle(q.options, sessionSeed + i + 1),
    }));
  }, [questions, sessionSeed, initialAnswers]);

  const defaultScreen: LMSScreen = alreadyCompleted
    ? (hasAdditionalMaterial ? "additional" : hasSurvey ? "survey" : hasAssessment ? "review" : "quiz")
    : (hasAssessment ? "quiz" : hasSurvey ? "survey" : hasAdditionalMaterial ? "additional" : "quiz");
  const [screen, setScreen] = useState<LMSScreen>(initialScreen || defaultScreen);
  const [qIdx, setQIdx] = useState(initialQIdx);
  const [revIdx, setRevIdx] = useState(initialRevIdx);
  const [survSec, setSurvSec] = useState(initialSurvSec);

  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, any>>(initialSurveyAnswers);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  
  // ── Quiz REDESIGN state (per-question check like REDESIGN) ──
  const [quizResults, setQuizResults] = useState<Record<string, "correct" | "wrong">>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  useEffect(() => {
    if (Object.keys(initialAnswers).length > 0) {
      setAnswers(initialAnswers);
    }
  }, [initialAnswers]);

  useEffect(() => {
    if (Object.keys(initialSurveyAnswers).length > 0) {
      setSurveyAnswers(initialSurveyAnswers);
    }
  }, [initialSurveyAnswers]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [screen, qIdx, revIdx, survSec]);

  const correctCount = shuffledQuestions.filter((q) => answers[q.id] === q.correctAnswer).length;

  // ── Hitung nilai berbobot ──
  // Jika soal punya field `points`, gunakan. Jika tidak, bagi rata (100 / jumlah soal)
  function calcWeightedScore(qs: typeof shuffledQuestions, ans: Record<string, string>): number {
    if (qs.length === 0) return 0;
    const totalPoints = qs.reduce((sum, q) => sum + (q.points ?? 0), 0);
    const useWeighted = totalPoints > 0;
    if (useWeighted) {
      const earnedPoints = qs
        .filter(q => ans[q.id] === q.correctAnswer)
        .reduce((sum, q) => sum + (q.points ?? 0), 0);
      return Math.round((earnedPoints / totalPoints) * 100);
    } else {
      // Fallback: bagi rata
      const correct = qs.filter(q => ans[q.id] === q.correctAnswer).length;
      return Math.round((correct / qs.length) * 100);
    }
  }

  const score = shuffledQuestions.length > 0 ? calcWeightedScore(shuffledQuestions, answers) : 0;
  const passed = score >= kkm;

  // REDESIGN quiz results
  const qzCorrectCount = Object.values(quizResults).filter(r => r === "correct").length;
  const qzAllAnswered = shuffledQuestions.every(q => answers[q.id]);
  // qzScore: nilai berbobot dari soal yang sudah dicek (quizResults)
  const qzScore = useMemo(() => {
    if (!quizSubmitted) return 0;
    if (shuffledQuestions.length === 0) return 0;
    
    const totalPoints = shuffledQuestions.reduce((sum, q) => sum + (q.points ?? 0), 0);
    const useWeighted = totalPoints > 0;
    
    if (useWeighted) {
      const earnedPoints = shuffledQuestions
        .filter(q => quizResults[q.id] === "correct")
        .reduce((sum, q) => sum + (q.points ?? 0), 0);
      return Math.round((earnedPoints / totalPoints) * 100);
    } else {
      const correct = shuffledQuestions.filter(q => quizResults[q.id] === "correct").length;
      return Math.round((correct / shuffledQuestions.length) * 100);
    }
  }, [quizSubmitted, quizResults, shuffledQuestions]);
  const qzPassed = quizSubmitted && qzScore >= kkm;
  const qzFailed = quizSubmitted && qzScore < kkm;

  function nav(s: LMSScreen, q = qIdx, r = revIdx, sec = survSec) {
    onStateChange?.(s, q, r, sec);
  }

  function handleQuizPick(qid: string, oid: string) {
    if (quizResults[qid] === "correct") return;
    setAnswers(a => ({ ...a, [qid]: oid }));
    if (quizResults[qid] === "wrong") {
      setQuizResults(r => { const x = { ...r }; delete x[qid]; return x; });
    }
  }

  function handleQuizCheck() {
    const newResults = { ...quizResults };
    for (const q of shuffledQuestions) {
      if (newResults[q.id] === "correct") continue;
      newResults[q.id] = answers[q.id] === q.correctAnswer ? "correct" : "wrong";
    }
    setQuizResults(newResults);
    setQuizSubmitted(true);

    // Hitung nilai berbobot dari hasil terbaru
    const newScore = calcWeightedScore(shuffledQuestions, answers);
    if (newScore >= kkm) {
      onPass?.(newScore);
    }
  }

  function goToReview() {
    setRevIdx(0);
    setScreen("review");
    nav("review", qIdx, 0, survSec);
  }

  function retry() {
    setAnswers({});
    setQuizResults({});
    setQuizSubmitted(false);
    setQIdx(0);
    setScreen("quiz");
    nav("quiz", 0, 0, survSec);
  }

  function jumpRev(i: number) {
    setRevIdx(i);
    nav("review", qIdx, i, survSec);
  }

  function showSurvey() {
    setSurvSec(0);
    setScreen("survey");
    nav("survey", qIdx, revIdx, 0);
  }

  function showAdditional() {
    setScreen("additional");
    nav("additional", qIdx, revIdx, survSec);
  }

  function changeSurvSec(i: number) {
    setSurvSec(i);
    nav("survey", qIdx, revIdx, i);
  }

  function saveProgressAndShowAdditional() {
    const assessmentData = hasAssessment ? { score, passed, answers } : undefined;
    const surveyData = hasSurvey ? surveyAnswers : undefined;
    onProceedToNext?.({ assessment: assessmentData, survey: surveyData }, false);
    showAdditional();
  }

  function sendSurvey() {
    if (hasAdditionalMaterial) {
      saveProgressAndShowAdditional();
    } else {
      proceedNext();
    }
  }

  function proceedNext() {
    const assessmentData = hasAssessment ? { score, passed, answers } : undefined;
    const surveyData = hasSurvey ? surveyAnswers : undefined;
    onProceedToNext?.({ assessment: assessmentData, survey: surveyData }, true);
  }

  // ══════════════════════════════════
  // LEFT COLUMN
  // ══════════════════════════════════
  const minCorrect = Math.ceil((kkm / 100) * shuffledQuestions.length);

  function renderLeft() {
    if (screen === "quiz" || screen === "survey" || screen === "review" || screen === "additional") {
      return (
        <>
          <div className="lms-video-label">Selamat Menonton Video!</div>
          <VideoEmbed youtubeId={youtubeId} />
          <div className="lms-video-footer">
            <span className="lms-step-counter">Materi {stepNumber || 1} dari {totalSteps || 1}</span>
            <button className="lms-btn-menu" onClick={onOpenMenu}>
               ☰ Daftar Materi
            </button>
          </div>



        </>
      );
    }

    return null;
  }

  // ══════════════════════════════════
  // RIGHT PANEL — title
  // ══════════════════════════════════
  function panelTitle() {
    if (screen === "additional") return "MATERI TAMBAHAN";
    if (screen === "survey") return "SURVEY";
    if (screen === "quiz" || screen === "review") return "UJI PEMAHAMAN";
    if (hasAdditionalMaterial && !hasSurvey && !hasAssessment) return "MATERI TAMBAHAN";
    if (hasSurvey && !hasAssessment) return "SURVEY";
    return "UJI PEMAHAMAN";
  }

  // ══════════════════════════════════
  // RIGHT PANEL — scroll content
  // ══════════════════════════════════
  function renderRight() {
    // ── QUIZ (REDESIGN: card per soal, pellets, banner, retry hint) ──
    if (screen === "quiz") {
      return (
        <>
          {/* Score + Pellets */}
          <div className="qz-score">
            <span>Skor sementara <b>{qzCorrectCount} / {shuffledQuestions.length}</b></span>
            <span className="qz-pellets">
              {shuffledQuestions.map(q => (
                <span
                  key={q.id}
                  className={`qz-pellet ${
                    quizResults[q.id] === "correct" ? "qz-pellet--correct" :
                    quizResults[q.id] === "wrong" ? "qz-pellet--wrong" : ""
                  }`}
                />
              ))}
            </span>
          </div>

          {/* Banner pass/fail */}
          {quizSubmitted && (
            <div className={`qz-banner ${qzPassed ? "qz-banner--pass" : "qz-banner--fail"}`}>
              <span className="qz-banner-icon">
                {qzPassed ? <Check size={14} /> : <X size={14} />}
              </span>
              <div>
                {qzPassed ? (
                  <><b>Nilai kamu: {qzScore}.</b> Kamu benar {qzCorrectCount} dari {shuffledQuestions.length} soal. Mantap! 🎉</>
                ) : (
                  <><b>Nilai kamu: {qzScore}.</b> Kamu benar {qzCorrectCount} dari {shuffledQuestions.length} soal. Perbaiki jawaban yang salah (merah) lalu klik <b>Cek Jawaban Lagi</b>.</>
                )}
              </div>
            </div>
          )}

          {/* Cards per soal */}
          {shuffledQuestions.map((q, idx) => {
            const r = quizResults[q.id];

            return (
              <div key={q.id} className="qz-item">
                {idx > 0 && <hr className="qz-separator" />}

                <div className="qz-head">
                  <span className="qz-num">Soal {idx + 1}</span>
                  {r === "correct" && (
                    <span className="qz-badge qz-badge--correct"><Check size={10} />Benar</span>
                  )}
                  {r === "wrong" && (
                    <span className="qz-badge qz-badge--wrong"><X size={10} />Salah</span>
                  )}
                </div>

                {r === "wrong" && (
                  <div className="qz-retry-hint">
                    <X size={12} />
                    Ganti jawabanmu, lalu cek lagi.
                    <span className="qz-retry-tap">Pilih jawaban</span>
                  </div>
                )}

                <p className="qz-q">{q.text}</p>

                <div className="qz-options">
                  {q.options.map(o => {
                    const isPicked = answers[q.id] === o.id;
                    const optClass = `qz-option ${
                      isPicked && !r ? "qz-option--selected" : ""
                    } ${r === "correct" && isPicked ? "qz-option--correct" : ""
                    } ${r === "wrong" && isPicked ? "qz-option--wrong" : ""}`;
                    const locked = r === "correct";

                    return (
                      <button
                        key={o.id}
                        type="button"
                        className={optClass}
                        disabled={locked}
                        onClick={() => handleQuizPick(q.id, o.id)}
                      >
                        <span className="qz-radio">
                          {r === "correct" && isPicked ? <Check size={8} /> :
                           r === "wrong" && isPicked ? <X size={8} /> : null}
                        </span>
                        <span>{o.text}</span>
                      </button>
                    );
                  })}
                </div>

                {r === "correct" && (
                  <div className="qz-locked-note">
                    <Check size={11} />Terkunci. Jawaban benar.
                  </div>
                )}
              </div>
            );
          })}
        </>
      );
    }

    // ── REVIEW ──
    if (screen === "review") {
      return (
        <>
          <DonutChart score={score} pass={passed} />

          <div className="lms-stat-grid">
            <div className="lms-stat-card">
              <div className="lms-stat-lbl">Jawaban Benar</div>
              <div className={`lms-stat-val lms-stat-green`}>{correctCount} Soal</div>
            </div>
            <div className="lms-stat-card">
              <div className="lms-stat-lbl">Status (KKM {kkm})</div>
              <div className={`lms-stat-val ${passed ? "lms-stat-green" : "lms-stat-red"}`}>
                {passed ? "LULUS ✓" : "TIDAK LULUS"}
              </div>
            </div>
          </div>

          <div className="lms-nav-divider">Review Semua Soal</div>

          {shuffledQuestions.map((q, i) => {
            const ua = answers[q.id];
            const isRight = ua === q.correctAnswer;
            const chosenOpt = q.options.find((o) => o.id === ua);
            return (
              <div key={q.id} className="lms-review-card" style={{ marginTop: i === 0 ? 0 : 12 }}>
                <div className="lms-review-tag">SOAL {i + 1}</div>
                <div className="lms-review-q">{q.text}</div>
                <div className={`lms-ans-box ${isRight ? "lms-ans-ok" : "lms-ans-err"}`}>
                  Jawaban Kamu: {ua ? `${ua.toUpperCase()}. ${chosenOpt?.text ?? ""}` : "— Tidak dijawab"}
                </div>
                <div className="lms-fb-box">
                  <div className={`lms-fb-title ${isRight ? "lms-fb-ok" : "lms-fb-err"}`}>
                    Feedback &amp; Review Materi
                  </div>
                  <div className="lms-fb-body">{isRight ? q.feedbackCorrect : q.feedbackWrong}</div>
                  <div className="lms-fb-key">Kunci Jawaban: {q.correctAnswer.toUpperCase()}</div>
                  {q.explanation && <div className="lms-fb-exp">{q.explanation}</div>}
                </div>
              </div>
            );
          })}
        </>
      );
    }

    // ── SURVEY (REDESIGN: star rating, textarea, scale, choices) ──
    if (screen === "survey") {
      if (!surveyQuestions || surveyQuestions.length === 0) {
        return (
          <div style={{ textAlign: "center", padding: 24, color: "var(--color-gray-500)" }}>Survei tidak tersedia.</div>
        );
      }
      return (
        <>
          {surveyQuestions.map((sq, i) => {
            const survAns = surveyAnswers[sq.id] || "";
            return (
              <div key={sq.id || i} className="sv-question">
                <div className="sv-label">
                  {sq.text}
                  {sq.required !== false ? (
                    <span className="yr-req">*</span>
                  ) : (
                    <span className="sv-optional">opsional</span>
                  )}
                </div>

                {/* Star Rating (REDESIGN) */}
                {sq.type === "starRating" && (
                  <div className="sv-rating">
                    <div className="sv-rating-scale">
                      <span>{sq.minLabel || "1 — Kurang Bagus"}</span>
                      <span>{sq.maxLabel || `${sq.maxStars || 5} — Sangat Bagus`}</span>
                    </div>
                    <div className="sv-rating-stars">
                      {Array.from({ length: sq.maxStars || 5 }, (_, i) => i + 1).map(n => (
                        <button
                          key={n}
                          type="button"
                          className={`sv-star ${(survAns as number) >= n ? "sv-star--on" : ""}`}
                          onClick={() => setSurveyAnswers(p => ({ ...p, [sq.id]: n }))}
                          aria-label={`${n} bintang`}
                        >
                          <span className="sv-star-num">{n}</span>
                          <Star size={22} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scale */}
                {sq.type === "scale" && (
                  <>
                    <div className="sv-scale-row">
                      {Array.from({ length: sq.maxStars || 5 }, (_, i) => i + 1).map(n => (
                        <button
                          key={n}
                          type="button"
                          className={`sv-scale-btn ${survAns === n ? "sv-scale-btn--active" : ""}`}
                          onClick={() => setSurveyAnswers(p => ({ ...p, [sq.id]: n }))}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    {(sq.minLabel || sq.maxLabel) && (
                      <div className="lms-scale-labels">
                        <span>{sq.minLabel}</span>
                        <span>{sq.maxLabel}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Multiple Choice */}
                {sq.type === "multipleChoice" && (
                  <div className="sv-choices">
                    {(sq.options || []).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`sv-choice-btn ${survAns === opt ? "sv-choice-btn--active" : ""}`}
                        onClick={() => setSurveyAnswers(p => ({ ...p, [sq.id]: opt }))}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Short Text (REDESIGN textarea) */}
                {sq.type === "shortText" && (
                  <>
                    <textarea
                      className="sv-textarea"
                      placeholder="cth. Materinya jelas, contohnya relate, tapi pengen lebih banyak studi kasus…"
                      value={survAns as string}
                      onChange={(e) => setSurveyAnswers(p => ({ ...p, [sq.id]: e.target.value }))}
                      rows={4}
                      maxLength={300}
                    />
                    <div className="sv-char-count">
                      {(survAns as string || "").length} / 300
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </>
      );
    }

    // ── ADDITIONAL MATERIAL ──
    if (screen === "additional" && additionalMaterial) {
      return (
        <div className="lms-am-box">
          <div style={{ marginBottom: '16px' }}>
            {additionalMaterial.description && (
              <p className="lms-am-desc">{additionalMaterial.description}</p>
            )}
          </div>
          {additionalMaterial.linkUrl && additionalMaterial.linkTitle && (
            <a 
              href={additionalMaterial.linkUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="lms-am-link"
            >
              <FileText size={16} />
              <span>{additionalMaterial.linkTitle}</span>
            </a>
          )}
        </div>
      );
    }

    return null;
  }

  // ══════════════════════════════════
  // FOOTER
  // ══════════════════════════════════
  const allQuizAnswered = shuffledQuestions.length > 0 && shuffledQuestions.every((q) => answers[q.id]);

  const allRequiredSurveyAnswered = (() => {
    if (!surveyQuestions || surveyQuestions.length === 0) return true;
    return surveyQuestions
      .filter((sq) => sq.required !== false)
      .every((sq) => {
        const ans = surveyAnswers[sq.id];
        return ans !== undefined && ans !== "" && ans !== null;
      });
  })();

  function renderFooter() {
    if (screen === "quiz") {
      if (qzPassed) {
        // Sudah lulus — tampilkan tombol HIJAU
        return (
          <button
            className="lms-btn-green"
            onClick={hasSurvey ? showSurvey : (hasAdditionalMaterial ? saveProgressAndShowAdditional : proceedNext)}
          >
            {hasSurvey 
              ? "Isi Survei →" 
              : hasAdditionalMaterial
                ? "Materi Tambahan →"
                : isLastStep 
                  ? "Klaim Sertifikat" 
                  : "Materi Selanjutnya →"}
          </button>
        );
      }
      
      return (
        <button className="lms-btn-red" onClick={handleQuizCheck} disabled={!allQuizAnswered}>
          {qzFailed ? "Coba Lagi" : "Cek Jawaban"}
        </button>
      );
    }

    if (screen === "review") {
      return (
        <>
          <button className="lms-btn-dark" onClick={retry}>Kerjakan Ulang</button>
          <button
            className="lms-btn-red"
            onClick={hasSurvey ? showSurvey : (hasAdditionalMaterial ? saveProgressAndShowAdditional : proceedNext)}
            disabled={!passed}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {hasSurvey 
              ? "Isi Survei →" 
              : hasAdditionalMaterial
                ? "Materi Tambahan →"
                : isLastStep 
                  ? "Klaim Sertifikat" 
                  : "Materi Selanjutnya →"}
          </button>
        </>
      );
    }

    if (screen === "survey") {
      return (
        <button className="lms-btn-green" onClick={sendSurvey} disabled={!allRequiredSurveyAnswered}>
          {hasAdditionalMaterial
            ? "Kirim Jawaban"
            : isLastStep 
              ? "Kirim Jawaban dan Klaim Sertifikat"
              : "Kirim Jawaban"}
        </button>
      );
    }

    if (screen === "additional") {
      return (
        <button className="lms-btn-red" onClick={proceedNext}>
          {isLastStep 
            ? "Klaim Sertifikat"
            : "Materi Selanjutnya →"}
        </button>
      );
    }

    return null;
  }

  const noVideo = !youtubeId;
  const noRightPanel = !hasAssessment && !hasSurvey && !hasAdditionalMaterial;

  return (
    <div className={`lms-layout ${(noVideo || noRightPanel) ? "lms-layout--no-video" : ""}`}>
      <div className={noRightPanel ? "lms-left--full" : (noVideo ? undefined : "lms-left")} style={noRightPanel ? undefined : undefined}>
        {!noVideo && renderLeft()}
      </div>
      {!noRightPanel && (
        <div className={`lms-right ${noVideo ? "lms-right--full" : ""}`}>
          <div className="lms-s-head">
            <h2>{panelTitle()}</h2>
            {screen === "quiz" && hasAssessment && (
              <p className="lms-s-head-desc">
                {shuffledQuestions.length} soal singkat. Jawab benar semua untuk dapat sertifikat.
              </p>
            )}
            {screen === "survey" && (
              <p className="lms-s-head-desc">
                Terima kasih sudah menyelesaikan! Kasih kami feedback singkat di bawah.
              </p>
            )}
          </div>
          <div className="lms-s-scroll" ref={scrollRef}>
            {renderRight()}
          </div>
          <div className="lms-s-foot">
            {renderFooter()}
          </div>
        </div>
      )}
    </div>
  );
}
