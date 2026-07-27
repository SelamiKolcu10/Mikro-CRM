import api from './api';

// Canlı sohbet — web'deki chatService.js ile aynı uçlar.
// getConversations → res.data.data: her satır bir MÜŞTERİ (henüz sohbeti
// olmayanlar dahil, o durumda _id null gelir ve ilk açılışta lazily oluşur).
const chatService = {
  getConversations: () => api.get('/chat/conversations'),
  getEscalations: () => api.get('/chat/escalations'),
  startConversation: (customerId) => api.post('/chat/conversations/start', { customerId }),
  getMessages: (conversationId) => api.get(`/chat/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, body, clientId) =>
    api.post(`/chat/conversations/${conversationId}/messages`, { body, clientId }),
  addNote: (conversationId, body) => api.post(`/chat/conversations/${conversationId}/notes`, { body }),
  markRead: (conversationId) => api.patch(`/chat/conversations/${conversationId}/read`),
  assign: (conversationId, userId) => api.patch(`/chat/conversations/${conversationId}/assign`, { userId }),
};

export default chatService;
