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

export type LMSScreen = "quiz" | "review" | "survey" | "done";

export interface LMSPlayerProps {
  youtubeId: string;
  questions: QuizQuestion[];
  kkm: number;
  surveyEnabled?: boolean;
  onPass?: (score: number) => void;
  onComplete?: () => void;
  stepNumber?: number;
  totalSteps?: number;
  stepTitle?: string;
  isLastStep?: boolean;
  onProceedToNext?: () => void;
  // ── URL routing ──
  stepId: string;                   // unique key for sessionStorage, e.g. "step-2"
  initialScreen?: LMSScreen;
  initialQIdx?: number;
  initialRevIdx?: number;
  initialSurvSec?: number;
  onStateChange?: (screen: LMSScreen, qIdx: number, revIdx: number, survSec: number) => void;
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
  onPass,
  onComplete,
  isLastStep,
  onProceedToNext,
  stepId,
  initialScreen = "quiz",
  initialQIdx = 0,
  initialRevIdx = 0,
  initialSurvSec = 0,
  onStateChange,
}: LMSPlayerProps) {
  const [screen, setScreen] = useState<LMSScreen>(initialScreen);
  const [qIdx, setQIdx] = useState(initialQIdx);
  const [revIdx, setRevIdx] = useState(initialRevIdx);
  const [survSec, setSurvSec] = useState(initialSurvSec);
  const [stars, setStars] = useState(0);
  const [emoji, setEmoji] = useState<number | null>(null);
  const [t1, setT1] = useState("");
  const [t2, setT2] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Load answers from sessionStorage (persists across refresh) ──
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(`lms-answers-${stepId}`);
        if (raw) return JSON.parse(raw) as Record<string, string>;
      } catch {}
    }
    return {};
  });

  // ── Save answers whenever they change ──
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(`lms-answers-${stepId}`, JSON.stringify(answers));
      } catch {}
    }
  }, [answers, stepId]);

  // ── Scroll right panel to top on relevant changes ──
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [screen, qIdx, revIdx, survSec]);

  const currentQ = questions[qIdx];
  const isFirstQ = qIdx === 0;
  const isLastQ = qIdx === questions.length - 1;

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
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(`lms-answers-${stepId}`);
    }
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
    setScreen("done");
    nav("done", qIdx, revIdx, survSec);
    onComplete?.();
  }

  function proceedNext() {
    onProceedToNext?.();
  }

  // ══════════════════════════════════
  // LEFT COLUMN
  // ══════════════════════════════════
  function renderLeft() {
    if (screen === "quiz") {
      return <VideoEmbed youtubeId={youtubeId} />;
    }

    if (screen === "review") {
      const q = questions[revIdx];
      if (!q) return null;
      const ua = answers[q.id];
      const right = ua === q.correctAnswer;
      const chosenOpt = q.options.find((o) => o.id === ua);
      return (
        <div className={styles.reviewCard}>
          <div className={styles.reviewTag}>REVIEW JAWABAN</div>
          <div className={styles.reviewQ}>{q.text}</div>
          <div className={`${styles.ansBox} ${right ? styles.ansOk : styles.ansErr}`}>
            Jawaban Kamu: {ua ? `${ua.toUpperCase()}. ${chosenOpt?.text ?? ""}` : "— Tidak dijawab"}
          </div>
          <div className={styles.fbBox}>
            <div className={`${styles.fbTitle} ${right ? styles.fbOk : styles.fbErr}`}>
              Feedback &amp; Review Materi
            </div>
            <div className={styles.fbBody}>{right ? q.feedbackCorrect : q.feedbackWrong}</div>
            <div className={styles.fbKey}>Kunci Jawaban: {q.correctAnswer.toUpperCase()}</div>
            {q.explanation && <div className={styles.fbExp}>{q.explanation}</div>}
          </div>
        </div>
      );
    }

    if (screen === "survey") {
      if (survSec === 0) {
        return (
          <div className={styles.surveyCard}>
            <div className={styles.survTag}>KEPUASAN PENGGUNA</div>
            <div className={styles.survQ}>Seberapa puas kamu dengan materi pembelajaran ini? Berikan rating bintang kamu.</div>
            <div className={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={styles.starBtn} onClick={() => setStars(n)} style={{ color: n <= stars ? "#F59E0B" : "#E5E5E5" }}>★</button>
              ))}
            </div>
            <div className={styles.emojiLbl}>Pilih ekspresi yang paling menggambarkan perasaan kamu:</div>
            <div className={styles.emojiRow}>
              {["😍", "😊", "😐", "😢"].map((e, i) => (
                <button key={i} className={`${styles.emBtn} ${emoji === i ? styles.emPicked : ""}`} onClick={() => setEmoji(i)}>{e}</button>
              ))}
            </div>
          </div>
        );
      }
      if (survSec === 1) {
        return (
          <div className={styles.surveyCard}>
            <div className={styles.survTag}>KESAN &amp; PESAN</div>
            <div className={styles.survQ}>Apa kesan dan pesan kamu setelah mengikuti materi ini?</div>
            <textarea className={styles.survTextarea} placeholder="Tuliskan kesan dan pesan kamu di sini..." value={t1} onChange={(e) => setT1(e.target.value)} />
          </div>
        );
      }
      return (
        <div className={styles.surveyCard}>
          <div className={styles.survTag}>SARAN</div>
          <div className={styles.survQ}>Adakah saran untuk perbaikan materi atau penyampaian ke depannya?</div>
          <textarea className={styles.survTextarea} placeholder="Tuliskan saran kamu di sini..." value={t2} onChange={(e) => setT2(e.target.value)} />
        </div>
      );
    }

    if (screen === "done") {
      return (
        <div className={styles.doneScreen}>
          <div className={styles.doneEmoji}><PartyPopper size={48} style={{ color: 'var(--color-primary)', margin: '0 auto' }} /></div>
          <h3>Modul Selesai</h3>
          <div className={styles.doneName}>Terima Kasih!</div>
          <div className={styles.doneDesc}>
            Survei kamu telah berhasil dikirim.<br />
            Semoga pembelajaran ini bermanfaat dan dapat diterapkan dalam kehidupan sehari-hari.
          </div>
        </div>
      );
    }

    return null;
  }

  // ══════════════════════════════════
  // RIGHT PANEL — title
  // ══════════════════════════════════
  function panelTitle() {
    if (screen === "survey" || screen === "done") return "SURVEI";
    return "POST-TEST";
  }

  // ══════════════════════════════════
  // RIGHT PANEL — scroll content
  // ══════════════════════════════════
  function renderRight() {
    // ── QUIZ ──
    if (screen === "quiz") {
      if (!currentQ) return null;
      const sel = answers[currentQ.id];
      return (
        <>
          <div className={styles.qCard}>
            <div className={styles.qNum}>Soal {qIdx + 1} dari {questions.length}</div>
            <div className={styles.qText}>{currentQ.text}</div>
          </div>
          <div className={styles.optionList}>
            {currentQ.options.map((opt) => (
              <div
                key={opt.id}
                className={`${styles.option} ${sel === opt.id ? styles.optSel : ""}`}
                onClick={() => pickAnswer(opt.id)}
              >
                <div className={`${styles.optBadge} ${sel === opt.id ? styles.optBadgeSel : ""}`}>
                  {opt.id.toUpperCase()}
                </div>
                <div className={styles.optText}>{opt.text}</div>
              </div>
            ))}
          </div>
        </>
      );
    }

    // ── REVIEW: donut + stats + soal nav ──
    if (screen === "review") {
      return (
        <>
          <DonutChart score={score} pass={passed} />

          {/* Compact 2-col stat grid */}
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

          {/* Compact numbered soal squares */}
          <div className={styles.navDivider}>Review per Soal</div>
          <div className={styles.soalGrid}>
            {questions.map((q, i) => (
              <div
                key={q.id}
                className={`${styles.soalSquare} ${i === revIdx ? styles.soalSquareActive : styles.soalSquareInactive}`}
                onClick={() => jumpRev(i)}
                title={`Soal ${i + 1}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </>
      );
    }

    // ── SURVEY: tab nav (same visual as soal nav) ──
    if (screen === "survey" || screen === "done") {
      const sections = ["Rating", "Kesan Pesan", "Saran"];
      return (
        <>
          <div className={styles.navDivider}>Bagian Survei</div>
          {sections.map((s, i) => (
            <div
              key={i}
              className={`${styles.navItem} ${survSec === i && screen === "survey" ? styles.navActive : styles.navInactive}`}
              onClick={() => screen === "survey" && changeSurvSec(i)}
              style={{ cursor: screen === "done" ? "default" : "pointer" }}
            >
              {screen === "done" ? "✓ " : ""}{s}
            </div>
          ))}
          {screen === "done" && (
            <div className={styles.doneNote}>
              Semua bagian survei telah selesai.
            </div>
          )}
        </>
      );
    }

    return null;
  }

  // ══════════════════════════════════
  // FOOTER
  // ══════════════════════════════════
  function renderFooter() {
    if (screen === "quiz") {
      return (
        <>
          {!isFirstQ && (
            <button className={styles.btnDark} onClick={goPrev}>← Soal Sblm.</button>
          )}
          {isLastQ ? (
            <button className={styles.btnRed} onClick={submitQuiz}>Kirim Jawaban</button>
          ) : (
            <button className={styles.btnRed} onClick={goNext}>Soal Slnjt. →</button>
          )}
        </>
      );
    }

    if (screen === "review") {
      return (
        <>
          <button className={styles.btnDark} onClick={retry}>Kerjakan Ulang</button>
          <button
            className={styles.btnRed}
            onClick={surveyEnabled ? showSurvey : proceedNext}
            disabled={!passed}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isLastStep && !surveyEnabled ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><GraduationCap size={16} /> Klaim Sertifikat</span> : "Materi Selanjutnya →"}
          </button>
        </>
      );
    }

    if (screen === "survey") {
      return (
        <button className={styles.btnRed} onClick={sendSurvey}>Kirim Survei</button>
      );
    }

    if (screen === "done") {
      return (
        <button className={styles.btnRed} onClick={proceedNext} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isLastStep ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><GraduationCap size={16} /> Klaim Sertifikat</span> : "Materi Selanjutnya →"}
        </button>
      );
    }

    return null;
  }

  return (
    <div className={styles.layout}>
      <div className={styles.leftCol}>
        {renderLeft()}
      </div>
      <div className={styles.rightCol}>
        <div className={styles.sHead}>
          <h2>{panelTitle()}</h2>
        </div>
        <div className={styles.sScroll} ref={scrollRef}>
          {renderRight()}
        </div>
        <div className={styles.sFoot}>
          {renderFooter()}
        </div>
      </div>
    </div>
  );
}
