"use client";

import { useState } from "react";
import type { AssessmentQuestion } from "@/lib/types";
import styles from "./Assessment.module.css";
import { CheckCircle2, XCircle } from "lucide-react";

interface AssessmentProps {
  questions: AssessmentQuestion[];
  kkm: number;
  onPass: (score: number) => void;
  disabled?: boolean; // sudah klaim sertifikat
  previousScore?: number | null;
  previousPassed?: boolean;
}

interface QuestionResult {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
}

export default function Assessment({
  questions,
  kkm,
  onPass,
  disabled = false,
  previousScore = null,
  previousPassed = false,
}: AssessmentProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(previousPassed);
  const [showHints, setShowHints] = useState<Record<string, boolean>>({});
  const [attempts, setAttempts] = useState(0);

  function handleSelect(questionId: string, optionId: string) {
    if (submitted && passed) return; // sudah lulus, terkunci
    if (disabled) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  function handleSubmit() {
    // Hitung hasil per soal
    const questionResults: QuestionResult[] = questions.map((q) => ({
      questionId: q.id,
      selectedAnswer: answers[q.id] || "",
      isCorrect: answers[q.id] === q.correctAnswer,
    }));

    const correctCount = questionResults.filter((r) => r.isCorrect).length;
    const calculatedScore = Math.round((correctCount / questions.length) * 100);

    setResults(questionResults);
    setScore(calculatedScore);
    setSubmitted(true);
    setAttempts((prev) => prev + 1);

    if (calculatedScore >= kkm) {
      setPassed(true);
      onPass(calculatedScore);
    }
  }

  function handleRetry() {
    setAnswers({});
    setSubmitted(false);
    setResults([]);
    setScore(0);
    setShowHints({});
  }

  function toggleHint(questionId: string) {
    setShowHints((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  }

  function getResult(questionId: string) {
    return results.find((r) => r.questionId === questionId);
  }

  const allAnswered = questions.every((q) => answers[q.id]);

  // Sudah pernah lulus sebelumnya (dari data enrollment)
  if (disabled && previousPassed) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <h3 className={styles.title}>📝 Assessment</h3>
          <div className={`${styles.scoreBadge} ${styles.scorePass}`}>
            Nilai: {previousScore} ✓
          </div>
        </div>
        <div className={styles.lockedMessage}>
          <span>🔒</span>
          <p>Assessment sudah selesai dan terkunci.</p>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.wrapper}>
      {/* KKM & Soal info strip */}
      <div className={styles.infoStrip}>
        <span className={styles.metaItem}>{questions.length} Soal</span>
        <span className={styles.metaItem}>KKM: {kkm}</span>
        {attempts > 0 && (
          <span className={styles.metaItem}>Percobaan: {attempts}x</span>
        )}
      </div>

      {/* Score Display (setelah submit) */}
      {submitted && (
        <div className={`${styles.scoreCard} ${passed ? styles.scoreCardPass : styles.scoreCardFail}`}>
          <div className={styles.scoreMain}>
            <span className={styles.scoreValue}>{score}</span>
            <span className={styles.scoreLabel}>/ 100</span>
          </div>
          <div className={styles.scoreInfo}>
            {passed ? (
              <>
                <span className={styles.scoreStatus}><CheckCircle2 size={16} style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} /> LULUS</span>
                <p>Selamat! Kamu sudah mencapai KKM. Klik Next untuk lanjut.</p>
              </>
            ) : (
              <>
                <span className={styles.scoreStatusFail}><XCircle size={16} style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} /> BELUM LULUS</span>
                <p>Nilai belum mencapai KKM ({kkm}). Lihat hint di bawah dan coba lagi!</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Questions */}
      <div className={styles.questionList}>
        {questions.map((question, idx) => {
          const result = getResult(question.id);
          const isCorrect = result?.isCorrect;
          const hasResult = !!result;

          return (
            <div
              key={question.id}
              className={`${styles.question} ${
                hasResult
                  ? isCorrect
                    ? styles.questionCorrect
                    : styles.questionWrong
                  : ""
              }`}
            >
              <div className={styles.questionHeader}>
                <span className={styles.questionNum}>
                  {hasResult ? (isCorrect ? <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} /> : <XCircle size={16} style={{ color: 'var(--color-error)' }} />) : `${idx + 1}.`}
                </span>
                <p className={styles.questionText}>{question.text}</p>
              </div>

              {/* Options */}
              <div className={styles.options}>
                {question.options.map((opt) => {
                  const isSelected = answers[question.id] === opt.id;
                  const isCorrectOpt = submitted && opt.id === question.correctAnswer;
                  const isWrongSelected = submitted && isSelected && !isCorrect;

                  return (
                    <button
                      key={opt.id}
                      className={`${styles.option} ${
                        isSelected ? styles.optionSelected : ""
                      } ${isCorrectOpt ? styles.optionCorrect : ""} ${
                        isWrongSelected ? styles.optionWrong : ""
                      }`}
                      onClick={() => handleSelect(question.id, opt.id)}
                      disabled={disabled || (submitted && passed)}
                    >
                      <span className={styles.optionMarker}>
                        {isCorrectOpt ? "✓" : isWrongSelected ? "✗" : opt.id.toUpperCase()}
                      </span>
                      <span className={styles.optionText}>{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Feedback (setelah submit) */}
              {hasResult && (
                <div className={`${styles.feedback} ${isCorrect ? styles.feedbackCorrect : styles.feedbackWrong}`}>
                  <p>
                    {isCorrect ? question.feedbackCorrect : question.feedbackWrong}
                  </p>
                </div>
              )}

              {/* Hint (hanya muncul jika salah) */}
              {hasResult && !isCorrect && (
                <div className={styles.hintSection}>
                  <button
                    className={styles.hintToggle}
                    onClick={() => toggleHint(question.id)}
                  >
                    💡 {showHints[question.id] ? "Sembunyikan Hint" : "Lihat Hint"}
                  </button>
                  {showHints[question.id] && (
                    <div className={styles.hintContent}>
                      <p>{question.hint}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className={styles.actions}>
        {!submitted ? (
          <button
            className="btn btn-primary btn-lg w-full"
            onClick={handleSubmit}
            disabled={!allAnswered || disabled}
          >
            Kirim Jawaban
          </button>
        ) : !passed ? (
          <button
            className="btn btn-primary btn-lg w-full"
            onClick={handleRetry}
          >
            🔄 Coba Lagi
          </button>
        ) : null}

        {!allAnswered && !submitted && (
          <p className={styles.hint}>
            Jawab semua {questions.length} soal untuk mengirim jawaban.
          </p>
        )}
      </div>
    </div>
  );
}
