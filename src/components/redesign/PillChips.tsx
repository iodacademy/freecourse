'use client';

import { useState, type ReactNode } from 'react';

export interface PillOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface PillChipsProps {
  options: PillOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  grid3?: boolean;
  allowOther?: boolean;
  otherLabel?: string;
  otherPlaceholder?: string;
}

export default function PillChips({
  options,
  value,
  onChange,
  multiple = false,
  grid3 = false,
  allowOther = false,
  otherLabel = 'Lainnya',
  otherPlaceholder = 'Tuliskan di sini...',
}: PillChipsProps) {
  const [otherText, setOtherText] = useState('');
  const isOtherSelected = multiple
    ? Array.isArray(value) && value.includes('__other__')
    : value === '__other__';

  const isSelected = (optValue: string) => {
    if (multiple && Array.isArray(value)) {
      return value.includes(optValue);
    }
    return value === optValue;
  };

  const handleClick = (optValue: string) => {
    if (multiple && Array.isArray(value)) {
      const newVal = value.includes(optValue)
        ? value.filter((v) => v !== optValue)
        : [...value, optValue];
      onChange(newVal);
    } else {
      onChange(optValue === value ? '' : optValue);
    }
  };

  const handleOtherChange = (text: string) => {
    setOtherText(text);
    // Replace __other__ with actual text in parent if needed
    if (multiple && Array.isArray(value)) {
      // Keep __other__ in array, parent reads otherText separately
    }
  };

  return (
    <div>
      <div className={grid3 ? 'yr-pills--grid3' : 'yr-pills'}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`yr-pill ${opt.icon ? 'yr-pill--icon' : ''}`}
            aria-pressed={isSelected(opt.value)}
            onClick={() => handleClick(opt.value)}
          >
            {opt.icon && <span className="yr-pill__icon">{opt.icon}</span>}
            <svg className="yr-pill__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {opt.label}
          </button>
        ))}

        {allowOther && (
          <button
            type="button"
            className="yr-pill"
            aria-pressed={isOtherSelected}
            onClick={() => handleClick('__other__')}
          >
            <svg className="yr-pill__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {otherLabel}
          </button>
        )}
      </div>

      {allowOther && isOtherSelected && (
        <div className="yr-other-input">
          <label>{otherLabel}</label>
          <input
            type="text"
            className="yr-input"
            placeholder={otherPlaceholder}
            value={otherText}
            onChange={(e) => handleOtherChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
