import api from './api';

const userService = {
  create: (data) => api.post('/users', data),
  getAll: (params = {}) => api.get('/users', { params }),
  getPending: () => api.get('/users/pending'),
  approve: (id, role) => api.patch(`/users/${id}/approve`, role ? { role } : {}),
  reject: (id, reason) => api.patch(`/users/${id}/reject`, { reason }),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  updateDepartment: (id, data) => api.patch(`/users/${id}/department`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getTree: (id) => api.get(`/users/${id}/tree`),
  getMyProfile: () => api.get('/users/me/profile'),
  updateMyContactInfo: (data) => api.patch('/users/me/profile', data),
  // Content-Type başlığı BİLEREK verilmiyor — axios, FormData gövdesini
  // görünce doğru multipart boundary'yi kendisi ekliyor; elle 'multipart/
  // form-data' yazmak boundary'siz kalıp multer'ın parse'ını bozar.
  uploadMyAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/users/me/avatar', formData);
  },
};

export default userService;
