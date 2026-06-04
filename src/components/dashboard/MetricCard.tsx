"use client";

import { ReactNode } from "react";
import { fmtDecID } from "@/lib/format-helpers";
import styles from "./dashboard.module.css";

interface Props {
  label: string;
  value: number;
  suffix?: string;
  icon: ReactNode;
  foot?: string;
  iconVariant?: "red" | "ink";
  children?: ReactNode;
}

export default function MetricCard({ label, value, suffix, icon, foot, iconVariant = "red", children }: Props) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricHead}>
        <span className={`${styles.metricIcon} ${iconVariant === "ink" ? styles.metricIconInk : ""}`}>
          {icon}
        </span>
        <span className={styles.metricLabel}>{label}</span>
      </div>
      <div className={styles.metricValueRow}>
        <span className={styles.metricValue}>{fmtDecID(value, 1)}</span>
        {suffix && <span className={styles.metricSuffix}>{suffix}</span>}
      </div>
      {foot && <p className={styles.metricFoot} dangerouslySetInnerHTML={{ __html: foot }} />}
      {children}
    </div>
  );
}
