import api from './api';

const knowledgeBaseService = {
  getAll: (params = {}) => api.get('/knowledge-base', { params }),
  getById: (id) => api.get(`/knowledge-base/${id}`),
  create: (data) => api.post('/knowledge-base', data),
  update: (id, data) => api.put(`/knowledge-base/${id}`, data),
  delete: (id) => api.delete(`/knowledge-base/${id}`),
};

export default knowledgeBaseService;
