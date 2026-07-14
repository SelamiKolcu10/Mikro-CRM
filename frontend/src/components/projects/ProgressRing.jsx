import { useId } from 'react';

const SIZE = 56;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Dairesel tamamlanma göstergesi — "Kapsül & Halka" tasarım dilinin halka
 * yarısı (bkz. design-direction dokümanı). Renk eşiklerle geçer ama tek
 * bilgi taşıyıcı değil: yüzde her zaman ortada yazılıdır (erişilebilirlik).
 */
const ProgressRing = ({ percent = 0 }) => {
  const gradientId = `progress-ring-gradient-${useId()}`;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
  const variant = clamped === 0 ? 'empty' : clamped >= 100 ? 'complete' : 'in-progress';

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={`progress-ring progress-ring--${variant}`}
      role="img"
      aria-label={`%${clamped} tamamlandı`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent-primary)" />
          <stop offset="100%" stopColor="var(--accent-secondary)" />
        </linearGradient>
      </defs>
      <circle
        className="progress-ring-track"
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        strokeWidth={STROKE}
        fill="none"
      />
      {clamped > 0 && (
        <circle
          className="progress-ring-fill"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          fill="none"
          stroke={variant === 'complete' ? undefined : `url(#${gradientId})`}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      )}
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="progress-ring-label">
        {clamped}%
      </text>
    </svg>
  );
};

export default ProgressRing;
