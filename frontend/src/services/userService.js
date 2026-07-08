import api from './api';

const userService = {
  create: (data) => api.post('/users', data),
  getAll: (params = {}) => api.get('/users', { params }),
  getPending: () => api.get('/users/pending'),
  approve: (id, role) => api.patch(`/users/${id}/approve`, role ? { role } : {}),
  reject: (id, reason) => api.patch(`/users/${id}/reject`, { reason }),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  delete: (id) => api.delete(`/users/${id}`),
};

export default userService;
