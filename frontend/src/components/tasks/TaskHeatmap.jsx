import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';

// ────────────────────── Helpers ──────────────────────

/** Format a Date using its local calendar fields (avoids UTC day-shift from toISOString). */
function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

const HeatmapTooltip = ({ date, entry, position, t }) => {
  if (!date) return null;
  const total = entry?.total || 0;
  const details = entry?.details || [];

  // Format date for display: "15 Jul 2026"
  const dateObj = new Date(date + 'T00:00:00');
  const day = dateObj.getDate();
  const month = t(`tasks.heatmap.months.${dateObj.getMonth()}`);
  const year = dateObj.getFullYear();
  const formattedDate = `${day} ${month} ${year}`;

  return (
    <div
      className="heatmap-tooltip"
      style={{ left: position.x, top: position.y }}
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
          {entry && entry.total > details.length && (
            <li className="heatmap-tooltip-more">
              +{entry.total - details.length} {t('tasks.heatmap.andMore')}
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

    // Center tooltip horizontally over the cell, position above it
    const x = rect.left + rect.width / 2;
    const y = rect.top - 8;

    setTooltip({ date, entry: byDate[date], position: { x, y } });
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

      {/* Tooltip portal (outside scroll container) */}
      {tooltip && (
        <HeatmapTooltip
          date={tooltip.date}
          entry={tooltip.entry}
          position={tooltip.position}
          t={t}
        />
      )}
    </div>
  );
};

export default TaskHeatmap;
