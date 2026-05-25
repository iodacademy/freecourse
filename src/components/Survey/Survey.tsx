"use client";

import { useState } from "react";
import type { SurveyQuestion } from "@/lib/types";
import { CheckCircle2, Star } from "lucide-react";

interface SurveyProps {
  questions: SurveyQuestion[];
  onSubmit: (answers: Record<string, string | number>) => void;
  disabled?: boolean;
  alreadySubmitted?: boolean;
}

export default function Survey({
  questions,
  onSubmit,
  disabled = false,
  alreadySubmitted = false,
}: SurveyProps) {
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitted, setSubmitted] = useState(alreadySubmitted);

  function handleChange(questionId: string, value: string | number) {
    if (submitted || disabled) return;
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function handleSubmit() {
    const missing = questions.filter(
      (q) => q.required && (answers[q.id] === undefined || answers[q.id] === "")
    );
    if (missing.length > 0) return;
    onSubmit(answers);
    setSubmitted(true);
  }

  const allRequired = questions
    .filter((q) => q.required)
    .every((q) => answers[q.id] !== undefined && answers[q.id] !== "");

  if (submitted) {
    return (
      <div className="sv-wrap">
        <div className="sv-success">
          <CheckCircle2 size={48} />
          <h4>Terima Kasih!</h4>
          <p>Tanggapan survei kamu telah disimpan.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-wrap">
      {questions.map((question, idx) => (
        <div key={question.id} className="sv-question">
          <div className="sv-label">
            {question.text}
            {question.required ? (
              <span className="yr-req">*</span>
            ) : (
              <span className="sv-optional">opsional</span>
            )}
          </div>

          {/* ── Star Rating (REDESIGN) ── */}
          {question.type === "starRating" && (
            <>
              <div className="sv-rating">
                <div className="sv-rating-scale">
                  <span>1 — Kurang Bagus</span>
                  <span>{question.maxStars || 5} — Sangat Bagus</span>
                </div>
                <div className="sv-rating-stars">
                  {Array.from({ length: question.maxStars || 5 }, (_, i) => i + 1).map(
                    (n) => (
                      <button
                        key={n}
                        type="button"
                        className={`sv-star ${
                          (answers[question.id] as number) >= n ? "sv-star--on" : ""
                        }`}
                        onClick={() => handleChange(question.id, n)}
                        disabled={disabled}
                        aria-label={`${n} bintang`}
                      >
                        <span className="sv-star-num">{n}</span>
                        <Star size={22} />
                      </button>
                    )
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Scale (1-5 / 1-10) ── */}
          {question.type === "scale" && (
            <div className="sv-scale-row">
              {Array.from({ length: question.maxStars || 5 }, (_, i) => i + 1).map(
                (num) => (
                  <button
                    key={num}
                    type="button"
                    className={`sv-scale-btn ${
                      answers[question.id] === num ? "sv-scale-btn--active" : ""
                    }`}
                    onClick={() => handleChange(question.id, num)}
                    disabled={disabled}
                  >
                    {num}
                  </button>
                )
              )}
            </div>
          )}

          {/* ── Multiple Choice ── */}
          {question.type === "multipleChoice" && question.options && (
            <div className="sv-choices">
              {question.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`sv-choice-btn ${
                    answers[question.id] === opt ? "sv-choice-btn--active" : ""
                  }`}
                  onClick={() => handleChange(question.id, opt)}
                  disabled={disabled}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* ── Short Text / Textarea ── */}
          {question.type === "shortText" && (
            <>
              <textarea
                className="sv-textarea"
                placeholder="cth. Materinya jelas, contohnya relate, tapi pengen lebih banyak studi kasus…"
                value={(answers[question.id] as string) || ""}
                onChange={(e) => handleChange(question.id, e.target.value)}
                disabled={disabled}
                rows={4}
                maxLength={300}
              />
              <div className="sv-char-count">
                {((answers[question.id] as string) || "").length} / 300
              </div>
            </>
          )}
        </div>
      ))}

      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          className="step-next-btn"
          onClick={handleSubmit}
          disabled={!allRequired || disabled}
        >
          Kirim Survei
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
