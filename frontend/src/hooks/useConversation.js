import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';

let tempIdCounter = 0;
const nextTempId = () => `temp-${Date.now()}-${tempIdCounter++}`;

/**
 * Shared message-list + optimistic-send state machine for both the staff
 * ChatDashboard and the customer PortalChat. Deliberately DOM-agnostic (no
 * JSX, nothing browser-only beyond the socket) per this project's mobile-
 * portability convention — the same hook could back a React Native chat
 * screen without rewriting the send/retry logic, only the UI around it.
 *
 * @param {string|null} conversationId - null until known (the portal side
 *   resolves its own conversation id asynchronously via the socket's
 *   `conversation:init` event)
 * @param {'internal'|'customer'} viewerType - which side of the chat this is,
 *   so optimistic (not-yet-confirmed) messages render on the right side
 *   immediately instead of waiting for the server's senderType to come back
 * @param {() => Promise} fetchMessages - resolves { data: { data: { messages } } }
 * @param {(body: string) => Promise} sendMessage - resolves { data: { data: message } }
 * @param {() => Promise} markRead
 */
export function useConversation({ conversationId, viewerType, fetchMessages, sendMessage, markRead }) {
  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load history whenever the target conversation changes.
  useEffect(() => {
    if (!conversationId) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchMessages()
      .then((res) => {
        if (!cancelled) setMessages(res.data.data.messages);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Live delivery — join the room (internal only; the portal side is
  // auto-joined by the server on connect) and listen for pushes.
  useEffect(() => {
    if (!socket || !conversationId) return undefined;
    socket.emit('join-conversation', conversationId);

    const handleNew = (message) => {
      if (String(message.conversation) !== String(conversationId)) return;
      setMessages((prev) => {
        // First delivery of a message I just sent (socket beat the REST
        // response back) — resolve the optimistic bubble in place.
        if (message.clientId && prev.some((m) => m._id === message.clientId)) {
          return prev.map((m) => (m._id === message.clientId ? message : m));
        }
        // Already resolved by REST (or a duplicate delivery) — skip.
        if (prev.some((m) => m._id === message._id)) return prev;
        return [...prev, message];
      });
    };
    socket.on('message:new', handleNew);

    return () => {
      socket.emit('leave-conversation', conversationId);
      socket.off('message:new', handleNew);
    };
  }, [socket, conversationId]);

  // Opening/switching to a conversation counts as reading it.
  useEffect(() => {
    if (!conversationId) return;
    markRead().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const attemptSend = useCallback(
    (tempId, body) => {
      sendMessage(body, tempId)
        .then((res) => {
          setMessages((prev) => prev.map((m) => (m._id === tempId ? res.data.data : m)));
        })
        .catch(() => {
          setMessages((prev) => prev.map((m) => (m._id === tempId ? { ...m, _pending: false, _failed: true } : m)));
        });
    },
    [sendMessage]
  );

  const send = useCallback(
    (body) => {
      const tempId = nextTempId();
      setMessages((prev) => [
        ...prev,
        { _id: tempId, conversation: conversationId, body, senderType: viewerType, createdAt: new Date().toISOString(), _pending: true },
      ]);
      attemptSend(tempId, body);
    },
    [conversationId, viewerType, attemptSend]
  );

  const retry = useCallback(
    (message) => {
      setMessages((prev) => prev.map((m) => (m._id === message._id ? { ...m, _pending: true, _failed: false } : m)));
      attemptSend(message._id, message.body);
    },
    [attemptSend]
  );

  return { messages, loading, connected, send, retry };
}
