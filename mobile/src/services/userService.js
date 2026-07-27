import api from './api';

// Şimdilik yalnız sohbet atama seçicisi için: onaylı personel listesi.
const userService = {
  getAll: (params = {}) => api.get('/users', { params }),
};

export default userService;
