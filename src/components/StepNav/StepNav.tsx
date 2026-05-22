"use client";

import Link from "next/link";
import styles from "./StepNav.module.css";

export interface StepNavItem {
  stepNumber: number;
  title: string;
  status: "locked" | "current" | "completed";
  hasAssessment: boolean;
  assessmentPassed?: boolean;
}

interface StepNavProps {
  steps: StepNavItem[];
  currentStep: number;
  courseName: string;
}

export default function StepNav({ steps, currentStep, courseName }: StepNavProps) {
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h3 className={styles.courseName}>{courseName}</h3>
        <div className={styles.progressInfo}>
          <span className={styles.progressText}>
            {completedCount}/{steps.length} selesai
          </span>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <nav className={styles.stepList}>
        {steps.map((step) => {
          const isCurrent = step.stepNumber === currentStep;
          const isLocked = step.status === "locked";
          const isCompleted = step.status === "completed";

          return (
            <div key={step.stepNumber} className={styles.stepItem}>
              {isLocked ? (
                <div className={`${styles.step} ${styles.stepLocked}`}>
                  <div className={styles.stepIndicator}>
                    <span className={styles.lockIcon}>🔒</span>
                  </div>
                  <div className={styles.stepInfo}>
                    <span className={styles.stepTitle}>{step.title}</span>
                  </div>
                </div>
              ) : (
                <Link
                  href={`/learn/${step.stepNumber}`}
                  className={`${styles.step} ${
                    isCurrent ? styles.stepActive : ""
                  } ${isCompleted ? styles.stepCompleted : ""}`}
                >
                  <div className={styles.stepIndicator}>
                    {isCompleted ? (
                      <span className={styles.checkIcon}>✓</span>
                    ) : (
                      <span className={styles.stepNum}>{step.stepNumber}</span>
                    )}
                  </div>
                  <div className={styles.stepInfo}>
                    <span className={styles.stepTitle}>{step.title}</span>
                    {step.hasAssessment && isCompleted && step.assessmentPassed && (
                      <span className={styles.assessmentBadge}>Lulus ✓</span>
                    )}
                  </div>
                </Link>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
