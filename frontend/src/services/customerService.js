import api from './api';

const customerService = {
  getAll: (params = {}) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  grantPortalAccess: (id) => api.post(`/customers/${id}/portal-access`),
  disablePortalAccess: (id) => api.patch(`/customers/${id}/portal-access/disable`),
};

export default customerService;
