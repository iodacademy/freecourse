"use client";

import styles from "./dashboard.module.css";
import { fmtIntID } from "@/lib/format-helpers";

interface Props {
  rows: Array<[string, number]>; // [bucket, count]
  activeKey?: string | null;
  onSelect?: (key: string | null) => void;
}

export default function AgeChart({ rows, activeKey = null, onSelect }: Props) {
  const total = rows.reduce((sum, r) => sum + r[1], 0);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) {
    return <div className={styles.emptyBox}>Belum ada data</div>;
  }
  const isClickable = !!onSelect;
  return (
    <div className={styles.ageChart}>
      {rows.map(([bucket, val]) => {
        const hPct = (val / max) * 100;
        const sharePct = total > 0 ? Math.round((val / total) * 100) : 0;
        const isActive = activeKey === bucket;
        const isDim = activeKey != null && !isActive;
        return (
          <div
            key={bucket}
            className={[
              styles.ageBar,
              isActive ? styles.ageBarActive : "",
              isDim ? styles.ageBarDim : "",
            ].filter(Boolean).join(" ")}
            onClick={isClickable ? () => onSelect!(isActive ? null : bucket) : undefined}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={isClickable ? (e) => { if (e.key === "Enter") onSelect!(isActive ? null : bucket); } : undefined}
          >
            <span className={styles.ageValueNum}>{fmtIntID(val)}</span>
            <div className={styles.ageTrack}>
              <div className={styles.ageColumn} style={{ height: `${Math.max(4, hPct)}%` }} />
            </div>
            <span className={styles.agePct}>{sharePct}%</span>
            <span className={styles.ageLabel}>{bucket}</span>
          </div>
        );
      })}
    </div>
  );
}
