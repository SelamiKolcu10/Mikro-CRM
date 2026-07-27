import api from './api';

// Same endpoint the web panel uses (frontend/src/services/customerService.js).
// List comes back under res.data.data, count under res.data.pagination.total.
const customerService = {
  getAll: (params = {}) => api.get('/customers', { params }),
};

export default customerService;
