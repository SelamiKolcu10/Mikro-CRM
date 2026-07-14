import { useLanguage } from '../../context/LanguageContext';
import { ROLE_LABELS, DEPARTMENT_LABELS } from '../../config/permissions';
import { formatDate } from '../../utils/formatDate';
import Modal from '../common/Modal';
import TaskAvatar from './TaskAvatar';
import TaskCommentList from './TaskCommentList';
import TaskCommentInput from './TaskCommentInput';

const PRIORITY_CLASS = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };
const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];

/**
 * Karta tıklayınca açılır — görev detayları + geçilebilecek durumlar için
 * butonlar + aktivite/yorum akışı. Yetki kontrolü (canAct/canApprove/
 * canComment) ve yorum verisi (comments/onAddComment) TaskBoard'dan hazır
 * gelir, burası sadece görüntüleme + tıklama.
 */
const TaskDetailModal = ({
  task,
  isOpen,
  onClose,
  onStatusChange,
  canAct,
  canApprove,
  comments = [],
  onAddComment,
  canComment,
}) => {
  const { t, lang } = useLanguage();

  if (!task) return null;

  const handleSelect = (status) => {
    onStatusChange(task._id, status);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task.title}>
      <div className="task-detail-meta">
        <span className={`badge ${PRIORITY_CLASS[task.priority]}`}>{t(`tasks.priority.${task.priority}`)}</span>
        <span className="pill pill-department">{t(DEPARTMENT_LABELS[task.department])}</span>
        {task.projectId?.name && <span className="pill pill-project">{task.projectId.name}</span>}
        <span className="task-card-assignee">
          <TaskAvatar user={task.assignedTo} />
          {task.assignedTo?.name}
          {task.assignedTo?.role && (
            <span className="badge badge-role">{t(ROLE_LABELS[task.assignedTo.role])}</span>
          )}
        </span>
      </div>

      {task.description && <p className="task-detail-description">{task.description}</p>}
      {task.deadline && <p className="task-detail-deadline">{formatDate(task.deadline, lang)}</p>}

      {(() => {
        const availableStatuses = STATUSES.filter((status) => {
          if (status === task.status) return false;
          return status === 'done' ? canApprove : canAct;
        });
        if (availableStatuses.length === 0) return null;
        return (
          <div>
            <span className="form-label">{t('tasks.detail.moveTo')}</span>
            <div className="task-detail-status-buttons">
              {availableStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleSelect(status)}
                >
                  {t(`tasks.status.${status}`)}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="task-comments-section">
        <span className="form-label">{t('tasks.comments.title')}</span>
        <TaskCommentList comments={comments} />
        {canComment && <TaskCommentInput onSubmit={onAddComment} />}
      </div>
    </Modal>
  );
};

export default TaskDetailModal;
