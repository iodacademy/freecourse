"use client";

import { useMemo, useState } from "react";
import type { AssessmentQuestion } from "@/lib/types";
import { Check, X } from "lucide-react";

interface AssessmentProps {
  questions: AssessmentQuestion[];
  kkm: number;
  onPass: (score: number, answers: Record<string, string>) => void;
  disabled?: boolean;
  previousScore?: number | null;
  previousPassed?: boolean;
  initialAnswers?: Record<string, string>;
}

// ── Seeded shuffle (Fisher-Yates) — consistent per session ──
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

export default function Assessment({
  questions,
  kkm,
  onPass,
  disabled = false,
  previousScore = null,
  previousPassed = false,
  initialAnswers = {},
}: AssessmentProps) {
  // ── Randomize soal & opsi sekali saat mount ──
  const sessionSeed = useMemo(() => Math.floor(Math.random() * 1000000), []);

  const shuffledQuestions = useMemo(() => {
    const shuffledQ = seededShuffle(questions, sessionSeed);
    return shuffledQ.map((q, i) => ({
      ...q,
      _originalIdx: questions.indexOf(q),
      options: seededShuffle(q.options, sessionSeed + i + 1),
    }));
  }, [questions, sessionSeed]);

  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {});
  
  const [results, setResults] = useState<Record<string, "correct" | "wrong">>(() => {
    if (disabled && previousPassed && initialAnswers && Object.keys(initialAnswers).length > 0) {
      const initResults: Record<string, "correct" | "wrong"> = {};
      for (const q of questions) {
        if (initialAnswers[q.id]) {
          initResults[q.id] = initialAnswers[q.id] === q.correctAnswer ? "correct" : "wrong";
        }
      }
      return initResults;
    }
    return {};
  });

  const [submitted, setSubmitted] = useState(disabled && previousPassed);

  const correctCount = Object.values(results).filter(r => r === "correct").length;
  
  let currentScore = 0;
  shuffledQuestions.forEach(q => {
    if (results[q.id] === "correct") {
      currentScore += q.points !== undefined ? q.points : (100 / shuffledQuestions.length);
    }
  });

  const allAnswered = shuffledQuestions.every(q => answers[q.id]);
  const passed = submitted && currentScore >= kkm;
  const failed = submitted && currentScore < kkm;

  function handlePick(qid: string, oid: string) {
    if (results[qid] === "correct") return; // locked
    if (disabled) return;
    setAnswers(a => ({ ...a, [qid]: oid }));
    // Clear previous wrong result if user re-picks
    if (results[qid] === "wrong") {
      setResults(r => { const x = { ...r }; delete x[qid]; return x; });
    }
  }

  function handleCheck() {
    const newResults = { ...results };
    let newScore = 0;
    
    for (const q of shuffledQuestions) {
      if (newResults[q.id] !== "correct") {
        newResults[q.id] = answers[q.id] === q.correctAnswer ? "correct" : "wrong";
      }
      if (newResults[q.id] === "correct") {
        newScore += q.points !== undefined ? q.points : (100 / shuffledQuestions.length);
      }
    }
    
    setResults(newResults);
    setSubmitted(true);

    if (newScore >= kkm) {
      onPass(newScore, answers);
    }
  }



  return (
    <div className="qz-wrap">
      {/* ── Score + Pellets ── */}
      <div className="qz-score">
        <span>Skor sementara <b>{currentScore}</b> (KKM: {kkm})</span>
        <span className="qz-pellets">
          {shuffledQuestions.map(q => (
            <span
              key={q.id}
              className={`qz-pellet ${
                results[q.id] === "correct" ? "qz-pellet--correct" :
                results[q.id] === "wrong" ? "qz-pellet--wrong" : ""
              }`}
            />
          ))}
        </span>
      </div>

      {/* ── Banner pass / fail ── */}
      {submitted && (
        <div className={`qz-banner ${passed ? "qz-banner--pass" : "qz-banner--fail"}`}>
          <span className="qz-banner-icon">
            {passed ? <Check size={14} /> : <X size={14} />}
          </span>
          <div>
            {passed ? (
              <><b>Skor kamu {currentScore}.</b> Mantap. Siap lanjut ke materi berikutnya.</>
            ) : (
              <>
                <b>Skor kamu {currentScore} (KKM: {kkm}).</b> Pilih jawaban baru di soal merah
                <span className="qb-arrow">↓</span> lalu klik <b>Cek Jawaban Lagi</b>.
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Cards per soal ── */}
      {shuffledQuestions.map((q, idx) => {
        const r = results[q.id];
        const cardClass = `qz-item ${
          r === "correct" ? "qz-item--correct" :
          r === "wrong" ? "qz-item--wrong" : ""
        }`;

        return (
          <div key={q.id}>
            {idx > 0 && <hr className="qz-separator" />}
            <div className={cardClass}>
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
                    disabled={locked || disabled}
                    onClick={() => handlePick(q.id, o.id)}
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
          </div>
        );
      })}

      {/* ── Action Button ── */}
      {!disabled && !passed && (
        <div className="qz-action" style={{ marginTop: "24px" }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={!allAnswered}
            onClick={handleCheck}
          >
            {submitted && failed ? "Cek Jawaban Lagi" : "Cek Jawaban"}
          </button>
        </div>
      )}
    </div>
  );
}
