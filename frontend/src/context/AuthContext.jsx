import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import authService from '../services/authService';
import { clearLookupCache } from '../utils/lookupCache';

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

  const logout = async () => {
    // Önce sunucuya haber ver: tokenVersion artar ve bu hesap için üretilmiş
    // BÜTÜN token'lar anında ölür. Sadece istemciden silmek yetmez — JWT
    // durumsuzdur, kopyalanmış bir token çıkıştan sonra da geçerli kalırdı.
    //
    // Hata bilerek yutuluyor: çevrimdışıyken, sunucu erişilemezken ya da token
    // zaten geçersizken bile YEREL çıkış çalışmak zorunda. Aksi halde
    // kullanıcı kapatamadığı bir oturumda kilitli kalır.
    try {
      await authService.logout();
    } catch {
      /* yerel oturum yine de kapatılır */
    }

    localStorage.removeItem('micro-crm-token');
    setToken(null);
    setSession(null);
    // Lookup önbelleği ZORUNLU olarak boşaltılır: farklı kullanıcı farklı
    // yetki demek, önceki oturumun gördüğü listeler yenisine sızmamalı
    // (bkz. utils/lookupCache.js).
    clearLookupCache();
  };

  // After a password change, the backend issues a fresh token (cleared
  // mustChangePassword claim). Storing it re-triggers the /me verify effect
  // above, which pulls the updated session — no full page reload needed.
  const updateToken = (newToken) => {
    localStorage.setItem('micro-crm-token', newToken);
    setToken(newToken);
  };

  const isInternal = session?.accountType === 'internal';
  const isCustomer = session?.accountType === 'customer';
  const hasRole = (...roles) => isInternal && roles.includes(session.role);
  const mustChangePassword = isInternal && !!session.mustChangePassword;

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
        updateToken,
        hasRole,
        isInternal,
        isCustomer,
        mustChangePassword,
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
