import api from './api';

// `api`'nin token interceptor'ı token yoksa hiçbir header eklemez (bkz.
// services/api.js — `if (token)` guard'lı), o yüzden aynı istemci public
// talep formu için de sorunsuz kullanılabilir; ayrı bir "public" axios
// örneğine gerek yok.
const leadService = {
  submit: (payload) => api.post('/leads', payload),
  // Panel (Formlar) — authed, super_admin+staff (bkz. config/permissions.js).
  getAll: () => api.get('/leads'),
  getEvents: (id) => api.get(`/leads/${id}/events`),
  updateStatus: (id, status) => api.patch(`/leads/${id}/status`, { status }),
  addNote: (id, note) => api.post(`/leads/${id}/notes`, { note }),
  assignToMe: (id) => api.patch(`/leads/${id}/assign-to-me`),
};

export default leadService;
