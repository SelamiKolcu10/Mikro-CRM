import axios from 'axios';
import { API_URL } from '../config/apiUrls';

// Same token storage key as the internal app's api.js — login is unified
// (see AuthContext), so whichever account type the token belongs to, it
// lives under the one 'micro-crm-token' key. The backend enforces the
// portal/internal boundary via the token's own `aud` claim, not by which
// localStorage key it was read from.
const portalApi = axios.create({
  baseURL: `${API_URL}/portal`,
  headers: { 'Content-Type': 'application/json' },
});

portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('micro-crm-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

portalApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('micro-crm-token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default portalApi;
