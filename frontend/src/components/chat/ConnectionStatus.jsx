import { useSocket } from '../../context/SocketContext';
import { useLanguage } from '../../context/LanguageContext';

// The "hata var mı yok mu" indicator — a simple, always-visible signal of
// whether the live channel is actually up, independent of whether any
// message has failed yet.
const ConnectionStatus = () => {
  const { connected } = useSocket();
  const { t } = useLanguage();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '12px',
        fontWeight: 600,
        color: connected ? 'var(--color-success)' : 'var(--color-danger)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: connected ? 'var(--color-success)' : 'var(--color-danger)',
          boxShadow: connected ? '0 0 6px var(--color-success)' : '0 0 6px var(--color-danger)',
        }}
      />
      {connected ? t('chat.connected') : t('chat.disconnected')}
    </div>
  );
};

export default ConnectionStatus;
