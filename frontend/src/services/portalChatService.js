import portalApi from './portalApi';

const portalChatService = {
  getMessages: () => portalApi.get('/chat/messages'),
  sendMessage: (body, clientId) => portalApi.post('/chat/messages', { body, clientId }),
  markRead: () => portalApi.patch('/chat/read'),
  submitRating: (score) => portalApi.post('/chat/rating', { score }),
};

export default portalChatService;
