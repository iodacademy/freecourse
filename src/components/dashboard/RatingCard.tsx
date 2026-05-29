"use client";

import { ReactNode } from "react";
import { fmtDecID, fmtIntID } from "@/lib/format-helpers";
import Stars from "./Stars";
import styles from "./dashboard.module.css";

interface Props {
  label: string;
  value: number;
  responden: number;
  icon: ReactNode;
  iconVariant?: "red" | "ink";
}

export default function RatingCard({ label, value, responden, icon, iconVariant = "red" }: Props) {
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
        <span className={styles.metricSuffix}>/ 5</span>
      </div>
      <Stars value={value} max={5} size={18} />
      <p className={styles.metricFoot}>
        Dari <strong>{fmtIntID(responden)}</strong> peserta
      </p>
    </div>
  );
}
