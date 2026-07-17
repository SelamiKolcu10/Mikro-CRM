/** Completed-by-user vs total-completed-in-project — bkz. backend/utils/developerTree.js */
const ContributionRing = ({ userDone, totalDone, size = 44 }) => {
  const pct = totalDone > 0 ? Math.round((userDone / totalDone) * 100) : 0;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (c * pct) / 100;
  const half = size / 2;

  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`%${pct}`}>
      <circle cx={half} cy={half} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle
        cx={half}
        cy={half}
        r={r}
        fill="none"
        stroke="var(--accent-primary)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled.toFixed(2)} ${c.toFixed(2)}`}
        transform={`rotate(-90 ${half} ${half})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">{pct}%</text>
    </svg>
  );
};

export default ContributionRing;
