import api from './api';

const taskService = {
  getAll: () => api.get('/tasks'),
  create: (data) => api.post('/tasks', data),
  updateStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }),
  getAssignableUsers: (department) => api.get('/tasks/assignable-users', { params: department ? { department } : {} }),
  getWorkloadStatus: (department) => api.get('/tasks/workload-status', { params: department ? { department } : {} }),
  getActivityHeatmap: (params) => api.get('/tasks/activity-heatmap', { params }),
  getComments: (taskId) => api.get(`/tasks/${taskId}/comments`),
  addComment: (taskId, text) => api.post(`/tasks/${taskId}/comments`, { text }),
};

export default taskService;
