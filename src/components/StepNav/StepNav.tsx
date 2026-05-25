"use client";

import Link from "next/link";
import { createSlug } from "@/lib/utils";

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
    <div className="sn-wrapper">
      <div className="sn-header">
        <h3 className="sn-course-name">{courseName}</h3>
        <div className="sn-progress-info">
          <span className="sn-progress-text">
            {completedCount}/{steps.length} selesai
          </span>
          <div className="sn-progress-bar">
            <div
              className="sn-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <nav className="sn-step-list">
        {steps.map((step) => {
          const isCurrent = step.stepNumber === currentStep;
          const isLocked = step.status === "locked";
          const isCompleted = step.status === "completed";

          return (
            <div key={step.stepNumber} className="sn-step-item">
              {isLocked ? (
                <div className="sn-step sn-step--locked">
                  <div className="sn-step-indicator">
                    <span className="sn-lock-icon">🔒</span>
                  </div>
                  <div className="sn-step-info">
                    <span className="sn-step-title">{step.title}</span>
                  </div>
                </div>
              ) : (
                <Link
                  href={`/learn/${createSlug(step.title)}`}
                  className={`sn-step ${
                    isCurrent ? "sn-step--active" : ""
                  } ${isCompleted ? "sn-step--completed" : ""}`}
                >
                  <div className="sn-step-indicator">
                    {isCompleted ? (
                      <span className="sn-check-icon">✓</span>
                    ) : (
                      <span className="sn-step-num">{step.stepNumber}</span>
                    )}
                  </div>
                  <div className="sn-step-info">
                    <span className="sn-step-title">{step.title}</span>
                    {step.hasAssessment && isCompleted && step.assessmentPassed && (
                      <span className="sn-assessment-badge">Lulus ✓</span>
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
