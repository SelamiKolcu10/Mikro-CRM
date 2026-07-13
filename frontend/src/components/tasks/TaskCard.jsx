import { useLanguage } from '../../context/LanguageContext';
import { ROLE_LABELS } from '../../config/permissions';
import TaskAvatar from './TaskAvatar';

const PRIORITY_CLASS = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };

const TaskCard = ({ task, onClick }) => {
  const { t } = useLanguage();

  return (
    <div className="task-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="task-card-header">
        <span className={`badge ${PRIORITY_CLASS[task.priority]}`}>{t(`tasks.priority.${task.priority}`)}</span>
      </div>
      <h4>{task.title}</h4>
      {task.description && <p className="task-card-description">{task.description}</p>}
      <div className="task-card-footer">
        <span className="task-card-assignee">
          <TaskAvatar user={task.assignedTo} />
          {task.assignedTo?.name}
          {task.assignedTo?.role && (
            <span className="badge badge-role">{t(ROLE_LABELS[task.assignedTo.role])}</span>
          )}
        </span>
        {task.deadline && <span>{new Date(task.deadline).toLocaleDateString()}</span>}
      </div>
    </div>
  );
};

export default TaskCard;
