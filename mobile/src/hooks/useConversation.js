import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';

let tempIdCounter = 0;
const nextTempId = () => `temp-${Date.now()}-${tempIdCounter++}`;

/**
 * Mesaj listesi + iyimser gönderim durum makinesi. Web'deki
 * hooks/useConversation.js'in birebir kopyası — o hook zaten bilerek
 * DOM-bağımsız yazılmıştı ("aynı hook bir React Native sohbet ekranını da
 * besleyebilir" notuyla); burada yalnızca import yolu değişti, mantık aynı.
 *
 * @param {string|null} conversationId - bilinene kadar null
 * @param {'internal'|'customer'} viewerType - iyimser balonun hangi tarafa
 *   hizalanacağı için
 * @param {() => Promise} fetchMessages - res.data.data.messages döner
 * @param {(body, clientId) => Promise} sendMessage - res.data.data döner
 * @param {() => Promise} markRead
 */
export function useConversation({ conversationId, viewerType, fetchMessages, sendMessage, markRead }) {
  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Hedef sohbet değiştikçe geçmişi yükle.
  useEffect(() => {
    if (!conversationId) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchMessages()
      .then((res) => {
        if (!cancelled) setMessages(res.data.data.messages);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Canlı teslimat — odaya katıl ve push'ları dinle.
  useEffect(() => {
    if (!socket || !conversationId) return undefined;
    socket.emit('join-conversation', conversationId);

    const handleNew = (message) => {
      if (String(message.conversation) !== String(conversationId)) return;
      setMessages((prev) => {
        // Az önce gönderdiğim mesajın ilk teslimatı (soket REST yanıtını
        // geçti) — iyimser balonu yerinde çöz.
        if (message.clientId && prev.some((m) => m._id === message.clientId)) {
          return prev.map((m) => (m._id === message.clientId ? message : m));
        }
        // REST zaten çözdü (ya da mükerrer teslimat) — atla.
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

  // Sohbeti açmak okundu saymaktır.
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
          setMessages((prev) =>
            prev.map((m) => (m._id === tempId ? { ...m, _pending: false, _failed: true } : m))
          );
        });
    },
    [sendMessage]
  );

  const send = useCallback(
    (body) => {
      const tempId = nextTempId();
      setMessages((prev) => [
        ...prev,
        {
          _id: tempId,
          conversation: conversationId,
          body,
          senderType: viewerType,
          createdAt: new Date().toISOString(),
          _pending: true,
        },
      ]);
      attemptSend(tempId, body);
    },
    [conversationId, viewerType, attemptSend]
  );

  const retry = useCallback(
    (message) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === message._id ? { ...m, _pending: true, _failed: false } : m))
      );
      attemptSend(message._id, message.body);
    },
    [attemptSend]
  );

  return { messages, loading, connected, send, retry };
}
