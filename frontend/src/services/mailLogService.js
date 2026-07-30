import api from './api';

// Giden e-posta kayıtları — yalnız super_admin (bkz. routes/mailLogRoutes.js).
// Liste yanıtı `config` de taşır: { enabled, provider } — arayüz hattın o anki
// modunu (kapalı / deneme / canlı) buradan yazıyor.
const mailLogService = {
  getAll: (params = {}) => api.get('/mail-logs', { params }),
  getById: (id) => api.get(`/mail-logs/${id}`),
};

export default mailLogService;
