import { HiOutlineRefresh, HiOutlineExclamationCircle } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';

const formatTime = (iso) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

const MessageBubble = ({ message, isMine, onRetry }) => {
  const { t } = useLanguage();

  return (
    <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 'var(--space-sm)' }}>
      <div
        style={{
          maxWidth: '70%',
          padding: '8px 12px',
          borderRadius: 'var(--radius-md)',
          background: isMine ? 'var(--accent-primary)' : 'var(--bg-card)',
          border: isMine ? 'none' : '1px solid var(--border-color)',
          color: isMine ? '#fff' : 'var(--text-primary)',
          opacity: message._pending ? 0.6 : 1,
        }}
      >
        {!isMine && (
          <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: 2, color: 'var(--accent-primary-hover)' }}>
            {message.senderName}
          </div>
        )}
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '14px' }}>{message.body}</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
            fontSize: '10px',
            color: isMine ? 'rgba(255,255,255,0.75)' : 'var(--text-tertiary)',
            justifyContent: 'flex-end',
          }}
        >
          {message._failed ? (
            <button
              type="button"
              onClick={() => onRetry(message)}
              style={{
                display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--color-danger)', fontSize: '11px', fontWeight: 600, padding: 0,
              }}
              title={t('chat.sendFailed')}
            >
              <HiOutlineExclamationCircle /> {t('chat.retry')} <HiOutlineRefresh />
            </button>
          ) : (
            <span>{message._pending ? '…' : formatTime(message.createdAt)}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
