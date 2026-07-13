import { useDroppable } from '@dnd-kit/core';
import { useLanguage } from '../../context/LanguageContext';
import TaskCard from './TaskCard';

const TaskColumn = ({ status, tasks, canDropHere, mobileActive }) => {
  const { t } = useLanguage();
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !canDropHere });

  return (
    <div
      ref={setNodeRef}
      className={`task-column ${isOver && canDropHere ? 'task-column-over' : ''} ${mobileActive ? 'task-column-mobile-active' : ''}`}
    >
      <h3>{t(`tasks.status.${status}`)} <span className="task-column-count">{tasks.length}</span></h3>
      <div className="task-column-body">
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} draggable={task._canAct} />
        ))}
      </div>
    </div>
  );
};

export default TaskColumn;
