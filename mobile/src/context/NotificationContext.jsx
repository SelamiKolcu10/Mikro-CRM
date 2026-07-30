import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import notificationService from '../services/notificationService';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const NotificationContext = createContext({
  items: [],
  unreadCount: 0,
  loading: false,
  refresh: () => {},
  markRead: () => {},
  markAllRead: () => {},
});

/**
 * Bildirim durumu — çan rozeti ve bildirim listesi aynı kaynaktan beslenir.
 *
 * İki kanal birlikte çalışıyor:
 *  • Oturum açılınca bir kez REST ile çekilir (çevrimdışıyken birikenler).
 *  • Sonrasında `notification:new` socket olayı listenin başına ekler ve
 *    rozeti artırır — yeniden istek atmaya gerek yok.
 *
 * Socket bağlantısı her role açık (bkz. backend socket/index.js: "bağlanabilir"
 * ile "sohbeti okuyabilir" ayrı), o yüzden burada rol kontrolü yok.
 */
export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, mustChangePassword } = useAuth();
  const { socket } = useSocket();

  // Zorunlu parola değiştirme kapısı açıkken `protect` arkasındaki her istek
  // 403 döner — bildirim çekmenin anlamı yok. Daha önemlisi: bayrak temizlenince
  // `ready` false→true olur ve efekt YENİDEN çalışır. Sadece `isAuthenticated`e
  // bağlı kalsaydı o değer hiç değişmediği için kapıdan geçildikten sonra
  // bildirimler bir daha çekilmez, çan boş kalırdı.
  const ready = isAuthenticated && !mustChangePassword;

  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!ready) return;
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
  }, [ready]);

  // Oturum açılınca çek, kapanınca temizle (bir sonraki kullanıcı öncekinin
  // bildirimlerini görmesin).
  useEffect(() => {
    if (!ready) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    refresh();
  }, [ready, refresh]);

  useEffect(() => {
    if (!socket) return undefined;
    const onNew = (n) => {
      // Aynı bildirim iki kez gelirse (yeniden bağlanma) yinelenmesin.
      setItems((prev) => (prev.some((p) => p._id === n._id) ? prev : [n, ...prev]));
      setUnreadCount((c) => c + 1);
    };
    socket.on('notification:new', onNew);
    return () => socket.off('notification:new', onNew);
  }, [socket]);

  const markRead = useCallback(async (id) => {
    // İyimser güncelleme: rozet anında düşer. Hata olursa sunucudan gerçek
    // durumu geri çekiyoruz — elle geri sarmak yerine tek kaynağa dönmek daha
    // güvenli (bkz. bildirim-ve-onbellek-plani.md, optimistic UI notu).
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      const res = await notificationService.markRead(id);
      setUnreadCount(res.data.unreadCount ?? 0);
    } catch {
      refresh();
    }
  }, [refresh]);

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

export const useNotifications = () => useContext(NotificationContext);
