import api from './api';

// Onay kuyruğu — backend/routes/approvalRoutes.js'in aynası.
//
// Kuyruğa düşen kayıtlar authorizeOrQueue tarafından üretilir: kullanıcı
// kendi rolüyle değil, verilmiş bir PermissionOverride ile işlem yaptığında
// yazma isteği controller'a gitmeden buraya alınır ve ancak bir super_admin
// onaylarsa gerçekten uygulanır.
//
// Okuma intern'e de açık (e-postalar maskeli); onaylama/reddetme yalnız
// super_admin (PERMISSIONS.approvals.review).
const approvalService = {
  getAll: (params = {}) => api.get('/approvals', { params }),
  getMine: () => api.get('/approvals/mine'),

  // Dikkat: approve her zaman "approved" dönmez — hedef kayıt istek
  // yapıldıktan sonra değiştiyse sonuç "conflict" olur ve işlem uygulanmaz.
  approve: (id) => api.patch(`/approvals/${id}/approve`),
  reject: (id, reason) => api.patch(`/approvals/${id}/reject`, { reason }),
};

export default approvalService;
