import api from './api';

// Satış Pipeline API'si — leadService.js deseni. Tüm route'lar authed
// (deals.read/write); intern backend'de 403 alır (frontend'de menü zaten gizli).
const dealService = {
  getAll: () => api.get('/deals'),
  getEvents: (id) => api.get(`/deals/${id}/events`),
  create: (payload) => api.post('/deals', payload),
  // Sürükle-bırak: expectedVersion (istemcinin gördüğü __v) çakışma korumasıdır
  // — uyuşmazsa backend 409 döner (bkz. dealController.updateDealStage).
  updateStage: (id, stage, expectedVersion, lostReason) =>
    api.patch(`/deals/${id}/stage`, { stage, expectedVersion, lostReason }),
  update: (id, payload) => api.patch(`/deals/${id}`, payload),
  addNote: (id, note) => api.post(`/deals/${id}/notes`, { note }),
  // Lead → Deal dönüşümü lead endpoint'inde yaşıyor (Customer + Deal oluşturur).
  convertLead: (leadId, payload) => api.post(`/leads/${leadId}/convert`, payload),
};

export default dealService;
