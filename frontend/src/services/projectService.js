import api from './api';

const projectService = {
  getAll: () => api.get('/projects'),
  getMine: () => api.get('/projects/mine'),
  getById: (id) => api.get(`/projects/${id}`),
  getTasks: (id) => api.get(`/projects/${id}/tasks`),
  getEligibleMembers: () => api.get('/projects/eligible-members'),
  getContributionsOverview: () => api.get('/projects/contributions-overview'),
  getComments: (id) => api.get(`/projects/${id}/comments`),
  addComment: (id, text) => api.post(`/projects/${id}/comments`, { text }),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.patch(`/projects/${id}`, data),
  remove: (id) => api.delete(`/projects/${id}`),
};

export default projectService;
