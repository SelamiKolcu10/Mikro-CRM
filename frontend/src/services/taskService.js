import api from './api';

const taskService = {
  getAll: () => api.get('/tasks'),
  create: (data) => api.post('/tasks', data),
  updateStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }),
  getAssignableUsers: (department) => api.get('/tasks/assignable-users', { params: department ? { department } : {} }),
  getActivityHeatmap: (params) => api.get('/tasks/activity-heatmap', { params }),
};

export default taskService;
