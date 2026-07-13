import { useLanguage } from '../../context/LanguageContext';
import { ROLE_LABELS } from '../../config/permissions';
import Modal from '../common/Modal';
import TaskAvatar from './TaskAvatar';

const PRIORITY_CLASS = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };
const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];

/**
 * Karta tıklayınca açılır — görev detayları + geçilebilecek durumlar için
 * butonlar. Yetki kontrolü (canAct/canApprove) TaskBoard'dan hazır gelir,
 * burası sadece görüntüleme + tıklama.
 */
const TaskDetailModal = ({ task, isOpen, onClose, onStatusChange, canAct, canApprove }) => {
  const { t } = useLanguage();

  if (!task) return null;

  const handleSelect = (status) => {
    onStatusChange(task._id, status);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task.title}>
      <div className="task-detail-meta">
        <span className={`badge ${PRIORITY_CLASS[task.priority]}`}>{t(`tasks.priority.${task.priority}`)}</span>
        <span className="task-card-assignee">
          <TaskAvatar user={task.assignedTo} />
          {task.assignedTo?.name}
          {task.assignedTo?.role && (
            <span className="badge badge-role">{t(ROLE_LABELS[task.assignedTo.role])}</span>
          )}
        </span>
      </div>

      {task.description && <p className="task-detail-description">{task.description}</p>}
      {task.deadline && <p className="task-detail-deadline">{new Date(task.deadline).toLocaleDateString()}</p>}

      <div>
        <span className="form-label">{t('tasks.detail.moveTo')}</span>
        <div className="task-detail-status-buttons">
          {STATUSES.filter((status) => status !== task.status).map((status) => {
            const allowed = status === 'done' ? canApprove : canAct;
            return (
              <button
                key={status}
                type="button"
                className="btn btn-secondary"
                disabled={!allowed}
                onClick={() => handleSelect(status)}
              >
                {t(`tasks.status.${status}`)}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

export default TaskDetailModal;
