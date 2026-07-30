import api from './api';

// Bildirimler — backend/routes/notificationRoutes.js'in aynası (mobil
// tarafındaki karşılığıyla birebir aynı sözleşme).
//
// Rol kapısı yok, tamamen self-servis: sunucu `recipient`'ı token'dan kurar,
// istemciden almaz. Liste yanıtı `unreadCount`'u da taşır — çan rozeti için
// ayrı bir istek gerekmez.
const notificationService = {
  getAll: (params = {}) => api.get('/notifications', { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export default notificationService;
