import { useState, useMemo } from 'react';
import { HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { canApproveTask } from '../../utils/taskScope';
import { dayBucketOf, toLocalISODate, withNewDay } from '../../utils/dayBucket';
import Modal from '../common/Modal';

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const VISIBLE_PER_DAY = 3;

/** Pazartesi-başlangıçlı, her zaman 6 hafta (42 hücre) — ay değiştikçe grid
 * yüksekliği sıçramasın diye. Önceki/sonraki aydan taşan günler de gerçek
 * Date nesneleri olduğundan oraya sürüklemek de çalışır (küçük, bedava bir
 * "yakın aya taşıma" penceresi — bkz. tasarım kararı: yakın=sürükle, uzak=tarih seç). */
function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function groupTasksByDay(tasks) {
  const byDay = new Map();
  const undated = [];
  for (const task of tasks) {
    const key = dayBucketOf(task.deadline);
    if (!key) {
      undated.push(task);
      continue;
    }
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(task);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
  }
  return { byDay, undated };
}

/**
 * Dolgu rengi = öncelik, kenar/opaklık = durum — ikisi ayrı eksen, tek renge
 * sıkıştırılmadı (bkz. tasarım kararı). Sürükleme + tıklama (tarih seçici)
 * yalnızca canApproveTask true ise aktif; yetkisi olmayan kullanıcı için pill
 * salt-okunur görünür (TaskBoard'daki canAct/canApprove ayrımıyla aynı çizgi).
 */
const TaskPill = ({ task, draggable, onDragStart, onOpen }) => {
  const isDone = task.status === 'done';
  const isOverdue = !isDone && task.deadline && dayBucketOf(task.deadline) < toLocalISODate(new Date());
  const cls = [
    'calendar-pill',
    `calendar-pill--${task.priority}`,
    isDone ? 'calendar-pill--done' : '',
    isOverdue ? 'calendar-pill--overdue' : '',
    draggable ? 'calendar-pill--interactive' : '',
  ].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart(e, task) : undefined}
      onClick={draggable ? (e) => { e.stopPropagation(); onOpen(task); } : undefined}
      title={task.title}
    >
      <span className="calendar-pill-title">{task.title}</span>
    </div>
  );
};

/**
 * Uzak/aya-atlamalı taşıma + tarihsiz göreve ilk deadline atama — ikisi de
 * aynı yol: göreve tıkla → bu modal açılır. Var olan Modal.jsx/form-* stilini
 * kullanır (bu sayfada zaten CreateTaskModal ile kanıtlanmış, portal
 * gerektirmeyen güvenli desen — bkz. proje hafızası: yeni position:fixed
 * overlay'ler yerine mevcut kanıtlanmış Modal'ı tercih et).
 */
const DatePickerModal = ({ task, onClose, onSave }) => {
  const { t } = useLanguage();
  const [value, setValue] = useState(task.deadline ? toLocalISODate(new Date(task.deadline)) : '');

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={task.title}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          {task.deadline && (
            <button type="button" className="btn btn-secondary" onClick={() => onSave(task._id, null)}>
              {t('tasks.calendar.clearDate')}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => onSave(task._id, value || null)}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">{t('tasks.form.deadline')}</label>
        <input
          type="date"
          className="form-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
      </div>
    </Modal>
  );
};

/**
 * Ay görünümü + sürükle-bırak ile deadline taşıma. Veri/yetki tamamen
 * dışarıdan gelir (tasks zaten Tasks.jsx'teki sayfa filtreleriyle
 * süzülmüş — TaskBoard'un aldığı aynı filteredTasks); bu bileşen sadece
 * görüntüleme + etkileşim (mobil port hedefiyle tutarlı).
 */
