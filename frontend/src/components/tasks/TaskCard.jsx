import { useLanguage } from '../../context/LanguageContext';
import { ROLE_LABELS, DEPARTMENT_LABELS } from '../../config/permissions';
import { formatDate } from '../../utils/formatDate';
import TaskAvatar from './TaskAvatar';

const PRIORITY_CLASS = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };

const TaskCard = ({ task, onClick }) => {
  const { t, lang } = useLanguage();

  return (
    <div className="task-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="task-card-header">
        <span className={`badge ${PRIORITY_CLASS[task.priority]}`}>{t(`tasks.priority.${task.priority}`)}</span>
        <span className="pill pill-department">{t(DEPARTMENT_LABELS[task.department])}</span>
        {task.projectId?.name && <span className="pill pill-project">{task.projectId.name}</span>}
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
        {task.deadline && <span>{formatDate(task.deadline, lang)}</span>}
      </div>
    </div>
  );
};

export default TaskCard;
