import api from './api';

const approvalService = {
  getAll: (params = {}) => api.get('/approvals', { params }),
  getMine: (params = {}) => api.get('/approvals/mine', { params }),
  approve: (id) => api.patch(`/approvals/${id}/approve`),
  reject: (id, reason) => api.patch(`/approvals/${id}/reject`, { reason }),
};

export default approvalService;
