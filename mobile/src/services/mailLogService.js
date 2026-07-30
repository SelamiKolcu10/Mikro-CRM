import api from './api';

// Giden e-posta kayıtları — yalnız super_admin (backend routes/mailLogRoutes.js).
// Liste yanıtı `config: { enabled, provider }` de taşır: arayüz hattın o anki
// modunu (kapalı / deneme / canlı) buradan yazıyor.
//
// Önbelleğe ALINMADI: bu ekranın tek işi "az önce ne gitti" sorusuna cevap
// vermek, bayat görünmesi amacını bozar.
const mailLogService = {
  getAll: (params = {}) => api.get('/mail-logs', { params }),
  getById: (id) => api.get(`/mail-logs/${id}`),
};

export default mailLogService;
