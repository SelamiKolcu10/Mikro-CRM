import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../config/permissions';
import { formatTime } from '../../utils/formatDate';
import TaskAvatar from '../tasks/TaskAvatar';
import TaskCommentInput from '../tasks/TaskCommentInput';

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Proje Odası — departman lideri + ekip üyelerinin projeyle ilgili yazıştığı
 * sohbet görünümü (bkz. design-direction dokümanına ek: "Kapsül & Halka"
 * dilini bozmadan chat-bubble deseni). Bilerek sahte bir "çevrimiçi" göstergesi
 * yok — gerçek bir presence/socket takibi olmadan yeşil nokta yanıltıcı olurdu;
 * bu yüzden sadece oda adı + mesaj akışı var, canlı anlamda socket push değil.
 */
const ProjectChatRoom = ({ project, comments, canComment, onSubmit }) => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  return (
    <div className="project-chat-room">
      <div className="project-chat-room-header">
        <span className="project-chat-room-name">#{slugify(project.name)}</span>
      </div>

      <div className="project-chat-messages">
        {comments.length === 0 ? (
          <p className="task-comment-empty">{t('projects.drawer.discussionEmpty')}</p>
        ) : (
          comments.map((comment) => {
            const senderId = comment.user?._id || comment.user;
            const isMine = senderId === user._id;
            return (
              <div key={comment._id} className={`project-chat-row ${isMine ? 'is-mine' : ''}`}>
                {!isMine && <TaskAvatar user={comment.user} />}
                <div className="project-chat-bubble">
                  {!isMine && (
                    <div className="project-chat-sender">
                      <span>{comment.user?.name}</span>
                      {comment.user?.role && (
                        <span className="badge badge-role">{t(ROLE_LABELS[comment.user.role])}</span>
                      )}
                    </div>
                  )}
                  <div className="project-chat-text">{comment.text}</div>
                  <div className="project-chat-time">{formatTime(comment.createdAt, lang)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canComment && <TaskCommentInput onSubmit={onSubmit} />}
    </div>
  );
};

export default ProjectChatRoom;
