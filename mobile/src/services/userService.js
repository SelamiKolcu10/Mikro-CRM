import api from './api';
import { cachedRequest, invalidate, cacheKey, TTL } from '../utils/lookupCache';

// Kullanıcı yönetimi — backend/routes/userRoutes.js'in aynası.
//
// Okuma super_admin + intern'e açık (intern'e e-postalar maskeli gelir,
// bkz. middleware/redactForIntern), yazma işlemlerinin tamamı yalnız
// super_admin (PERMISSIONS.users.write).
const userService = {
  // Liste birden çok ekranda çekiliyor (Kullanıcı Yönetimi, Erişim Kontrolü,
  // Onay Kuyruğu, sohbet atama) ve useFocusEffect her odaklanmada tazeliyor —
  // önbellek bunları tek isteğe indiriyor. Parametreler anahtara girer.
  getAll: (params = {}) =>
    cachedRequest(cacheKey('users', params), () => api.get('/users', { params }), TTL.users),
  getById: (id) => api.get(`/users/${id}`),

  // Parola gönderilmez: backend sabit bir başlangıç parolası atar
  // (DEFAULT_USER_PASSWORD) — rol super_admin olamaz (CREATABLE_ROLES).
  create: async (payload) => {
    const res = await api.post('/users', payload);
    invalidate('users');
    return res;
  },

  // Profilim (self-servis) — `users` kaynağı iznine bağlı değil, her oturum
  // sahibi kendi kaydına erişir. Yanıt ayrıca "developer tree"yi taşır:
  // tenureMonths/tenureDays + projects[] (her biri sinceDays, userDone,
  // totalDone, active[], done[] ile) — bkz. backend/utils/developerTree.js.
  getMyProfile: () => api.get('/users/me/profile'),

  // Yalnız iletişim alanları düzenlenebilir (telefon/LinkedIn/GitHub); ad,
  // e-posta, rol ve departman buradan değiştirilemez — onlar yönetici işi.
  updateMyProfile: (payload) => api.patch('/users/me/profile', payload),

  // multipart/form-data, alan adı 'avatar', en fazla 2 MB.
  uploadAvatar: (formData) =>
    api.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updateRole: async (id, role) => {
    const res = await api.patch(`/users/${id}/role`, { role });
    invalidate('users');
    return res;
  },
  updateDepartment: async (id, department) => {
    const res = await api.patch(`/users/${id}/department`, { department });
    // Departman değişimi "atanabilir kişiler" ve "uygun ekip üyeleri"
    // listelerini de bozar.
    invalidate('users');
    invalidate('tasks:assignableUsers');
    invalidate('projects:eligibleMembers');
    return res;
  },
  remove: async (id) => {
    const res = await api.delete(`/users/${id}`);
    invalidate('users');
    invalidate('tasks:assignableUsers');
    invalidate('projects:eligibleMembers');
    return res;
  },
};

export default userService;
