import portalApi from './portalApi';

const portalTicketService = {
  getAll: () => portalApi.get('/feedbacks'),
  getById: (id) => portalApi.get(`/feedbacks/${id}`),
  create: (data) => portalApi.post('/feedbacks', data),
};

export default portalTicketService;
