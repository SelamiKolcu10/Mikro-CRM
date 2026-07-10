import axios from 'axios';
import { API_URL } from '../config/apiUrls';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('micro-crm-token');
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
      localStorage.removeItem('micro-crm-token');
      // Redirect to login only if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (
      error.response?.data?.code === 'PASSWORD_CHANGE_REQUIRED' &&
      window.location.pathname !== '/force-password-change'
    ) {
      window.location.href = '/force-password-change';
    }
    return Promise.reject(error);
  }
);

export default api;
