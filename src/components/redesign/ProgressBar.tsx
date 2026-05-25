'use client';

interface ProgressBarProps {
  percent: number;
  label?: string;
}

export default function ProgressBar({ percent, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="yr-progress">
      {label && <span>{label}</span>}
      <div className="yr-progress__bar">
        <span className="yr-progress__fill" style={{ width: `${clamped}%` }} />
      </div>
      <span>{Math.round(clamped)}%</span>
    </div>
  );
}
