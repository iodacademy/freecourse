"use client";

import styles from "./dashboard.module.css";
import { fmtIntID } from "@/lib/format-helpers";

export type BarRow = [string, number];

interface Props {
  rows: BarRow[];
  rankNumbers?: boolean;
  colorScale?: string[]; // override fill warna per rank
  activeKey?: string | null;
  onSelect?: (key: string | null) => void;
}

export default function BarTable({ rows, rankNumbers = false, colorScale, activeKey = null, onSelect }: Props) {
  const total = rows.reduce((sum, r) => sum + r[1], 0);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const isClickable = !!onSelect;

  if (!rows.length) {
    return <div className={styles.emptyBox}>Belum ada data</div>;
  }

  return (
    <div className={styles.barTable}>
      {rows.map(([name, val], i) => {
        const widthPct = (val / max) * 100;
        const sharePct = total > 0 ? Math.round((val / total) * 100) : 0;
        const isActive = activeKey === name;
        const isDim = activeKey != null && !isActive;
        const fillColor = colorScale?.[i];
        return (
          <div
            key={name}
            className={[
              styles.barRow,
              !isClickable ? styles.barRowNoClick : "",
              isActive ? styles.barRowActive : "",
              isDim ? styles.barRowDim : "",
            ].filter(Boolean).join(" ")}
            onClick={isClickable ? () => onSelect!(isActive ? null : name) : undefined}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={isClickable ? (e) => { if (e.key === "Enter") onSelect!(isActive ? null : name); } : undefined}
          >
            {rankNumbers ? (
              <span className={styles.barRank}>{i + 1}</span>
            ) : (
              <span className={styles.barRank} aria-hidden="true">·</span>
            )}
            <div className={styles.barNameWrap}>
              <span className={styles.barName} title={name}>{name}</span>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{
                    width: `${widthPct}%`,
                    ...(fillColor ? { background: fillColor } : {}),
                  }}
                />
              </div>
            </div>
            <div className={styles.barValue}>
              <span className={styles.barValueNum}>{fmtIntID(val)}</span>
              <span className={styles.barValuePct}>{sharePct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
