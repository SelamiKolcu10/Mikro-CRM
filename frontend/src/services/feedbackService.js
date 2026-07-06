import api from './api';

const feedbackService = {
  getAll: (params = {}) => api.get('/feedbacks', { params }),
  getById: (id) => api.get(`/feedbacks/${id}`),
  create: (data) => api.post('/feedbacks', data),
  update: (id, data) => api.put(`/feedbacks/${id}`, data),
  delete: (id) => api.delete(`/feedbacks/${id}`),
  getStats: () => api.get('/feedbacks/stats/summary'),
};

export default feedbackService;
