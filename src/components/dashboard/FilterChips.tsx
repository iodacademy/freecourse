"use client";

import styles from "./dashboard.module.css";

export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}

interface Props {
  filters: ActiveFilter[];
  onRemove: (key: string) => void;
  onReset: () => void;
}

export default function FilterChips({ filters, onRemove, onReset }: Props) {
  if (filters.length === 0) return null;
  return (
    <div className={styles.chipsRow}>
      {filters.map((f) => (
        <span key={f.key} className={styles.chip}>
          {f.label}: {f.value}
          <button className={styles.chipClose} onClick={() => onRemove(f.key)} aria-label={`Hapus filter ${f.label}`}>×</button>
        </span>
      ))}
      <button className={styles.resetLink} onClick={onReset}>Reset</button>
    </div>
  );
}
