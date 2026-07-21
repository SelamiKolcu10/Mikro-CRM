import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useConversation } from '../../hooks/useConversation';
import portalChatService from '../../services/portalChatService';
import ConnectionStatus from '../../components/chat/ConnectionStatus';
import MessageBubble from '../../components/chat/MessageBubble';
import MessageInput from '../../components/chat/MessageInput';
import toast from 'react-hot-toast';

const PortalChat = () => {
  const { t } = useLanguage();
  const [conversationId, setConversationId] = useState(null);
  const [resolving, setResolving] = useState(true);
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
        <MessageInput onSend={send} />
      </div>
    </>
  );
};

export default PortalChat;
