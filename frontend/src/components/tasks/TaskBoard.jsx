import { useState } from 'react';
import TaskColumn from './TaskColumn';
import TaskDetailModal from './TaskDetailModal';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { canActOnTask, canApproveTask, canCommentOnTask } from '../../utils/taskScope';
import { useTaskComments } from '../../hooks/useTaskComments';

const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
const DONE_VISIBLE_DAYS = 7;

function isVisibleOnBoard(task) {
  if (task.status !== 'done') return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DONE_VISIBLE_DAYS);
  return new Date(task.updatedAt) >= cutoff;
}

/**
 * Karta tıklayınca detay/durum-değiştirme penceresi açılır — veri/iş
 * mantığı (useTasks) bu bileşenden tamamen ayrı, DOM'a bağımlı değil
 * (mobil port hedefi).
 */
const TaskBoard = ({ tasks, onStatusChange }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [mobileColumn, setMobileColumn] = useState('todo');
  const [selectedTask, setSelectedTask] = useState(null);
  const { comments, addComment } = useTaskComments(selectedTask?._id);

  const visibleTasks = tasks.filter(isVisibleOnBoard);

  const tasksByStatus = STATUSES.reduce((acc, status) => {
    acc[status] = visibleTasks.filter((t) => t.status === status);
    return acc;
  }, {});

  return (
    <>
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
            mobileActive={status === mobileColumn}
            onCardClick={setSelectedTask}
          />
        ))}
      </div>
      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={onStatusChange}
        canAct={selectedTask ? canActOnTask(user, selectedTask) : false}
        canApprove={selectedTask ? canApproveTask(user, selectedTask) : false}
        comments={comments}
        onAddComment={addComment}
        canComment={canCommentOnTask(user)}
      />
    </>
  );
};

export default TaskBoard;
