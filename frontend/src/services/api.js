import axios from 'axios';
import { API_URL } from '../config/apiUrls';
import { tokenStorage } from '../platform/tokenStorage';
import { authRedirect } from '../platform/authRedirect';
import { clearLookupCache } from '../utils/lookupCache';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token to every request. Async because the
// token seam is async (localStorage on web, secure storage on native); axios
// awaits the returned config, so web behaviour is unchanged.
api.interceptors.request.use(
  async (config) => {
    const token = await tokenStorage.get();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 (expired token) and the forced
// password-change gate (belt-and-suspenders: the router's PasswordGate
// already prevents these screens from mounting, this just covers any
// in-flight request racing a stale mustChangePassword=false client state).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenStorage.remove();
      // Oturum düştü — önbellekteki listeler bir sonraki kullanıcıya
      // sızmamalı (logout ile aynı gerekçe, bkz. utils/lookupCache.js).
      clearLookupCache();
      authRedirect.toLogin();
    } else if (error.response?.data?.code === 'PASSWORD_CHANGE_REQUIRED') {
      authRedirect.toPasswordChange();
    }
    return Promise.reject(error);
  }
);

export default api;
