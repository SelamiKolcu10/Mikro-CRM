import api from './api';
import { cachedRequest, invalidate, TTL } from '../utils/lookupCache';

// Önbellekli olanlar yalnız LİSTE/seçici uçları. `getComments`, `getTasks` ve
// `contributions-overview` bilerek dışarıda: yorum akışı ve görev durumları
// anlık, rapor ise hareketle değişiyor — bayat görünmeleri yanıltıcı olur.
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
  getContributionsOverview: () => api.get('/projects/contributions-overview'),
  getComments: (id) => api.get(`/projects/${id}/comments`),
  addComment: (id, text) => api.post(`/projects/${id}/comments`, { text }),

  create: async (data) => {
    const res = await api.post('/projects', data);
    invalidate('projects');
    return res;
  },
  update: async (id, data) => {
    const res = await api.patch(`/projects/${id}`, data);
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