const CalendarView = ({ tasks, onUpdateDeadline }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [dragOverDay, setDragOverDay] = useState(null);
  const [expandedDays, setExpandedDays] = useState(() => new Set());
  const [picker, setPicker] = useState(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const gridDays = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const { byDay, undated } = useMemo(() => groupTasksByDay(tasks), [tasks]);
  const todayISO = toLocalISODate(new Date());

  const goToMonth = (delta) => setCursor((prev) => {
    const next = new Date(prev);
    next.setMonth(next.getMonth() + delta);
    return next;
  });
  const goToToday = () => {
    const d = new Date();
    d.setDate(1);
    setCursor(d);
  };

  const toggleExpand = (dayISO) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayISO)) next.delete(dayISO); else next.add(dayISO);
      return next;
    });
  };

  const moveTask = async (taskId, dayISO) => {
    const task = tasks.find((tk) => tk._id === taskId);
    if (!task) return;
    const nextDeadline = dayISO ? withNewDay(task.deadline, dayISO).toISOString() : null;
    try {
      await onUpdateDeadline(taskId, nextDeadline);
      toast.success(t('tasks.calendar.moveSuccess'));
    } catch (err) {
      // useTasks.updateTaskDeadline zaten optimistic state'i eski haline
      // döndürdü (rollback) — burada sadece kullanıcıya haber veriyoruz.
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('text/plain', task._id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDayDragOver = (e, dayISO) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDay !== dayISO) setDragOverDay(dayISO);
  };
  const handleDayDragLeave = (dayISO) => {
    setDragOverDay((prev) => (prev === dayISO ? null : prev));
  };
  const handleDayDrop = (e, dayISO) => {
    e.preventDefault();
    setDragOverDay(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const task = tasks.find((tk) => tk._id === taskId);
    if (!task || dayBucketOf(task.deadline) === dayISO) return;
    moveTask(taskId, dayISO);
  };

  const handleSaveDate = (taskId, dayISO) => {
    setPicker(null);
    moveTask(taskId, dayISO);
  };

  const monthLabel = t('tasks.calendar.months')[month];
  const weekdayLabels = t('tasks.calendar.weekdays');

  return (
    <div className="calendar-view">
      <div className="calendar-main">
        <div className="calendar-header">
          <div className="calendar-nav">
            <button type="button" className="btn-icon" onClick={() => goToMonth(-1)} aria-label={t('tasks.calendar.prevMonth')}>
              <HiOutlineChevronLeft />
            </button>
            <h3>{monthLabel} {year}</h3>
            <button type="button" className="btn-icon" onClick={() => goToMonth(1)} aria-label={t('tasks.calendar.nextMonth')}>
              <HiOutlineChevronRight />
            </button>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={goToToday}>{t('tasks.calendar.today')}</button>
        </div>

        <div className="calendar-weekdays">
          {weekdayLabels.map((w) => <div key={w} className="calendar-weekday">{w}</div>)}
        </div>

        <div className="calendar-grid">
          {gridDays.map((d) => {
            const dayISO = toLocalISODate(d);
            const inMonth = d.getMonth() === month;
            const dayTasks = byDay.get(dayISO) || [];
            const isToday = dayISO === todayISO;
            const isExpanded = expandedDays.has(dayISO);
            const visibleTasks = isExpanded ? dayTasks : dayTasks.slice(0, VISIBLE_PER_DAY);
            const hiddenCount = dayTasks.length - visibleTasks.length;

            return (
              <div
                key={dayISO}
                className={[
                  'calendar-day',
                  !inMonth ? 'calendar-day--outside' : '',
                  isToday ? 'calendar-day--today' : '',
                  dragOverDay === dayISO ? 'calendar-day--dragover' : '',
                ].filter(Boolean).join(' ')}
                onDragOver={(e) => handleDayDragOver(e, dayISO)}
                onDragLeave={() => handleDayDragLeave(dayISO)}
                onDrop={(e) => handleDayDrop(e, dayISO)}
              >
                <span className="calendar-day-number">{d.getDate()}</span>
                <div className="calendar-day-pills">
                  {visibleTasks.map((task) => (
                    <TaskPill
                      key={task._id}
                      task={task}
                      draggable={canApproveTask(user, task)}
                      onDragStart={handleDragStart}
                      onOpen={setPicker}
                    />
                  ))}
                  {hiddenCount > 0 && (
                    <button type="button" className="calendar-day-more" onClick={() => toggleExpand(dayISO)}>
                      {t('tasks.calendar.moreCount').replace('{count}', hiddenCount)}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="calendar-side">
        <h3>{t('tasks.calendar.noDeadlineTasks')} <span className="task-column-count">{undated.length}</span></h3>
        {undated.length === 0 ? (
          <p className="task-comment-empty">{t('tasks.calendar.noDeadlineEmpty')}</p>
        ) : (
          <div className="calendar-undated-list">
            {undated.map((task) => (
              <TaskPill
                key={task._id}
                task={task}
                draggable={canApproveTask(user, task)}
                onDragStart={handleDragStart}
                onOpen={setPicker}
              />
            ))}
          </div>
        )}
      </div>

      {picker && (
        <DatePickerModal key={picker._id} task={picker} onClose={() => setPicker(null)} onSave={handleSaveDate} />
      )}
    </div>
  );
};

export default CalendarView;
