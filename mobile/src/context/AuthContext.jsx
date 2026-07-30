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

  /**
   * Parola değiştirme — hem zorunlu ilk-giriş kapısı (ForcePasswordChangeScreen)
   * hem de profildeki gönüllü değişiklik buradan geçer.
   *
   * Yeni token'ı saklamak ZORUNLU: backend değişiklikte `bumpTokenVersion()`
   * çağırıyor (çalınmış bir token parola değişince ölsün diye), yani elimizdeki
   * eski token o an geçersiz hale geliyor. Saklamazsak bir sonraki istek 401
   * alır ve kullanıcı sebepsiz yere giriş ekranına düşer.
   */
  const changePassword = async (currentPassword, newPassword) => {
    const res = await authService.changePassword(currentPassword, newPassword);
    const token = res.data.data?.token;
    if (token) await tokenStorage.set(token);
    // Zorunlu değiştirme kapısı bu bayrağa bakıyor — temizlenince RootNavigator
    // uygulamanın geri kalanını mount eder.
    setSession((s) => (s ? { ...s, mustChangePassword: false } : s));
  };

  const logout = async () => {
    // Önce sunucuya haber ver: tokenVersion artar ve bu hesap için üretilmiş
    // BÜTÜN token'lar anında ölür. Sadece cihazdan silmek yetmez — JWT
    // durumsuzdur, kopyalanmış bir token çıkıştan sonra da geçerli kalırdı.
    //
    // Hata bilerek yutuluyor: telefonda çevrimdışı olmak sıradan bir durum ve
    // kullanıcının çıkış yapabilmesi ağa bağlı OLMAMALI.
    try {
      await authService.logout();
    } catch {
      /* yerel oturum yine de kapatılır */
    }

    await tokenStorage.remove();
    setSession(null);
    // Lookup önbelleği ZORUNLU boşaltılır: farklı kullanıcı farklı yetki
    // demek, önceki oturumun listeleri yenisine sızmamalı.
    clearLookupCache();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        login,
        logout,
        changePassword,
        isAuthenticated: !!session,
        // Geçici parolayla girilmiş oturum: `protect` arkasındaki HER istek
        // 403 PASSWORD_CHANGE_REQUIRED döner, o yüzden navigator uygulamanın
        // geri kalanını hiç açmaz (bkz. App.js RootNavigator).
        mustChangePassword: !!session?.mustChangePassword,
      }}
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
