"use client";

import { useEffect } from "react";
import styles from "./CourseMenuDrawer.module.css";
import StepNav, { StepNavItem } from "@/components/StepNav";

interface CourseMenuDrawerProps {
  open: boolean;
  onClose: () => void;
  steps: StepNavItem[];
  currentStep: number;
  courseName: string;
}

export default function CourseMenuDrawer({
  open,
  onClose,
  steps,
  currentStep,
  courseName,
}: CourseMenuDrawerProps) {
  // Close on Escape key
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll when open on mobile
  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    if (open && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ""}`}
        onClick={onClose}
      />
      <div className={`${styles.drawer} ${open ? styles.drawerOpen : ""}`}>
        <div className={styles.header}>
          <h2>Daftar Materi</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Tutup">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" stroke="currentColor">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={styles.content}>
          <StepNav steps={steps} currentStep={currentStep} courseName={courseName} />
        </div>
      </div>
    </>
  );
}
