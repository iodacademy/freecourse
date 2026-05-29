"use client";

import { useState, useRef, useEffect } from "react";
import { Filter, ChevronDown } from "lucide-react";
import styles from "./dashboard.module.css";

type SourceItem = { key: string; label: string; share: number };

interface Props {
  options: SourceItem[];
  value: string | null;
  onChange: (key: string | null) => void;
}

export default function SourceFilter({ options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentLabel = value
    ? options.find((o) => o.key === value)?.label || value
    : "Semua Sumber";

  return (
    <div className={styles.dropdownWrap} ref={wrapRef}>
      <button className={styles.actionBtn} onClick={() => setOpen((v) => !v)} type="button">
        <Filter size={14} />
        Sumber: {currentLabel}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className={styles.dropdownPanel}>
          <div className={styles.sourceList}>
            {options.map((opt) => {
              const isActive = opt.key === (value ?? "semua");
              return (
                <button
                  key={opt.key}
                  className={`${styles.sourceItem} ${isActive ? styles.sourceItemActive : ""}`}
                  onClick={() => {
                    onChange(opt.key === "semua" ? null : opt.key);
                    setOpen(false);
                  }}
                  type="button"
                >
                  <span>{opt.label}</span>
                  <span className={styles.sourceShare}>{Math.round(opt.share * 100)}%</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
