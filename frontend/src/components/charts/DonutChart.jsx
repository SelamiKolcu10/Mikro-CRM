import { useChartTooltip } from './ChartTooltip';

/**
 * Donut — oran/pay dağılımı için (tasarım.md §5).
 * data: [{ label, value, color }] — renk varlığı izler, slot sırası sabittir.
 * Dilimler arası 3px yüzey boşluğu (stroke gap) ayrıştırır, border değil.
 * Legend her zaman görünür; yüzde + mutlak değer yazılıdır (relief kuralı).
 */
const DonutChart = ({ data, caption, size = 132, strokeWidth = 15, formatValue }) => {
  const { tooltip, show, hide } = useChartTooltip();
  const items = data.filter((d) => d.value > 0);
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = size / 2 - strokeWidth / 2 - 2;
  const C = 2 * Math.PI * r;
  const gap = items.length > 1 ? 3 : 0;
  const fmt = formatValue || ((v) => v.toLocaleString());

  let offset = 0;
  const segments = items.map((d) => {
    const len = (d.value / total) * C;
    const seg = { ...d, len: Math.max(len - gap, 0.5), start: offset };
    offset += len;
    return seg;
  });

  return (
    <div className="donut-chart">
      <div className="donut-svg-wrap" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${caption || ''}: ${items.map((d) => `${d.label} ${Math.round((d.value / total) * 100)}%`).join(', ')}`}
        >
          {segments.map((s) => (
            <circle
              key={s.label}
              className="donut-seg"
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${s.len} ${C - s.len}`}
              strokeDashoffset={-s.start}
              onMouseMove={(e) => show(e, (
                <>
                  <span className="viz-tip-label">{s.label} · </span>
                  <span className="viz-tip-value">{fmt(s.value)}</span>
                  <span className="viz-tip-label"> ({Math.round((s.value / total) * 100)}%)</span>
                </>
              ))}
              onMouseLeave={hide}
            />
          ))}
        </svg>
        <div className="donut-center">
          <div>
            <span className="donut-total tabular">{fmt(total)}</span>
            {caption && <span className="donut-caption">{caption}</span>}
          </div>
        </div>
      </div>
      <div className="donut-legend">
        {data.map((d) => (
          <div className="legend-item" key={d.label}>
            <i className="legend-swatch" style={{ background: d.color }} />
            {d.label}
            <span className="legend-pct">%{total ? Math.round((d.value / total) * 100) : 0}</span>
            <span className="legend-value">{fmt(d.value)}</span>
          </div>
        ))}
      </div>
      {tooltip}
    </div>
  );
};

export default DonutChart;
