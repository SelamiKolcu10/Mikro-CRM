import api from './api';

const authService = {
  changePassword: (data) => api.patch('/auth/change-password', data),
};

export default authService;
