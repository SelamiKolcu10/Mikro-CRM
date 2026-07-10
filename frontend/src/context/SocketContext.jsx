import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SOCKET_URL } from '../config/apiUrls';

const SocketContext = createContext();

/**
 * One socket connection for the whole app, shared by the staff ChatDashboard
 * and the customer PortalChat — both just read `socket`/`connected` from
 * here rather than each managing their own connection. `connected` doubles
 * as the "is anything actually wrong" signal chat screens surface to the
 * user (see components/chat/ConnectionStatus.jsx).
 */
export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated, mustChangePassword } = useAuth();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // No socket while logged out, or while gated behind a forced password
    // change — mirrors the boundary the REST API already enforces server-side
    // (see backend/middleware/authMiddleware.js).
    if (!isAuthenticated || !token || mustChangePassword) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return undefined;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, isAuthenticated, mustChangePassword]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
