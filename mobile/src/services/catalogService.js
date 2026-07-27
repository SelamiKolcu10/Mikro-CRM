import api from './api';

// Ürün Kataloğu API'si — web'deki catalogService.js ile birebir aynı uçlar.
// Liste/arşiv/satış özeti → res.data.data (düz dizi).
// Silme YOK: archive() ürünü active:false yapar (soft-arşiv).
const catalogService = {
  getAll: (params = {}) => api.get('/catalog', { params }),
  getArchived: () => api.get('/catalog', { params: { active: 'false' } }),
  getSalesSummary: () => api.get('/catalog/sales-summary'),
  getById: (id) => api.get(`/catalog/${id}`),
  create: (payload) => api.post('/catalog', payload),
  update: (id, payload) => api.patch(`/catalog/${id}`, payload),
  archive: (id) => api.delete(`/catalog/${id}`),
};

export default catalogService;
