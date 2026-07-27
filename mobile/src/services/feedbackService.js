import api from './api';

// Geri Bildirim API'si — web'deki feedbackService.js ile aynı uçlar.
// Liste → res.data.data (dizi), sayfalama res.data.pagination altında.
// Not: create/update/delete onay kuyruğuna düşebilir; o durumda backend
// res.data.pending = true döner (kayıt henüz uygulanmamıştır).
const feedbackService = {
  getAll: (params = {}) => api.get('/feedbacks', { params }),
  getById: (id) => api.get(`/feedbacks/${id}`),
  create: (payload) => api.post('/feedbacks', payload),
  update: (id, payload) => api.put(`/feedbacks/${id}`, payload),
  delete: (id) => api.delete(`/feedbacks/${id}`),
  getStats: () => api.get('/feedbacks/stats/summary'),
};

export default feedbackService;
