import axios from 'axios';
import { API_URL } from '../config/apiUrls';
import { tokenStorage } from '../platform/tokenStorage';
import { authRedirect } from '../platform/authRedirect';

// Same token storage as the internal app's api.js — login is unified (see
// AuthContext), so whichever account type the token belongs to, it lives
// under the one shared tokenStorage seam. The backend enforces the
// portal/internal boundary via the token's own `aud` claim, not by where
// the token was read from.
const portalApi = axios.create({
  baseURL: `${API_URL}/portal`,
  headers: { 'Content-Type': 'application/json' },
});

portalApi.interceptors.request.use(async (config) => {
  const token = await tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

portalApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenStorage.remove();
      authRedirect.toLogin();
    }
    return Promise.reject(error);
  }
);

export default portalApi;
