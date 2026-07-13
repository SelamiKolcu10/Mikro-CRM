import { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';

function last365Days() {
  const days = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function intensityClass(total) {
  if (!total) return 'heatmap-cell-0';
  if (total >= 4) return 'heatmap-cell-4';
  if (total >= 3) return 'heatmap-cell-3';
  if (total >= 2) return 'heatmap-cell-2';
  return 'heatmap-cell-1';
}

const STATUS_LABEL_KEY = { todo: 'tasks.status.todo', in_progress: 'tasks.status.in_progress', in_review: 'tasks.status.in_review', done: 'tasks.status.done' };

// Note: t(key) in LanguageContext.jsx only accepts a single lookup key — it does not
// support {placeholder} interpolation or a params argument. So the tooltip sentence
// (which needs the date/total values inlined) is built with a plain template literal
// per-language below, instead of a "tasks.heatmap.tooltip" i18n key with placeholders.
const TOOLTIP_TEXT = {
  tr: (date, total) => `${date}: ${total} görev güncellendi`,
  en: (date, total) => `${date}: ${total} tasks updated`,
};

const TaskHeatmap = ({ getActivityHeatmap, department, assigneeId }) => {
  const { t, lang } = useLanguage();
  const [byDate, setByDate] = useState({});

  useEffect(() => {
    let cancelled = false;
    const params = {};
    if (department) params.department = department;
    if (assigneeId) params.userId = assigneeId;
    getActivityHeatmap(params).then((rows) => {
      if (cancelled) return;
      const map = {};
      rows.forEach((row) => { map[row.date] = row; });
      setByDate(map);
    });
    return () => { cancelled = true; };
  }, [getActivityHeatmap, department, assigneeId]);

  const days = last365Days();

  return (
    <div className="task-heatmap">
      <h3>{t('tasks.heatmap.title')}</h3>
      <div className="task-heatmap-grid">
        {days.map((date) => {
          const entry = byDate[date];
          const total = entry?.total || 0;
          const breakdown = entry
            ? Object.entries(entry.byStatus).map(([status, count]) => `${count} ${t(STATUS_LABEL_KEY[status])}`).join(', ')
            : '';
          const title = TOOLTIP_TEXT[lang](date, total) + (breakdown ? ` (${breakdown})` : '');
          return <div key={date} className={`heatmap-cell ${intensityClass(total)}`} title={title} />;
        })}
      </div>
    </div>
  );
};

export default TaskHeatmap;
