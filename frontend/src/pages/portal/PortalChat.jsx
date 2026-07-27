import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useConversation } from '../../hooks/useConversation';
import portalChatService from '../../services/portalChatService';
import ConnectionStatus from '../../components/chat/ConnectionStatus';
import MessageBubble from '../../components/chat/MessageBubble';
import MessageInput from '../../components/chat/MessageInput';
import { HiStar, HiOutlineStar } from 'react-icons/hi';
import toast from 'react-hot-toast';

const STAR_VALUES = [1, 2, 3, 4, 5];

const PortalChat = () => {
  const { t } = useLanguage();
  const [conversationId, setConversationId] = useState(null);
  const [resolving, setResolving] = useState(true);
  const [hoverStar, setHoverStar] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const scrollRef = useRef(null);

  // A customer has exactly one conversation, lazily created server-side —
  // resolve its id once via REST rather than waiting on the socket, so the
  // page works the instant it loads regardless of connection timing.
  useEffect(() => {
    portalChatService
      .getMessages()
      .then((res) => setConversationId(res.data.data.conversation._id))
      .catch(() => toast.error(t('common.loadError')))
      .finally(() => setResolving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { messages, loading, send, retry } = useConversation({
    conversationId,
    viewerType: 'customer',
    fetchMessages: useCallback(() => portalChatService.getMessages(), []),
    sendMessage: useCallback((body, clientId) => portalChatService.sendMessage(body, clientId), []),
    markRead: useCallback(() => portalChatService.markRead(), []),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Her zaman erişilebilir, sessiz bir widget — periyodik açılan bir modal
  // değil. Bir yıldıza tıklayınca anında gönderilir, ayrı bir submit butonu
  // yok (bkz. backend/controllers/portalChatController.js:submitRating).
  const handleRate = async (score) => {
    if (submittingRating) return;
    setSubmittingRating(true);
    try {
      await portalChatService.submitRating(score);
      toast.success(t('chat.ratingSubmitted'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSubmittingRating(false);
    }
  };

  if (resolving) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('chat.portalTitle')}</h1>
          <p>{t('chat.portalSubtitle')}</p>
        </div>
        <ConnectionStatus />
      </div>

      <div className="table-container" style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)' }}>
          {!loading && messages.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>{t('chat.noMessages')}</p>
          )}
          {messages.map((m) => (
            <MessageBubble key={m._id} message={m} isMine={m.senderType === 'customer'} onRetry={retry} />
          ))}
        </div>
        <div className="chat-rating-widget">
          <span className="chat-rating-widget-label">{t('chat.rateUs')}</span>
          <div className="chat-rating-widget-stars" onMouseLeave={() => setHoverStar(0)}>
            {STAR_VALUES.map((v) => (
              <button
                key={v}
                type="button"
                className="chat-rating-star-btn"
                disabled={submittingRating}
                onMouseEnter={() => setHoverStar(v)}
                onClick={() => handleRate(v)}
                aria-label={`${v}/5`}
              >
                {v <= hoverStar ? <HiStar /> : <HiOutlineStar />}
              </button>
            ))}
          </div>
        </div>
        <MessageInput onSend={send} />
      </div>
    </>
  );
};

export default PortalChat;
