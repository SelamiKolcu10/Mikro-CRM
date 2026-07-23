import api from './api';

// Ürün Kataloğu API'si — dealService.js deseni.
const catalogService = {
  getAll: (params) => api.get('/catalog', { params }),
  getArchived: () => api.get('/catalog', { params: { active: 'false' } }),
  getSalesSummary: () => api.get('/catalog/sales-summary'),
  getById: (id) => api.get(`/catalog/${id}`),
  create: (payload) => api.post('/catalog', payload),
  update: (id, payload) => api.patch(`/catalog/${id}`, payload),
  archive: (id) => api.delete(`/catalog/${id}`),
};

export default catalogService;
