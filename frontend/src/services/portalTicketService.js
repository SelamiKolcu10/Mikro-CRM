import portalApi from './portalApi';

const portalTicketService = {
  getAll: () => portalApi.get('/feedbacks'),
  getById: (id) => portalApi.get(`/feedbacks/${id}`),
  create: (data) => portalApi.post('/feedbacks', data),
  // Müşterinin kendi başvuruları (Lead) — "Taleplerim"de birlikte gösterilir.
  getMyLeads: () => portalApi.get('/leads'),
};

export default portalTicketService;
