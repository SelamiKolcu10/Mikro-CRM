import api from './api';
import { cachedRequest, invalidate, cacheKey, TTL } from '../utils/lookupCache';

const userService = {
  // Kullanıcı listesi birden çok ekranda seçici/liste olarak çekiliyor
  // (Kullanıcı Yönetimi, Erişim Kontrolü, sohbet atama). Parametreler
  // anahtara giriyor: status=approved filtresi ayrı bir giriş olur.
  getAll: (params = {}) =>
    cachedRequest(cacheKey('users', params), () => api.get('/users', { params }), TTL.users),

  // Onay bekleyenler önbelleklenmiyor: kenar çubuğundaki rozetin kaynağı,
  // bayat kalması "onayladım ama sayı düşmedi" izlenimi yaratır.
  getPending: () => api.get('/users/pending'),

  getTree: (id) => api.get(`/users/${id}/tree`),
  getMyProfile: () => api.get('/users/me/profile'),

  create: async (data) => {
    const res = await api.post('/users', data);
    invalidate('users');
    return res;
  },
  approve: async (id, role) => {
    const res = await api.patch(`/users/${id}/approve`, role ? { role } : {});
    invalidate('users');
    return res;
  },
  reject: async (id, reason) => {
    const res = await api.patch(`/users/${id}/reject`, { reason });
    invalidate('users');
    return res;
  },
  updateRole: async (id, role) => {
    const res = await api.patch(`/users/${id}/role`, { role });
    invalidate('users');
    return res;
  },
  updateDepartment: async (id, data) => {
    const res = await api.patch(`/users/${id}/department`, data);
    // Departman değişimi "atanabilir kişiler" listesini de bozar.
    invalidate('users');
    invalidate('tasks:assignableUsers');
    invalidate('projects:eligibleMembers');
    return res;
  },
  delete: async (id) => {
    const res = await api.delete(`/users/${id}`);
    invalidate('users');
    invalidate('tasks:assignableUsers');
    invalidate('projects:eligibleMembers');
    return res;
  },

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
