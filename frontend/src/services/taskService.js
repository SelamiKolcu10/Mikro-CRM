import api from './api';
import { cachedRequest, cacheKey, TTL } from '../utils/lookupCache';

const taskService = {
  // Görev listesinin KENDİSİ önbelleklenmiyor: pano durumları anlık, bayat
  // görünmesi "sürükledim geri gitti" izlenimi yaratır.
  getAll: () => api.get('/tasks'),

  // "Kime atansın" listesi — Görev Oluştur modalı HER açılışta çekiyordu.
  // Departman anahtara giriyor.
  getAssignableUsers: (department) =>
    cachedRequest(
      cacheKey('tasks:assignableUsers', department ? { department } : null),
      () => api.get('/tasks/assignable-users', { params: department ? { department } : {} }),
      TTL.assignableUsers
    ),

  // İş yükü skoru ve ısı haritası önbelleklenmiyor: ikisi de görev
  // hareketiyle değişen ölçümler, bayat gösterilmeleri yanıltıcı olur.
  getWorkloadStatus: (department) =>
    api.get('/tasks/workload-status', { params: department ? { department } : {} }),
  getActivityHeatmap: (params) => api.get('/tasks/activity-heatmap', { params }),

  create: (data) => api.post('/tasks', data),
  updateStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }),
  updateDeadline: (id, deadline, expectedVersion) =>
    api.patch(`/tasks/${id}/deadline`, { deadline, expectedVersion }),
  getComments: (taskId) => api.get(`/tasks/${taskId}/comments`),
  addComment: (taskId, text) => api.post(`/tasks/${taskId}/comments`, { text }),
};

export default taskService;
