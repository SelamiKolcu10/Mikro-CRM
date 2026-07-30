import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineBell, HiOutlineCheck } from 'react-icons/hi';
import { useNotifications } from '../../context/NotificationContext';
import { useLanguage } from '../../context/LanguageContext';

// Bildirim türü → ikon rengi sınıfı. Tür backend Notification.type enum'ından
// gelir; tanınmayan tür nötr görünür (yeni tür eklenince arayüz patlamasın).
const TYPE_CLASS = {
  TASK_ASSIGNED: 'notif-icon--task',
  TASK_STATUS_CHANGED: 'notif-icon--task',
  TASK_COMMENT: 'notif-icon--task',
  APPROVAL_DECIDED: 'notif-icon--approval',
  QUOTE_EVENT: 'notif-icon--quote',
};

const timeAgo = (date, t) => {
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return t('notifications.justNow');
  if (mins < 60) return t('notifications.minutesAgo').replace('{n}', mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('notifications.hoursAgo').replace('{n}', hours);
  const days = Math.floor(hours / 24);
  if (days < 30) return t('notifications.daysAgo').replace('{n}', days);
  return new Date(then).toLocaleDateString();
};

/**
 * Navbar'daki bildirim çanı + açılır liste.
 *
 * Panel `position: absolute` ile navbar'a göre konumlanıyor; Navbar
 * `.page-container .page-enter` DIŞINDA olduğu için o kabın transform'una
 * takılmıyor (bkz. tasarım notu: sayfa geçiş animasyonu fixed/absolute
 * öğeleri hapsediyor — bu yüzden modaller portal'a taşınmıştı).
 */
const NotificationBell = () => {
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Dışa tıklama + Esc ile kapanma.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = (item) => {
    if (!item.isRead) markRead(item._id);
    // Web'de `link` doğrudan kullanılabilir — backend onu web yolu olarak
    // üretiyor (ör. '/tasks?id=...'). Mobil tarafta bu ayrıştırılmaz, orada
    // türden hedefe eşleme yapılır.
    if (item.link) {
      setOpen(false);
      navigate(item.link);
    }
  };

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className="btn-icon notif-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('notifications.title')}
        aria-expanded={open}
      >
        <HiOutlineBell />
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label={t('notifications.title')}>
          <div className="notif-panel-head">
            <span className="notif-panel-title">{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <button type="button" className="notif-read-all" onClick={markAllRead}>
                <HiOutlineCheck /> {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          <div className="notif-list">
            {items.length === 0 ? (
              <p className="notif-empty">{t('notifications.empty')}</p>
            ) : (
              items.map((n) => (
                <button
                  type="button"
                  key={n._id}
                  className={`notif-item ${n.isRead ? '' : 'notif-item--unread'}`}
                  onClick={() => openItem(n)}
                >
                  <span className={`notif-icon ${TYPE_CLASS[n.type] || ''}`}>
                    <HiOutlineBell />
                  </span>
                  <span className="notif-body">
                    <span className="notif-title">{n.title}</span>
                    <span className="notif-message">{n.message}</span>
                    <span className="notif-time">{timeAgo(n.createdAt, t)}</span>
                  </span>
                  {!n.isRead && <span className="notif-dot" aria-hidden="true" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
