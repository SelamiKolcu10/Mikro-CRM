import { useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import TaskColumn from './TaskColumn';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { canActOnTask, canApproveTask } from '../../utils/taskScope';

const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
const DONE_VISIBLE_DAYS = 7;

function isVisibleOnBoard(task) {
  if (task.status !== 'done') return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DONE_VISIBLE_DAYS);
  return new Date(task.updatedAt) >= cutoff;
}

/**
 * Sürükle-bırak sadece burada yaşar — veri/iş mantığı (useTasks) bu
 * bileşenden tamamen ayrı, DOM'a bağımlı değil (mobil port hedefi).
 */
const TaskBoard = ({ tasks, onStatusChange }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [mobileColumn, setMobileColumn] = useState('todo');

  const visibleTasks = tasks.filter(isVisibleOnBoard);

  const tasksByStatus = STATUSES.reduce((acc, status) => {
    acc[status] = visibleTasks
      .filter((t) => t.status === status)
      .map((t) => ({ ...t, _canAct: canActOnTask(user, t) }));
    return acc;
  }, {});

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    const task = tasks.find((t) => t._id === active.id);
    const targetStatus = over.id;
    if (!task || task.status === targetStatus) return;

    const allowed = targetStatus === 'done' ? canApproveTask(user, task) : canActOnTask(user, task);
    if (!allowed) return;

    onStatusChange(task._id, targetStatus);
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="task-board-mobile-tabs">
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={`filter-chip ${mobileColumn === status ? 'active' : ''}`}
            onClick={() => setMobileColumn(status)}
          >
            {t(`tasks.status.${status}`)} ({tasksByStatus[status].length})
          </button>
        ))}
      </div>
      <div className="task-board">
        {STATUSES.map((status) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            canDropHere={status !== 'done' || canApproveTask(user, { department: user?.department })}
            mobileActive={status === mobileColumn}
          />
        ))}
      </div>
    </DndContext>
  );
};

export default TaskBoard;
