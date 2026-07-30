import api from './api';
import { cachedRequest, invalidate, cacheKey, TTL } from '../utils/lookupCache';

// Ürün Kataloğu API'si — web'deki catalogService.js ile birebir aynı uçlar.
// Liste/arşiv/satış özeti → res.data.data (düz dizi).
// Silme YOK: archive() ürünü active:false yapar (soft-arşiv).
const catalogService = {
  getAll: (params = {}) =>
    cachedRequest(cacheKey('catalog', params), () => api.get('/catalog', { params }), TTL.catalog),
  getArchived: () =>
    cachedRequest('catalog:archived', () => api.get('/catalog', { params: { active: 'false' } }), TTL.catalog),
  getSalesSummary: () => api.get('/catalog/sales-summary'),
  getById: (id) => api.get(`/catalog/${id}`),
  create: async (payload) => {
    const res = await api.post('/catalog', payload);
    invalidate('catalog');
    return res;
  },
  update: async (id, payload) => {
    const res = await api.patch(`/catalog/${id}`, payload);
    invalidate('catalog');
    return res;
  },
  archive: async (id) => {
    const res = await api.delete(`/catalog/${id}`);
    invalidate('catalog');
    return res;
  },
};

export default catalogService;
