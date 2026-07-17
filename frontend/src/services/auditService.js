import api from './api';

const auditService = {
  getAll: (params = {}) => api.get('/audit-logs', { params }),
  getById: (id) => api.get(`/audit-logs/${id}`),
  verify: () => api.get('/audit-logs/verify'),
  getActors: () => api.get('/audit-logs/actors'),
};

export default auditService;
