import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

/**
 * Single auth context for both staff and customer-portal sessions — one
 * login page, one token, one "who am I" check. `session.accountType` is
 * 'internal' (staff, has `role`) or 'customer' (has `customer` CRM record).
 * `user` / `customerUser` are convenience views over the same session so
 * existing components don't need to branch on accountType themselves.
 */
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('micro-crm-token'));
  const [loading, setLoading] = useState(true);

  // On mount, verify the stored token — works for either account type since
  // the backend reads the token's own audience claim.
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        setSession(res.data.data);
      } catch {
        // Token is invalid or expired
        localStorage.removeItem('micro-crm-token');
        setToken(null);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };
    verifyToken();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken, ...data } = res.data.data;
    localStorage.setItem('micro-crm-token', newToken);
    setToken(newToken);
    setSession(data);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('micro-crm-token');
    setToken(null);
    setSession(null);
  };

  const isInternal = session?.accountType === 'internal';
  const isCustomer = session?.accountType === 'customer';
  const hasRole = (...roles) => isInternal && roles.includes(session.role);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: isInternal ? session : null,
        customerUser: isCustomer ? session : null,
        token,
        loading,
        login,
        logout,
        hasRole,
        isInternal,
        isCustomer,
        isAuthenticated: !!session,
      }}
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
