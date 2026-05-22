"use client";

import { useState } from "react";
import type { SurveyQuestion } from "@/lib/types";
import styles from "./Survey.module.css";

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
    // Cek wajib
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
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <h3 className={styles.title}>📋 Survei</h3>
        </div>
        <div className={styles.successMessage}>
          <span className={styles.successEmoji}>🙏</span>
          <h4>Terima Kasih!</h4>
          <p>Respons kamu sudah kami terima. Klik Next untuk lanjut.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h3 className={styles.title}>📋 Survei</h3>
        <span className={styles.metaItem}>
          {questions.length} Pertanyaan
        </span>
      </div>

      <div className={styles.questionList}>
        {questions.map((question, idx) => (
          <div key={question.id} className={styles.question}>
            <p className={styles.questionText}>
              <span className={styles.questionNum}>{idx + 1}.</span>
              {question.text}
              {question.required && <span className="required">*</span>}
            </p>

            {/* Star Rating */}
            {question.type === "starRating" && (
              <div className={styles.stars}>
                {Array.from({ length: question.maxStars || 5 }, (_, i) => i + 1).map(
                  (star) => (
                    <button
                      key={star}
                      className={`${styles.star} ${
                        (answers[question.id] as number) >= star
                          ? styles.starActive
                          : ""
                      }`}
                      onClick={() => handleChange(question.id, star)}
                      disabled={disabled}
                      type="button"
                    >
                      ★
                    </button>
                  )
                )}
                {answers[question.id] && (
                  <span className={styles.starLabel}>
                    {answers[question.id]} / {question.maxStars || 5}
                  </span>
                )}
              </div>
            )}

            {/* Scale (1-5 / 1-10) */}
            {question.type === "scale" && (
              <div className={styles.scaleRow}>
                {Array.from({ length: question.maxStars || 5 }, (_, i) => i + 1).map(
                  (num) => (
                    <button
                      key={num}
                      className={`${styles.scaleBtn} ${
                        answers[question.id] === num ? styles.scaleBtnActive : ""
                      }`}
                      onClick={() => handleChange(question.id, num)}
                      disabled={disabled}
                      type="button"
                    >
                      {num}
                    </button>
                  )
                )}
              </div>
            )}

            {/* Multiple Choice */}
            {question.type === "multipleChoice" && question.options && (
              <div className={styles.choices}>
                {question.options.map((opt) => (
                  <button
                    key={opt}
                    className={`${styles.choiceBtn} ${
                      answers[question.id] === opt ? styles.choiceBtnActive : ""
                    }`}
                    onClick={() => handleChange(question.id, opt)}
                    disabled={disabled}
                    type="button"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Short Text */}
            {question.type === "shortText" && (
              <textarea
                className={`form-textarea ${styles.textArea}`}
                placeholder="Tulis jawaban kamu..."
                value={(answers[question.id] as string) || ""}
                onChange={(e) => handleChange(question.id, e.target.value)}
                disabled={disabled}
                rows={3}
              />
            )}
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button
          className="btn btn-primary btn-lg w-full"
          onClick={handleSubmit}
          disabled={!allRequired || disabled}
        >
          Kirim Survei
        </button>
      </div>
    </div>
  );
}
