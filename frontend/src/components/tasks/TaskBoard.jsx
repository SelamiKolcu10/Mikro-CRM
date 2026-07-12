import { DndContext } from '@dnd-kit/core';
import TaskColumn from './TaskColumn';
import { useAuth } from '../../context/AuthContext';
import { canActOnTask, canApproveTask } from '../../utils/taskScope';

const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];

/**
 * Sürükle-bırak sadece burada yaşar — veri/iş mantığı (useTasks) bu
 * bileşenden tamamen ayrı, DOM'a bağımlı değil (mobil port hedefi).
 */
const TaskBoard = ({ tasks, onStatusChange }) => {
  const { user } = useAuth();

  const tasksByStatus = STATUSES.reduce((acc, status) => {
    acc[status] = tasks
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
      <div className="task-board">
        {STATUSES.map((status) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            canDropHere={status !== 'done' || canApproveTask(user, { department: user?.department })}
          />
        ))}
      </div>
    </DndContext>
  );
};

export default TaskBoard;
