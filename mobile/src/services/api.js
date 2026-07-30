import axios from 'axios';
import { API_URL } from '../config/apiUrls';
import { tokenStorage } from '../platform/tokenStorage';
import { clearLookupCache } from '../utils/lookupCache';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Auth-expiry seam: AuthContext registers a handler that clears the session,
// which flips the navigator back to Login. This is the mobile counterpart of
// the web authRedirect seam (which uses window.location) — same idea, native
// navigation instead of a URL change.
let onUnauthorized = null;
export const setOnUnauthorized = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenStorage.remove();
      // Oturum düştü — önbellekteki listeler sonraki kullanıcıya sızmamalı
      // (logout ile aynı gerekçe, bkz. utils/lookupCache.js).
      clearLookupCache();
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default api;
