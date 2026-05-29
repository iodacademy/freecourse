"use client";

import { ReactNode } from "react";
import { fmtIntID, pctOf } from "@/lib/format-helpers";
import styles from "./dashboard.module.css";

interface Props {
  label: string;
  value: number;
  completed?: number;
  target: number;
  icon: ReactNode;
  variant?: "ink" | "red";
  clickable?: boolean;
  active?: boolean;
  onClick?: () => void;
  subLabel?: string;
}

export default function KpiCard({
  label, value, completed, target, icon, variant = "red",
  clickable = false, active = false, onClick, subLabel = "Total Pendaftar"
}: Props) {
  const pct = pctOf(value, target);
  const showPct = target > 0;
  return (
    <div
      className={[
        styles.kpi,
        variant === "ink" ? styles.kpiInk : "",
        clickable ? styles.kpiClickable : "",
        active ? styles.kpiActive : "",
      ].filter(Boolean).join(" ")}
      onClick={clickable ? onClick : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); } : undefined}
    >
      <div className={styles.kpiHead}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiIcon}>{icon}</span>
      </div>
      <h3 className={styles.kpiValue}>{fmtIntID(value)}</h3>
      {completed !== undefined && (
        <p className={styles.kpiCompletedText}>
          {subLabel}: <strong>{fmtIntID(completed)}</strong>
        </p>
      )}
      <p className={styles.kpiTargetText}>
        Target <strong>{target > 0 ? fmtIntID(target) : "—"}</strong>
      </p>
      <div className={styles.kpiBottom}>
        <span className={styles.kpiPct}>{showPct ? `${pct}%` : "—"}</span>
        <span>dari target</span>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${showPct ? Math.min(100, pct) : 0}%` }} />
      </div>
    </div>
  );
}
