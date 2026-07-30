import api from './api';
import { cachedRequest, cacheKey, TTL } from '../utils/lookupCache';

// Görev uçları — web'deki taskService.js ile aynı adresler.
// getAll → res.data.data (dizi). updateDeadline'daki expectedVersion, iki
// liderin aynı görevi eşzamanlı taşımasında 409 çakışma kontrolü içindir
// (bkz. backend taskController.updateTaskDeadline).
const taskService = {
  getAll: () => api.get('/tasks'),
  create: (payload) => api.post('/tasks', payload),
  updateStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }),
  updateDeadline: (id, deadline, expectedVersion) =>
    api.patch(`/tasks/${id}/deadline`, { deadline, expectedVersion }),
  getAssignableUsers: (department) =>
    cachedRequest(
      cacheKey('tasks:assignableUsers', department ? { department } : null),
      () => api.get('/tasks/assignable-users', { params: department ? { department } : {} }),
      TTL.assignableUsers
    ),
  // Katkı aktivitesi — son 365 günün gün-bazlı özeti (gün başına en fazla 10
  // detay satırı). Yanıt: { 'YYYY-MM-DD': { date, total, byStatus, details } }
  getActivityHeatmap: (params) => api.get('/tasks/activity-heatmap', { params }),
  getComments: (taskId) => api.get(`/tasks/${taskId}/comments`),
  addComment: (taskId, text) => api.post(`/tasks/${taskId}/comments`, { text }),
};

export default taskService;
