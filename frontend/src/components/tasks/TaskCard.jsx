import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useLanguage } from '../../context/LanguageContext';

const PRIORITY_CLASS = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };

const TaskCard = ({ task, draggable }) => {
  const { t } = useLanguage();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task._id,
    disabled: !draggable,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: draggable ? 'grab' : 'default',
  };

  return (
    <div ref={setNodeRef} style={style} {...(draggable ? listeners : {})} {...(draggable ? attributes : {})} className="task-card">
      <div className="task-card-header">
        <span className={`badge ${PRIORITY_CLASS[task.priority]}`}>{t(`tasks.priority.${task.priority}`)}</span>
      </div>
      <h4>{task.title}</h4>
      {task.description && <p className="task-card-description">{task.description}</p>}
      <div className="task-card-footer">
        <span>{task.assignedTo?.name}</span>
        {task.deadline && <span>{new Date(task.deadline).toLocaleDateString()}</span>}
      </div>
    </div>
  );
};

export default TaskCard;
