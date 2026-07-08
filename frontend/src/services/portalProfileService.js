import portalApi from './portalApi';

const portalProfileService = {
  updateProfile: (data) => portalApi.patch('/profile', data),
  changePassword: (data) => portalApi.patch('/auth/password', data),
};

export default portalProfileService;
