import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../context/LanguageContext';
import { toLocalISODate } from '../../utils/dayBucket';

// ────────────────────── Helpers ──────────────────────

/**
 * Generate ISO date strings from 364 days ago through December 31 of the
 * current year, oldest first. Days after today have no activity yet and
 * simply render as empty cells — this keeps the grid spanning the full
 * year (through December) instead of stopping at today's month.
 */
function buildDateRange() {
  const days = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 364);
  const end = new Date(today.getFullYear(), 11, 31);

  const d = new Date(start);
  while (d <= end) {
    days.push(toLocalISODate(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/**
 * Build a 7×N week grid from a flat array of ISO date strings.
 * Each column = 1 week, each row = a day-of-week (0=Sun … 6=Sat).
 * Returns { weeks: [[dateOrNull, …7], …], monthLabels: [{month,col}…] }.
 */
function buildWeekGrid(dates) {
  const weeks = [];
  let currentWeek = new Array(7).fill(null);
  const firstDate = new Date(dates[0] + 'T00:00:00');
  const startDay = firstDate.getDay(); // 0=Sun

  // Pad the first week with nulls before the start day
  for (let d = 0; d < startDay; d++) {
    currentWeek[d] = null;
  }

  dates.forEach((dateStr) => {
    const dateObj = new Date(dateStr + 'T00:00:00');
    const dow = dateObj.getDay();
    currentWeek[dow] = dateStr;
    if (dow === 6) {
      weeks.push(currentWeek);
      currentWeek = new Array(7).fill(null);
    }
  });

  // Push the last partial week
  if (currentWeek.some((d) => d !== null)) {
    weeks.push(currentWeek);
  }

  // Determine month labels — place them at the first week of each month
  const monthLabels = [];
  let lastMonth = -1;
  weeks.forEach((week, colIdx) => {
    // Find the first non-null day in this week
    const firstDay = week.find((d) => d !== null);
    if (!firstDay) return;
    const month = new Date(firstDay + 'T00:00:00').getMonth();
    if (month !== lastMonth) {
      monthLabels.push({ month, col: colIdx });
      lastMonth = month;
    }
  });

  return { weeks, monthLabels };
}

/** Map a count to an intensity level 0–4 for CSS classes. */
function intensityLevel(count) {
  if (!count) return 0;
  if (count >= 7) return 4;
  if (count >= 5) return 3;
  if (count >= 3) return 2;
  return 1;
}

const STATUS_LABEL_KEY = {
  todo: 'tasks.status.todo',
  in_progress: 'tasks.status.in_progress',
  in_review: 'tasks.status.in_review',
  done: 'tasks.status.done',
};

// ────────────────────── HeatmapTooltip ──────────────────────

const HeatmapTooltip = ({ date, entry, anchor, t }) => {
  const ref = useRef(null);
  // İlk kare ölçülene kadar gizli — konum hesaplanınca görünür olur (flicker yok).
  const [style, setStyle] = useState({ left: 0, top: 0, visibility: 'hidden' });
  const [placement, setPlacement] = useState('below');

  // Portal ile document.body'ye render edildiği için position:fixed artık
  // gerçekten viewport'a göre çalışır. Gerçek yüksekliği ölçeriz:
  //  - Hücrenin ALTINA sığıyorsa oraya aç (imleç hücrede/üstte kalır, yazıyı
  //    kapatmaz), yatayda hücreye ortala.
  //  - Sığmıyorsa (harita sayfa dibinde) YANA koy — imleç hücrede kalır, tooltip
  //    yanında açılır, böylece fare oku çıkan yazının üstüne binmez.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 8;    // viewport kenar payı
    const gap = 10; // hücre ile tooltip arası boşluk
    const clampX = (x) => Math.max(m, Math.min(x, vw - width - m));

    let left;
    let top;
    if (anchor.bottom + gap + height <= vh - m) {
      top = anchor.bottom + gap;
      left = clampX(anchor.cx - width / 2);
      setPlacement('below');
    } else {
      top = Math.max(m, Math.min(anchor.top, vh - height - m));
      if (anchor.right + gap + width <= vw - m) {
        left = anchor.right + gap;            // hücrenin sağına
      } else {
        left = clampX(anchor.left - gap - width); // sığmazsa soluna
      }
      setPlacement('side');
    }

    setStyle({ left, top });
  }, [date, anchor]);

  if (!date) return null;
  const total = entry?.total || 0;
  const allDetails = entry?.details || [];
  // Tooltip'i kompakt tut (harita sayfa dibinde; uzun kutu viewport'a
  // sığmak için yukarı çekilince görevlerin üstüne taşıyor) — en fazla 4
  // satır göster, gerisini "+N daha" ile özetle.
  const MAX_ROWS = 4;
  const details = allDetails.slice(0, MAX_ROWS);
  const hiddenCount = total - details.length;

  // Format date for display: "15 Jul 2026"
  const dateObj = new Date(date + 'T00:00:00');
  const day = dateObj.getDate();
  const month = t(`tasks.heatmap.months.${dateObj.getMonth()}`);
  const year = dateObj.getFullYear();
  const formattedDate = `${day} ${month} ${year}`;

  return (
    <div
      ref={ref}
      className={`heatmap-tooltip heatmap-tooltip--${placement}`}
      style={style}
    >
      <div className="heatmap-tooltip-header">
        <strong>
          {total} {total === 1 ? t('tasks.heatmap.contribution') : t('tasks.heatmap.contributions')}
        </strong>
        <span className="heatmap-tooltip-date">{formattedDate}</span>
      </div>
      {total === 0 && (
        <div className="heatmap-tooltip-empty">{t('tasks.heatmap.noActivity')}</div>
      )}
      {details.length > 0 && (
        <ul className="heatmap-tooltip-details">
          {details.map((d, i) => (
            <li key={i}>
              <span className="heatmap-tooltip-time">{d.time}</span>
              <span className="heatmap-tooltip-text">
                <strong>{d.user || '?'}</strong>{' '}
                {t(`tasks.heatmap.actions.${d.action || 'status_changed'}`)}{' '}
                {d.action === 'status_changed' && d.to && (
                  <span className={`heatmap-tooltip-status heatmap-status-${d.to}`}>
                    {t(STATUS_LABEL_KEY[d.to])}
                  </span>
                )}{' '}
                <em>'{d.task}'</em>
              </span>
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className="heatmap-tooltip-more">
              +{hiddenCount} {t('tasks.heatmap.andMore')}
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

// ────────────────────── HeatmapLegend ──────────────────────

const HeatmapLegend = ({ t }) => (
  <div className="heatmap-legend">
    <span className="heatmap-legend-label">{t('tasks.heatmap.less')}</span>
    {[0, 1, 2, 3, 4].map((level) => (
      <div key={level} className={`heatmap-cell heatmap-cell-${level}`} />
    ))}
    <span className="heatmap-legend-label">{t('tasks.heatmap.more')}</span>
  </div>
);

// ────────────────────── Main Component ──────────────────────

const TaskHeatmap = ({ getActivityHeatmap, department, assigneeId }) => {
  const { t } = useLanguage();
  const [byDate, setByDate] = useState({});
  const [tooltip, setTooltip] = useState(null);
  const gridRef = useRef(null);

  // Fetch data whenever filters change
  useEffect(() => {
    let cancelled = false;
    const params = {};
    if (department) params.department = department;
    if (assigneeId) params.userId = assigneeId;

    getActivityHeatmap(params)
      .then((data) => {
        if (cancelled) return;
        // API now returns a dictionary keyed by date
        setByDate(data || {});
      })
      .catch(() => {
        if (cancelled) return;
        setByDate({});
      });
    return () => { cancelled = true; };
  }, [getActivityHeatmap, department, assigneeId]);

  const days = buildDateRange();
  const { weeks, monthLabels } = buildWeekGrid(days);

  // Day-of-week labels (row labels) — only Mon(1), Wed(3), Fri(5)
  const DAY_LABEL_ROWS = [1, 3, 5];

  // Tooltip positioning — use viewport-relative coordinates to avoid
  // overflow clipping from the scroll container's overflow-x:auto.
  const handleCellHover = useCallback((e, date) => {
    if (!date) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // Ham hücre çapası (viewport koordinatı); nihai konumu tooltip kendi
    // ölçülen boyutuna göre hesaplar (bkz. HeatmapTooltip).
    setTooltip({
      date,
      entry: byDate[date],
      anchor: {
        cx: rect.left + rect.width / 2,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      },
    });
  }, [byDate]);

  const handleCellLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div className="task-heatmap">
      <div className="task-heatmap-header">
        <h3>{t('tasks.heatmap.title')}</h3>
        <HeatmapLegend t={t} />
      </div>

      <div className="task-heatmap-grid-wrapper" ref={gridRef}>
        {/* Month labels row */}
        <div className="task-heatmap-months">
          <div className="heatmap-day-label-spacer" />
          {weeks.map((_, colIdx) => {
            const label = monthLabels.find((m) => m.col === colIdx);
            return (
              <div key={colIdx} className="heatmap-month-cell">
                {label ? t(`tasks.heatmap.months.${label.month}`) : ''}
              </div>
            );
          })}
        </div>

        {/* Grid body: day labels + cells */}
        <div className="task-heatmap-body">
          {/* Day-of-week labels column */}
          <div className="task-heatmap-day-labels">
            {Array.from({ length: 7 }).map((_, row) => (
              <div key={row} className="heatmap-day-label">
                {DAY_LABEL_ROWS.includes(row) ? t(`tasks.heatmap.days.${row}`) : ''}
              </div>
            ))}
          </div>

          {/* The actual grid */}
          <div className="task-heatmap-grid">
            {weeks.map((week, colIdx) => (
              <div key={colIdx} className="heatmap-week-column">
                {week.map((date, rowIdx) => {
                  if (date === null) {
                    return <div key={rowIdx} className="heatmap-cell heatmap-cell-empty" />;
                  }
                  const entry = byDate[date];
                  const total = entry?.total || 0;
                  const level = intensityLevel(total);
                  return (
                    <div
                      key={rowIdx}
                      className={`heatmap-cell heatmap-cell-${level}`}
                      onMouseEnter={(e) => handleCellHover(e, date)}
                      onMouseLeave={handleCellLeave}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Tooltip'i document.body'ye portalla — .page-container/.page-enter gibi
          ata elemanların position:fixed'i hapsetmesini (ve tooltip'in görevlerin
          üstüne kaymasını) önler. */}
      {tooltip && createPortal(
        <HeatmapTooltip
          date={tooltip.date}
          entry={tooltip.entry}
          anchor={tooltip.anchor}
          t={t}
        />,
        document.body,
      )}
    </div>
  );
};

export default TaskHeatmap;
