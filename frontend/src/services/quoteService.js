import api from './api';

// Teklif API'si — dealService.js deseni.
const quoteService = {
  getAll: (params) => api.get('/quotes', { params }),
  getById: (id) => api.get(`/quotes/${id}`),
  create: (payload) => api.post('/quotes', payload),
  update: (id, payload) => api.patch(`/quotes/${id}`, payload),
  send: (id) => api.post(`/quotes/${id}/send`),
  revise: (id) => api.post(`/quotes/${id}/revise`),
  delete: (id) => api.delete(`/quotes/${id}`),
  getPdf: (id) => api.get(`/quotes/${id}/pdf`, { responseType: 'blob' }),
};

export default quoteService;
