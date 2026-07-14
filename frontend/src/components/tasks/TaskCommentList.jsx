import { useLanguage } from '../../context/LanguageContext';
import { ROLE_LABELS } from '../../config/permissions';
import { formatDateTime } from '../../utils/formatDate';
import TaskAvatar from './TaskAvatar';

/**
 * Kronolojik yorum akışı — sadece görüntüleme, veri/fetch mantığı
 * hooks/useTaskComments.js'te (mobil port hedefi, bkz. diğer task bileşenleri).
 */
const TaskCommentList = ({ comments }) => {
  const { t, lang } = useLanguage();

  if (!comments || comments.length === 0) {
    return <p className="task-comment-empty">{t('tasks.comments.empty')}</p>;
  }

  return (
    <div className="task-comment-list">
      {comments.map((comment) => (
        <div key={comment._id} className="task-comment-item">
          <TaskAvatar user={comment.user} />
          <div className="task-comment-body">
            <div className="task-comment-meta">
              <span className="task-comment-author">{comment.user?.name}</span>
              {comment.user?.role && (
                <span className="badge badge-role">{t(ROLE_LABELS[comment.user.role])}</span>
              )}
              <span className="task-comment-time">{formatDateTime(comment.createdAt, lang)}</span>
            </div>
            <p className="task-comment-text">{comment.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TaskCommentList;
