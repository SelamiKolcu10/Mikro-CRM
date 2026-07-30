import api from './api';

// Denetim kaydı — backend/routes/auditRoutes.js'in aynası.
//
// Okuma super_admin + intern'e açık, ama intern'de aktör kimliği hem çıktıda
// maskelenir hem de sorgudan düşürülür (aksi halde sonuç sayısı bir
// "bu e-postanın kaydı var mı" oracle'ına dönerdi). Aktör listesi ucu bu
// yüzden yalnız super_admin'e açık.
const auditService = {
  getAll: (params = {}) => api.get('/audit-logs', { params }),
  getById: (id) => api.get(`/audit-logs/${id}`),

  // Hash zincirini baştan yürüyüp bütünlüğü doğrular:
  // { intact, totalChecked, checkedAt, brokenAtSequence? }
  verify: () => api.get('/audit-logs/verify'),

  // Yalnız super_admin — intern çağırırsa 403.
  getActors: () => api.get('/audit-logs/actors'),
};

export default auditService;
