import api from './api';

// Bildirimler — backend/routes/notificationRoutes.js'in aynası.
//
// Rol kapısı yok, tamamen self-servis: her istek oturum sahibinin kendi
// bildirimlerine gider (sunucu recipient'ı token'dan kurar, istemciden almaz).
// Liste yanıtı `unreadCount`'u da taşır — çan rozeti için ayrı istek gerekmez.
const notificationService = {
  getAll: (params = {}) => api.get('/notifications', { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export default notificationService;
