import api from './api';

// Rol matrisinin ÜSTÜNE eklenen geçici yetkiler (backend
// models/PermissionOverride.js) — statik rolün yerine geçmez, yalnız ekler.
//
// Okuma super_admin + intern'e açık (e-postalar intern'e maskeli gelir),
// verme/geri alma yalnız super_admin — aksi halde kullanıcı kendine yetki
// verebilirdi.
const permissionOverrideService = {
  getAll: () => api.get('/permission-overrides'),
  grant: (userId, resource, action, rationale) =>
    api.post('/permission-overrides', { userId, resource, action, rationale }),
  // Geri alma silmez, active:false yapar — geçmiş denetim kaydında kalsın diye.
  revoke: (id) => api.delete(`/permission-overrides/${id}`),
};

export default permissionOverrideService;
