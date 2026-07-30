import { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import { tokenStorage } from '../platform/tokenStorage';
import { clearLookupCache } from '../utils/lookupCache';
import { setOnUnauthorized } from '../services/api';

const AuthContext = createContext();

/**
 * Mobile auth context — the native counterpart of the web AuthContext.
 * Difference from web: token storage is async (device keychain), so the
 * session can't be read synchronously at mount; we hydrate it in an effect
 * and gate the navigator on `loading` until that finishes.
 */
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // A 401 from any request drops us back to Login (api.js already clears the
  // stored token before calling this).
  useEffect(() => {
    setOnUnauthorized(() => setSession(null));
  }, []);

  // On mount: if a token is stored, verify it via /auth/me.
  useEffect(() => {
    (async () => {
      const token = await tokenStorage.get();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await authService.me();
        setSession(res.data.data);
      } catch {
        await tokenStorage.remove();
        setSession(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    const { token, ...data } = res.data.data;
    await tokenStorage.set(token);
    setSession(data);
    return data;
  };

  const logout = async () => {
    await tokenStorage.remove();
    setSession(null);
    // Lookup önbelleği ZORUNLU boşaltılır: farklı kullanıcı farklı yetki
    // demek, önceki oturumun listeleri yenisine sızmamalı.
    clearLookupCache();
  };

  return (
    <AuthContext.Provider
      value={{ session, loading, login, logout, isAuthenticated: !!session }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
