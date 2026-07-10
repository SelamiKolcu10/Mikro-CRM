import api from './api';

const reportService = {
  getSpendingSummary: (params = {}) => api.get('/reports/spending-summary', { params }),
  // A plain <a href> download can't attach the Authorization header, so the
  // CSV is fetched as a blob and saved via a temporary object URL instead.
  exportSpendingCsv: (params = {}) => api.get('/reports/spending-export', { params, responseType: 'blob' }),
};

export default reportService;
