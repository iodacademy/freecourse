"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import styles from "./dashboard.module.css";

type Preset = "semua" | "d30" | "d7" | "custom";

interface Props {
  dateFrom: string | null;
  dateTo: string | null;
  onApply: (from: string | null, to: string | null) => void;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDateID(iso: string | null): string {
  if (!iso) return "Semua";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${parseInt(m[3])} ${months[parseInt(m[2]) - 1]} ${m[1]}`;
}

export default function DateFilter({ dateFrom, dateTo, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(dateFrom || "");
  const [to, setTo] = useState(dateTo || "");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function applyPreset(p: Preset) {
    const now = new Date();
    if (p === "semua") {
      onApply(null, null);
    } else if (p === "d30") {
      const start = new Date(now.getTime() - 29 * 86400000);
      onApply(isoDate(start), isoDate(now));
    } else if (p === "d7") {
      const start = new Date(now.getTime() - 6 * 86400000);
      onApply(isoDate(start), isoDate(now));
    }
    setOpen(false);
  }

  function applyCustom() {
    onApply(from || null, to || null);
    setOpen(false);
  }

  const activePreset: Preset = dateFrom == null && dateTo == null ? "semua" : "custom";

  const label = dateFrom && dateTo
    ? `${fmtDateID(dateFrom)} – ${fmtDateID(dateTo)}`
    : "Semua Periode";

  return (
    <div className={styles.dropdownWrap} ref={wrapRef}>
      <button className={styles.actionBtn} onClick={() => setOpen((v) => !v)} type="button">
        <Calendar size={14} />
        Tanggal: {label}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className={styles.dropdownPanel}>
          <div className={styles.presetRow}>
            <button
              className={`${styles.presetBtn} ${activePreset === "semua" ? styles.presetBtnActive : ""}`}
              onClick={() => applyPreset("semua")}
            >Semua</button>
            <button className={styles.presetBtn} onClick={() => applyPreset("d30")}>30 Hari</button>
            <button className={styles.presetBtn} onClick={() => applyPreset("d7")}>7 Hari</button>
          </div>
          <div className={styles.customRange}>
            <div className={styles.dateRow}>
              <input type="date" className={styles.dateInput} value={from} onChange={(e) => setFrom(e.target.value)} max={to || undefined} />
              <span>—</span>
              <input type="date" className={styles.dateInput} value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} />
            </div>
            <button className={styles.applyBtn} onClick={applyCustom}>Terapkan</button>
          </div>
        </div>
      )}
    </div>
  );
}
