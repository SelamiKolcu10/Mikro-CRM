import api from './api';

// Şimdilik yalnız görev oluştururken proje seçmek için. Bu uç
// `requireProjectManager` ile korunuyor (super_admin veya development lideri) —
// bkz. config/projects.js:canManageProjects.
const projectService = {
  getAll: () => api.get('/projects'),
};

export default projectService;
