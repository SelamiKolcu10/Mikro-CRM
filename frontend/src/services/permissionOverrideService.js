import api from './api';

const permissionOverrideService = {
  getAll: () => api.get('/permission-overrides'),
  grant: (userId, resource, action, rationale) =>
    api.post('/permission-overrides', { userId, resource, action, rationale }),
  revoke: (id) => api.delete(`/permission-overrides/${id}`),
};

export default permissionOverrideService;
