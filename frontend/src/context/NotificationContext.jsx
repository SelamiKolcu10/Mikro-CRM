import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import notificationService from '../services/notificationService';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const NotificationContext = createContext(null);

/**
 * Bildirim durumu — çan rozeti ve açılır liste aynı kaynaktan beslenir.
 * Mobil taraftaki NotificationContext ile aynı sözleşme.
 *
 * İki kanal:
 *  • Oturum açılınca REST ile bir kez çekilir (çevrimdışıyken birikenler).
 *  • Sonrasında `notification:new` socket olayı listenin başına ekler.
 *
 * Yalnız personel için: bildirim uçları `protect` ile korunuyor, portal
 * (müşteri) oturumları erişemez — bu yüzden `isInternal` kontrolü var, aksi
 * halde müşteri girişinde boşa 401 isteği atılırdı.
 */
export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, isInternal, mustChangePassword } = useAuth();
  const { socket } = useSocket();

  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const active = isAuthenticated && isInternal && !mustChangePassword;

  const refresh = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      const res = await notificationService.getAll({ limit: 30 });
      setItems(res.data.data || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      // Sessiz geç — çan boş görünür, uygulama akışı bozulmaz.
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    refresh();
  }, [active, refresh]);

  useEffect(() => {
    if (!socket || !active) return undefined;
    const onNew = (n) => {
      // Yeniden bağlanmada aynı bildirim tekrar gelirse yinelenmesin.
      setItems((prev) => (prev.some((p) => p._id === n._id) ? prev : [n, ...prev]));
      setUnreadCount((c) => c + 1);
    };
    socket.on('notification:new', onNew);
    return () => socket.off('notification:new', onNew);
  }, [socket, active]);

  const markRead = useCallback(
    async (id) => {
      // İyimser güncelleme; hata olursa elle geri sarmak yerine sunucudan
      // gerçek durumu çekiyoruz (tek doğruluk kaynağı).
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        const res = await notificationService.markRead(id);
        setUnreadCount(res.data.unreadCount ?? 0);
      } catch {
        refresh();
      }
    },
    [refresh]
  );

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await notificationService.markAllRead();
    } catch {
      refresh();
    }
  }, [refresh]);

  return (
    <NotificationContext.Provider
      value={{ items, unreadCount, loading, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
};
