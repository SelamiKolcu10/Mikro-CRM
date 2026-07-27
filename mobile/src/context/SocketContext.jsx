import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { tokenStorage } from '../platform/tokenStorage';
import { SOCKET_URL } from '../config/apiUrls';

const SocketContext = createContext({ socket: null, connected: false });

/**
 * Tüm uygulama için tek soket bağlantısı — web'deki SocketContext.jsx'in
 * mobil karşılığı. Web'den tek farkı token'ın senkron okunamaması: mobilde
 * token cihaz keychain'inde (expo-secure-store) duruyor, bu yüzden önce
 * asenkron okuyup sonra bağlanıyoruz.
 *
 * Soket `socketRef` yerine state'te tutuluyor — bağlantı kurulduğunda
 * tüketicilerin (useConversation) yeniden render olması gerekiyor.
 */
export const SocketProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setSocket(null);
      setConnected(false);
      return undefined;
    }

    let cancelled = false;
    let instance = null;

    (async () => {
      const token = await tokenStorage.get();
      // Oturum bu arada kapandıysa bağlanma.
      if (cancelled || !token) return;

      instance = io(SOCKET_URL, {
        auth: { token },
        // React Native'de websocket doğrudan desteklenir; polling yedek olarak
        // kalsın (emülatör/ağ kısıtlarında bağlantı büsbütün düşmesin).
        transports: ['websocket', 'polling'],
      });

      instance.on('connect', () => setConnected(true));
      instance.on('disconnect', () => setConnected(false));
      instance.on('connect_error', () => setConnected(false));

      setSocket(instance);
    })();

    return () => {
      cancelled = true;
      instance?.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
