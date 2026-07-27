import api from './api';

// Formlar (Lead) paneli — web'deki leadService.js ile aynı uçlar.
// Liste → res.data.data. Public talep formu (POST /leads) mobilde yok.
const leadService = {
  getAll: () => api.get('/leads'),
  getEvents: (id) => api.get(`/leads/${id}/events`),
  updateStatus: (id, status) => api.patch(`/leads/${id}/status`, { status }),
  addNote: (id, note) => api.post(`/leads/${id}/notes`, { note }),
  // assigneeId opsiyonel — yalnız departmana atama da geçerli.
  assign: (id, department, assigneeId) =>
    api.patch(`/leads/${id}/assign`, { department, assigneeId: assigneeId || undefined }),
  // Lead → Deal: backend Customer'ı (yoksa) oluşturup Deal açar.
  convert: (id, payload) => api.post(`/leads/${id}/convert`, payload),
};

export default leadService;
