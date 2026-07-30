import api from './api';
import { cachedRequest, invalidate, TTL } from '../utils/lookupCache';

// Proje portföyü — backend/routes/projectRoutes.js'in aynası.
//
// Yetki iki katmanlı, uçlar buna göre ayrılıyor:
//  • Yönetici (super_admin veya development lideri) → tam liste, CRUD, /:id.
//  • Ekip üyesi → yalnız /mine ile kendi projeleri; /:id'ye erişemez (403),
//    ama kendi projesinin görevlerini ve tartışmasını okuyup yazabilir.
// Bu yüzden detay ekranı projeyi listeden route params ile alır, getById'yi
// yalnızca yönetici için çağırır.
// Liste/seçici uçları önbellekli (bkz. utils/lookupCache.js); görev akışı ve
// yorumlar BİLEREK dışarıda — onların anlık olması gerekiyor. Yazma işlemleri
// önbelleği düşürüyor, yoksa "az önce oluşturduğum proje listede yok" olur.
const projectService = {
  getAll: () => cachedRequest('projects:all', () => api.get('/projects'), TTL.projects),
  getMine: () => cachedRequest('projects:mine', () => api.get('/projects/mine'), TTL.projects),
  getEligibleMembers: () =>
    cachedRequest(
      'projects:eligibleMembers',
      () => api.get('/projects/eligible-members'),
      TTL.eligibleMembers
    ),

  getById: (id) => api.get(`/projects/${id}`),
  getTasks: (id) => api.get(`/projects/${id}/tasks`),
  getComments: (id) => api.get(`/projects/${id}/comments`),
  addComment: (id, text) => api.post(`/projects/${id}/comments`, { text }),

  create: async (payload) => {
    const res = await api.post('/projects', payload);
    invalidate('projects');
    return res;
  },
  update: async (id, payload) => {
    const res = await api.patch(`/projects/${id}`, payload);
    invalidate('projects');
    return res;
  },
  remove: async (id) => {
    const res = await api.delete(`/projects/${id}`);
    invalidate('projects');
    return res;
  },
};

export default projectService;
