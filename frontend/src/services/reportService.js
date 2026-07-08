import api from './api';

const reportService = {
  getSpendingSummary: () => api.get('/reports/spending-summary'),
  // A plain <a href> download can't attach the Authorization header, so the
  // CSV is fetched as a blob and saved via a temporary object URL instead.
  exportSpendingCsv: () => api.get('/reports/spending-export', { responseType: 'blob' }),
};

export default reportService;
