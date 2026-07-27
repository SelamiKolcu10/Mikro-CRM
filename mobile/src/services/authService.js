import api from './api';

// Mirrors the backend auth contract used by the web app (see
// frontend/src/context/AuthContext.jsx): login returns { token, ...session }
// under res.data.data; /auth/me re-verifies a stored token.
const authService = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

export default authService;
