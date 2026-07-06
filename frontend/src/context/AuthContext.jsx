import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('micro-crm-token'));
  const [loading, setLoading] = useState(true);

  // On mount, verify the stored token
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        setUser(res.data.data);
      } catch {
        // Token is invalid or expired
        localStorage.removeItem('micro-crm-token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    verifyToken();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken, ...userData } = res.data.data;
    localStorage.setItem('micro-crm-token', newToken);
    setToken(newToken);
    setUser(userData);
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    const { token: newToken, ...userData } = res.data.data;
    localStorage.setItem('micro-crm-token', newToken);
    setToken(newToken);
    setUser(userData);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('micro-crm-token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
