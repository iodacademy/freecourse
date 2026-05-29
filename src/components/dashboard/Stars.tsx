"use client";

/**
 * Stars — 5-star rating display dengan partial fill via SVG gradient.
 * Mendukung pecahan (mis. 4.3 → 4 full + 30% star ke-5).
 */
export default function Stars({ value, max = 5, size = 18 }: { value: number; max?: number; size?: number }) {
  const stars = Array.from({ length: max }, (_, i) => i);
  return (
    <div role="img" aria-label={`Rating ${value} dari ${max}`} style={{ display: "inline-flex", gap: 2 }}>
      {stars.map((i) => {
        const fillRatio = Math.max(0, Math.min(1, value - i));
        const gradId = `star-grad-${i}-${Math.random().toString(36).slice(2, 6)}`;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
                <stop offset={fillRatio} stopColor="#CC0000" />
                <stop offset={fillRatio} stopColor="#E5E5E5" />
              </linearGradient>
            </defs>
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill={`url(#${gradId})`}
              stroke="#CC0000"
              strokeWidth="0.6"
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </div>
  );
}
