import api from './api';

const authService = {
  changePassword: (data) => api.patch('/auth/change-password', data),
  // Sunucu tarafı çıkış — hesabın tokenVersion'ını artırıp önceden üretilmiş
  // bütün token'ları geçersiz kılar (bkz. backend authController.logout).
  logout: () => api.post('/auth/logout'),
};

export default authService;
