'use client';

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  lowLabel?: string;
  highLabel?: string;
}

export default function StarRating({
  value,
  onChange,
  lowLabel = 'Sangat buruk',
  highLabel = 'Sangat baik',
}: StarRatingProps) {
  return (
    <div className="yr-rating">
      <div className="yr-rating__scale">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
      <div className="yr-rating__stars">
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            type="button"
            className={`yr-rating__star ${value >= num ? 'yr-rating__star--on' : ''}`}
            onClick={() => onChange(num)}
          >
            <span className="yr-rating__star-num">{num}</span>
            <svg viewBox="0 0 24 24" fill="currentFill" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
