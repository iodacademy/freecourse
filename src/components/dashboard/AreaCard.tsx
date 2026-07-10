"use client";

import { ReactNode } from "react";
import { fmtIntID } from "@/lib/format-helpers";
import styles from "./dashboard.module.css";

interface Props {
  label: string;
  desc: string;
  /** Peserta tersertifikasi di area ini. */
  completed: number;
  /** Total pendaftar di area ini. */
  registered: number;
  /** Tersertifikasi yang juga lolos syarat usia Data Clean. */
  cleanCompleted: number;
  icon: ReactNode;
  /** Tampilan redup untuk kartu "Daerah Lainnya" (bukan area target). */
  muted?: boolean;
  /**
   * Sembunyikan baris "Data Clean". Dipakai saat dashboard sudah dalam mode
   * Hanya Data Clean — di situ `completed` sudah sama dengan `cleanCompleted`,
   * jadi menampilkannya lagi cuma mengulang angka yang sama.
   */
  hideCleanRow?: boolean;
}

export default function AreaCard({
  label, desc, completed, registered, cleanCompleted, icon,
  muted = false, hideCleanRow = false,
}: Props) {
  return (
    <div className={[styles.area, muted ? styles.areaMuted : ""].filter(Boolean).join(" ")}>
      <div className={styles.areaHead}>
        <div className={styles.areaHeadText}>
          <div className={styles.areaLabel}>{label}</div>
          <div className={styles.areaDesc}>{desc}</div>
        </div>
        <span className={styles.areaIcon}>{icon}</span>
      </div>

      <div>
        <span className={styles.areaValue}>{fmtIntID(completed)}</span>
        <span className={styles.areaValueSub}>tersertifikasi</span>
      </div>

      <div className={styles.areaStatRow}>
        <span>
          Pendaftar: <strong>{fmtIntID(registered)}</strong>
        </span>
        {!hideCleanRow && !muted && (
          <span>
            Data Clean: <strong>{fmtIntID(cleanCompleted)}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
