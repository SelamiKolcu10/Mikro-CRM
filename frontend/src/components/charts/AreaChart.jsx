import { useRef, useState } from 'react';

/**
 * Alan grafiği — zaman serisi trendi için (tasarım.md §5, §8).
 * points: [{ label, value }] — kronolojik sıra. Tek seri, tek eksen.
 * Crosshair + tooltip varsayılan; alan dolgusu %9, çizgi 2px, grid hairline.
 * Son nokta işaretlenir ve doğrudan etiketlenir (selective direct label).
 */
const W = 600;
const H = 220;
const PAD = { l: 46, r: 56, t: 16, b: 28 };

const AreaChart = ({ points, formatValue, ariaLabel }) => {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);
  const fmt = formatValue || ((v) => v.toLocaleString());

  if (!points || points.length < 2) return null;

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || rawMax || 1;
  const lo = Math.max(0, rawMin - span * 0.15);
  const hi = rawMax + span * 0.1;

  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const X = (i) => PAD.l + (i / (points.length - 1)) * iw;
  const Y = (v) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih;

  // 4 temiz grid çizgisi
  const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) / 3) * i);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)} ${Y(p.value).toFixed(1)}`).join(' ');
  const last = points.length - 1;

  // X ekseninde en fazla ~6 etiket
  const step = Math.max(1, Math.ceil(points.length / 6));

  const handleMove = (e) => {
    const rect = wrapRef.current.querySelector('svg').getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    let i = Math.round(((sx - PAD.l) / iw) * (points.length - 1));
    i = Math.max(0, Math.min(last, i));
    setHover(i);
  };

  return (
    <div className="area-chart-wrap" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
        {ticks.map((tk) => (
          <g key={tk}>
            <line className="area-chart-grid" x1={PAD.l} y1={Y(tk)} x2={W - PAD.r} y2={Y(tk)} />
            <text className="area-chart-axis-label" x={PAD.l - 6} y={Y(tk) + 3} textAnchor="end">
              {fmt(tk)}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          i % step === 0 && (
            <text key={p.label} className="area-chart-axis-label" x={X(i)} y={H - 8} textAnchor="middle">
              {p.label}
            </text>
          )
        ))}
        <path className="area-chart-fill" d={`${line} L${X(last)} ${PAD.t + ih} L${X(0)} ${PAD.t + ih} Z`} />
        <path className="area-chart-line" d={line} />
        <circle className="area-chart-dot" cx={X(last)} cy={Y(points[last].value)} r="4" />
        <text className="area-chart-endlabel" x={X(last) + 7} y={Y(points[last].value) + 4}>
          {fmt(points[last].value)}
        </text>
        {hover !== null && (
          <g>
            <line className="area-chart-crosshair" x1={X(hover)} y1={PAD.t} x2={X(hover)} y2={PAD.t + ih} />
            <circle className="area-chart-dot" cx={X(hover)} cy={Y(points[hover].value)} r="4.5" />
          </g>
        )}
        <rect
          x={PAD.l} y={PAD.t} width={iw} height={ih} fill="transparent"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <div
          className="viz-tooltip"
          style={{
            position: 'absolute',
            left: `${(X(hover) / W) * 100}%`,
            top: `${(Y(points[hover].value) / H) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 12px))',
          }}
        >
          <span className="viz-tip-label">{points[hover].label} · </span>
          <span className="viz-tip-value">{fmt(points[hover].value)}</span>
        </div>
      )}
    </div>
  );
};

export default AreaChart;
