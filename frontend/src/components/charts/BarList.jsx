import { useChartTooltip } from './ChartTooltip';

/**
 * Yatay bar listesi — kategori karşılaştırması için (tasarım.md §5).
 * items: [{ label, value, color }]. Değer her zaman ucun yanında yazılır
 * (relief kuralı: renk tek başına taşımaz). Bar ≤14px, veri-ucu yuvarlak.
 */
const BarList = ({ items, formatValue }) => {
  const max = Math.max(...items.map((i) => i.value), 1);
  const fmt = formatValue || ((v) => v.toLocaleString());
  const { tooltip, show, hide } = useChartTooltip();

  return (
    <div className="bar-list">
      {items.map((item) => (
        <div className="bar-item" key={item.label}>
          <span className="bar-item-label">{item.label}</span>
          <div className="bar-item-track">
            <div
              className="bar-item-fill"
              style={{ width: `${(item.value / max) * 88}%`, background: item.color }}
              onMouseMove={(e) => show(e, (
                <>
                  <span className="viz-tip-label">{item.label} · </span>
                  <span className="viz-tip-value">{fmt(item.value)}</span>
                </>
              ))}
              onMouseLeave={hide}
            />
            <span className="bar-item-value">{fmt(item.value)}</span>
          </div>
        </div>
      ))}
      {tooltip}
    </div>
  );
};

export default BarList;
