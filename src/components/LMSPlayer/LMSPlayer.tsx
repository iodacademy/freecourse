"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./LMSPlayer.module.css";
import { PartyPopper, GraduationCap } from "lucide-react";

// ─── Types ───────────────────────────────────────
export interface QuizQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
  feedbackCorrect: string;
  feedbackWrong: string;
  explanation?: string;
}

export interface SurveyQuestion {
  id: string;
  type: "shortText" | "multipleChoice" | "scale" | "starRating";
  text: string;
  options?: string[];
  required?: boolean;
  minLabel?: string;
  maxLabel?: string;
}

export type LMSScreen = "quiz" | "review" | "survey";

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
  onProceedToNext?: (results?: { assessment?: any; survey?: any; }) => void;
  // ── URL routing ──
  stepId: string;                   // unique key for sessionStorage, e.g. "step-2"
  initialScreen?: LMSScreen;
  initialQIdx?: number;
  initialRevIdx?: number;
  initialSurvSec?: number;
  onStateChange?: (screen: LMSScreen, qIdx: number, revIdx: number, survSec: number) => void;
  initialAnswers?: Record<string, string>;
  initialSurveyAnswers?: Record<string, any>;
}

// ─── Sub-renders ─────────────────────────────────

function VideoEmbed({ youtubeId }: { youtubeId: string }) {
  return (
    <div className={styles.player}>
      <div className={styles.playerInner}>
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`}
          title="Video Pembelajaran"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className={styles.playerIframe}
        />
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
    <div className={styles.donutWrap}>
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
  initialScreen,
  initialQIdx = 0,
  initialRevIdx = 0,
  initialSurvSec = 0,
  onStateChange,
  initialAnswers = {},
  initialSurveyAnswers = {},
}: LMSPlayerProps) {
  const hasAssessment = questions.length > 0;
  const hasSurvey = surveyEnabled && surveyQuestions.length > 0;

  // Determine starting screen based on what's available
  const defaultScreen: LMSScreen = hasAssessment ? "quiz" : hasSurvey ? "survey" : "quiz";
  const [screen, setScreen] = useState<LMSScreen>(initialScreen || defaultScreen);
  const [qIdx, setQIdx] = useState(initialQIdx);
  const [revIdx, setRevIdx] = useState(initialRevIdx);
  const [survSec, setSurvSec] = useState(initialSurvSec);

  // Survey answers stored by question id
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, any>>(initialSurveyAnswers);

  const scrollRef = useRef<HTMLDivElement>(null);

  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);

  // Sync initial props to state when they arrive/change
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

  // ── Scroll right panel to top on relevant changes ──
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [screen, qIdx, revIdx, survSec]);

  const currentQ = questions[qIdx];
  const isFirstQ = qIdx === 0;
  const isLastQ = qIdx === questions.length - 1;

  const currentSurv = surveyQuestions?.[survSec];
  const isLastSurv = surveyQuestions && survSec === surveyQuestions.length - 1;

  // ── Score calc ──
  const correctCount = questions.filter((q) => answers[q.id] === q.correctAnswer).length;
  const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const passed = score >= kkm;

  // ── State-change helper — updates state AND notifies parent for URL sync ──
  function nav(s: LMSScreen, q = qIdx, r = revIdx, sec = survSec) {
    onStateChange?.(s, q, r, sec);
  }

  // ── Quiz actions ──
  function pickAnswer(optId: string) {
    if (!currentQ) return;
    setAnswers((prev) => ({ ...prev, [currentQ.id]: optId }));
  }

  function goNext() {
    if (!isLastQ) {
      const next = qIdx + 1;
      setQIdx(next);
      nav("quiz", next, revIdx, survSec);
    }
  }

  function goPrev() {
    if (!isFirstQ) {
      const prev = qIdx - 1;
      setQIdx(prev);
      nav("quiz", prev, revIdx, survSec);
    }
  }

  function submitQuiz() {
    if (passed) onPass?.(score);
    setRevIdx(0);
    setScreen("review");
    nav("review", qIdx, 0, survSec);
  }

  function retry() {
    setAnswers({});
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

  function changeSurvSec(i: number) {
    setSurvSec(i);
    nav("survey", qIdx, revIdx, i);
  }

  function sendSurvey() {
    proceedNext();
  }

  function proceedNext() {
    const assessmentData = hasAssessment ? { score, passed, answers } : undefined;
    const surveyData = hasSurvey ? surveyAnswers : undefined;
    onProceedToNext?.({ assessment: assessmentData, survey: surveyData });
  }

  // ══════════════════════════════════
  // LEFT COLUMN
  // ══════════════════════════════════
  // ── Min correct answers calc ──
  const minCorrect = Math.ceil((kkm / 100) * questions.length);

  function renderLeft() {
    // Quiz, Survey, Review: always show video
    if (screen === "quiz" || screen === "survey" || screen === "review") {
      return (
        <>
          <div className={styles.videoLabel}>Selamat Menonton Video!</div>
          <VideoEmbed youtubeId={youtubeId} />
        </>
      );
    }

    return null;
  }

  // ══════════════════════════════════
  // RIGHT PANEL — title
  // ══════════════════════════════════
  function panelTitle() {
    if (screen === "survey") return "SURVEY";
    if (screen === "quiz" || screen === "review") return "UJI PEMAHAMAN";
    // Fallback based on what's available
    if (hasSurvey && !hasAssessment) return "SURVEY";
    return "UJI PEMAHAMAN";
  }

  // ══════════════════════════════════
  // RIGHT PANEL — scroll content
  // ══════════════════════════════════
  function renderRight() {
    // ── QUIZ: ALL questions, no blue box ──
    if (screen === "quiz") {
      return (
        <>
          {questions.map((q, i) => {
            const sel = answers[q.id];
            return (
              <div key={q.id} className={styles.quizBlock}>
                <div className={styles.qNum}>Soal {i + 1} dari {questions.length}</div>
                <div className={styles.qText}>{q.text}</div>
                <div className={styles.optionList}>
                  {q.options.map((opt) => (
                    <div
                      key={opt.id}
                      className={`${styles.option} ${sel === opt.id ? styles.optSel : ""}`}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                    >
                      <div className={`${styles.optBadge} ${sel === opt.id ? styles.optBadgeSel : ""}`}>
                        {opt.id.toUpperCase()}
                      </div>
                      <div className={styles.optText}>{opt.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      );
    }

    // ── REVIEW: donut + stats + ALL feedback scrollable ──
    if (screen === "review") {
      return (
        <>
          <DonutChart score={score} pass={passed} />

          <div className={styles.statGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLbl}>Jawaban Benar</div>
              <div className={`${styles.statVal} ${styles.statGreen}`}>{correctCount} Soal</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLbl}>Status (KKM {kkm})</div>
              <div className={`${styles.statVal} ${passed ? styles.statGreen : styles.statRed}`}>
                {passed ? "LULUS ✓" : "TIDAK LULUS"}
              </div>
            </div>
          </div>

          <div className={styles.navDivider}>Review Semua Soal</div>

          {questions.map((q, i) => {
            const ua = answers[q.id];
            const isRight = ua === q.correctAnswer;
            const chosenOpt = q.options.find((o) => o.id === ua);
            return (
              <div key={q.id} className={styles.reviewCard} style={{ marginTop: i === 0 ? 0 : 12 }}>
                <div className={styles.reviewTag}>SOAL {i + 1}</div>
                <div className={styles.reviewQ}>{q.text}</div>
                <div className={`${styles.ansBox} ${isRight ? styles.ansOk : styles.ansErr}`}>
                  Jawaban Kamu: {ua ? `${ua.toUpperCase()}. ${chosenOpt?.text ?? ""}` : "— Tidak dijawab"}
                </div>
                <div className={styles.fbBox}>
                  <div className={`${styles.fbTitle} ${isRight ? styles.fbOk : styles.fbErr}`}>
                    Feedback &amp; Review Materi
                  </div>
                  <div className={styles.fbBody}>{isRight ? q.feedbackCorrect : q.feedbackWrong}</div>
                  <div className={styles.fbKey}>Kunci Jawaban: {q.correctAnswer.toUpperCase()}</div>
                  {q.explanation && <div className={styles.fbExp}>{q.explanation}</div>}
                </div>
              </div>
            );
          })}
        </>
      );
    }

    // ── SURVEY: ALL questions, no card box ──
    if (screen === "survey") {
      if (!surveyQuestions || surveyQuestions.length === 0) {
        return (
          <div className={styles.survQ}>Survei tidak tersedia.</div>
        );
      }
      return (
        <>
          {surveyQuestions.map((sq, i) => {
            const survAns = surveyAnswers[sq.id] || "";
            return (
              <div key={sq.id || i} className={styles.quizBlock}>
                <div className={styles.survTag}>PERTANYAAN {i + 1} / {surveyQuestions.length}</div>
                <div className={styles.survQ}>{sq.text}</div>

                {sq.type === "shortText" && (
                  <textarea
                    className={styles.survTextarea}
                    placeholder="Tuliskan jawaban kamu di sini..."
                    value={survAns}
                    onChange={(e) => setSurveyAnswers(p => ({ ...p, [sq.id]: e.target.value }))}
                  />
                )}

                {sq.type === "multipleChoice" && (
                  <div className={styles.optionList}>
                    {(sq.options || []).map((opt, j) => (
                      <div
                        key={j}
                        className={`${styles.option} ${survAns === opt ? styles.optSel : ""}`}
                        onClick={() => setSurveyAnswers(p => ({ ...p, [sq.id]: opt }))}
                      >
                        <div className={`${styles.optBadge} ${survAns === opt ? styles.optBadgeSel : ""}`}>
                          {String.fromCharCode(65 + j)}
                        </div>
                        <div className={styles.optText}>{opt}</div>
                      </div>
                    ))}
                  </div>
                )}

                {sq.type === "scale" && (
                  <div>
                    <div className={styles.emojiRow}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          className={`${styles.emBtn} ${survAns === n ? styles.emPicked : ""}`}
                          onClick={() => setSurveyAnswers(p => ({ ...p, [sq.id]: n }))}
                          style={{ width: '40px', height: '40px', fontSize: '14px' }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    {(sq.minLabel || sq.maxLabel) && (
                      <div className={styles.scaleLabels}>
                        <span>{sq.minLabel}</span>
                        <span>{sq.maxLabel}</span>
                      </div>
                    )}
                  </div>
                )}

                {sq.type === "starRating" && (
                  <div>
                    <div className={styles.stars}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          className={styles.starBtn}
                          onClick={() => setSurveyAnswers(p => ({ ...p, [sq.id]: n }))}
                          style={{ color: n <= (survAns as number || 0) ? "#F59E0B" : "#E5E5E5" }}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    {(sq.minLabel || sq.maxLabel) && (
                      <div className={styles.scaleLabels}>
                        <span>{sq.minLabel}</span>
                        <span>{sq.maxLabel}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      );
    }

    return null;
  }

  // ══════════════════════════════════
  // FOOTER
  // ══════════════════════════════════
  const allQuizAnswered = questions.length > 0 && questions.every((q) => answers[q.id]);

  // Survey: hanya cek pertanyaan yang required
  const allRequiredSurveyAnswered = (() => {
    if (!surveyQuestions || surveyQuestions.length === 0) return true;
    return surveyQuestions
      .filter((sq) => sq.required !== false) // default required = true
      .every((sq) => {
        const ans = surveyAnswers[sq.id];
        return ans !== undefined && ans !== "" && ans !== null;
      });
  })();

  function renderFooter() {
    if (screen === "quiz") {
      return (
        <button className={styles.btnRed} onClick={submitQuiz} disabled={!allQuizAnswered}>
          Kirim Jawaban
        </button>
      );
    }

    if (screen === "review") {
      return (
        <>
          <button className={styles.btnDark} onClick={retry}>Kerjakan Ulang</button>
          <button
            className={styles.btnRed}
            onClick={hasSurvey ? showSurvey : proceedNext}
            disabled={!passed}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {hasSurvey 
              ? "Isi Survei →" 
              : isLastStep 
                ? "Klaim Sertifikat" 
                : "Materi Selanjutnya →"}
          </button>
        </>
      );
    }

    if (screen === "survey") {
      return (
        <button className={styles.btnRed} onClick={sendSurvey} disabled={!allRequiredSurveyAnswered}>
          {isLastStep 
            ? "Kirim Survey dan Klaim Sertifikat"
            : "Kirim Survey & Lanjutkan →"}
        </button>
      );
    }

    return null;
  }

  const noVideo = !youtubeId;
  const noRightPanel = !hasAssessment && !hasSurvey;

  return (
    <div className={`${styles.layout} ${(noVideo || noRightPanel) ? styles.layoutNoVideo : ""}`}>
      <div className={noRightPanel ? styles.leftColFull : (noVideo ? undefined : styles.leftCol)} style={noRightPanel ? undefined : undefined}>
        {!noVideo && renderLeft()}
      </div>
      {!noRightPanel && (
        <div className={`${styles.rightCol} ${noVideo ? styles.rightColFull : ""}`}>
          <div className={styles.sHead}>
            <h2>{panelTitle()}</h2>
            {screen === "quiz" && hasAssessment && (
              <p className={styles.sHeadDesc}>
                Anda harus benar minimal <strong>{minCorrect} soal</strong> untuk bisa dapat sertifikat!
              </p>
            )}
            {screen === "survey" && (
              <p className={styles.sHeadDesc}>
                Setelah mengisi survey, Anda akan mendapatkan sertifikat.
              </p>
            )}
          </div>
          <div className={styles.sScroll} ref={scrollRef}>
            {renderRight()}
          </div>
          <div className={styles.sFoot}>
            {renderFooter()}
          </div>
        </div>
      )}
    </div>
  );
}
