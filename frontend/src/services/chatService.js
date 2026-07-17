import api from './api';

const chatService = {
  getConversations: () => api.get('/chat/conversations'),
  getEscalations: () => api.get('/chat/escalations'),
  startConversation: (customerId) => api.post('/chat/conversations/start', { customerId }),
  getMessages: (conversationId) => api.get(`/chat/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, body, clientId) => api.post(`/chat/conversations/${conversationId}/messages`, { body, clientId }),
  markRead: (conversationId) => api.patch(`/chat/conversations/${conversationId}/read`),
  assign: (conversationId, userId) => api.patch(`/chat/conversations/${conversationId}/assign`, { userId }),
};

export default chatService;
