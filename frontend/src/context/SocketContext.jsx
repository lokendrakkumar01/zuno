import { createContext, useState, useEffect, useContext, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext";
import { getSocket, disconnectSocket } from "../socket";
import { getEntityId } from "../utils/session";

const SocketContext = createContext();

export const useSocketContext = () => useContext(SocketContext);

const normalizeOnlineUsers = (users = []) =>
  Array.from(new Set(
    (Array.isArray(users) ? users : [])
      .map((entry) => getEntityId(entry))
      .filter(Boolean)
  ));

export const SocketContextProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const { user, token } = useAuth();
  const authenticatedUserId = getEntityId(user) || null;
  const socketRef = useRef(null);
  const heartbeatRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const notificationIdsRef = useRef(new Set());
  const soundRef = useRef(null);

  const clearHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const closeSocket = useCallback((socketInstance) => {
    if (!socketInstance) return;
    socketInstance.removeAllListeners();
    try { socketInstance.io?.removeAllListeners?.(); } catch {}
    socketInstance.disconnect();
  }, []);

  useEffect(() => {
    notificationIdsRef.current = new Set(
      notifications
        .map((notification) => String(notification?._id || notification?.id || ''))
        .filter(Boolean)
    );
  }, [notifications]);

  const playNotificationSound = useCallback((type = 'notification') => {
    const settings = user?.notificationSettings || {};
    const soundName = type === 'message' ? settings.messageSound : settings.notificationSound;
    if (settings.inApp === false || soundName === 'off') return;
    const soundMap = {
      soft: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3',
      pop: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
      chime: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
    };
    const src = soundMap[soundName || 'soft'];
    if (!src) return;
    try {
      if (!soundRef.current || soundRef.current.src !== src) {
        soundRef.current = new Audio(src);
        soundRef.current.preload = 'auto';
      }
      soundRef.current.currentTime = 0;
      soundRef.current.volume = type === 'message' ? 0.55 : 0.45;
      soundRef.current.play().catch(() => undefined);
    } catch {
      // Browser audio policies can block unattended playback.
    }
  }, [user?.notificationSettings]);

  useEffect(() => {
    if (!authenticatedUserId || !token) {
      clearHeartbeat();
      clearReconnectTimer();
      if (socketRef.current) {
        closeSocket(socketRef.current);
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers([]);
      return;
    }

    // Close old socket before creating new one
    if (socketRef.current) {
      closeSocket(socketRef.current);
      socketRef.current = null;
    }

    const socketInstance = getSocket(token);

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    // ---- Connection lifecycle handlers ----
    socketInstance.on("connect", () => {
      setIsConnected(true);
      clearReconnectTimer();
      console.log("[Socket] Connected:", socketInstance.id);
    });

    socketInstance.on("disconnect", (reason) => {
      setIsConnected(false);
      console.warn("[Socket] Disconnected:", reason);

      // Auto-reconnect for recoverable disconnects
      if (reason === "io server disconnect" || reason === "transport close") {
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          if (socketRef.current && !socketRef.current.connected) {
            socketRef.current.connect();
          }
        }, 3000);
      }
    });

    socketInstance.on("connect_error", (err) => {
      console.warn("[Socket] Connection error:", err.message);
      setIsConnected(false);

      // Don't retry on auth errors
      if (/authentication|required|expired|invalid/i.test(String(err?.message || ''))) return;

      clearReconnectTimer();
      reconnectTimerRef.current = setTimeout(() => {
        if (socketRef.current && !socketRef.current.connected) {
          // Refresh token on reconnect
          socketRef.current.auth = { token };
          socketRef.current.connect();
        }
      }, 2000);
    });

    socketInstance.io?.on("reconnect", (attempt) => {
      setIsConnected(true);
      // Refresh auth token on reconnect
      socketInstance.auth = { token };
      console.log("[Socket] Reconnected after", attempt, "attempts");
    });

    socketInstance.io?.on("reconnect_failed", () => {
      console.error("[Socket] All reconnection attempts failed");
      setIsConnected(false);
      toast.warning("Lost connection. Please refresh.", { toastId: "socket-failed" });
    });

    // ---- Online Users ----
    const handleOnlineUsers = (users) => {
      setOnlineUsers(normalizeOnlineUsers(users));
      if (socketInstance.connected) setIsConnected(true);
    };
    socketInstance.on("getOnlineUsers", handleOnlineUsers);
    socketInstance.on("online-users", handleOnlineUsers);

    // ---- Heartbeat ----
    socketInstance.on("presence:heartbeat:ack", () => setIsConnected(true));
    clearHeartbeat();
    heartbeatRef.current = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit("presence:heartbeat");
      }
    }, 25000);

    // ---- Notifications (real-time) ----
    const handleNotification = (notification) => {
      if (user?.notificationSettings?.inApp === false) return;
      const notificationId = String(notification?._id || notification?.id || '');
      if (notificationId && notificationIdsRef.current.has(notificationId)) return;
      if (notificationId) notificationIdsRef.current.add(notificationId);

      setNotifications(prev => {
        return [notification, ...prev];
      });
      setUnreadCount(prev => prev + 1);
      playNotificationSound(notification.type === 'message' ? 'message' : 'notification');

      // Show toast for new notification
      const icons = {
        follow: "👤", like: "❤️", comment: "💬",
        message: "✉️", call_incoming: "📞", stream_live: "🔴",
        follow_request: "👋", admin_broadcast: "📢"
      };
      const icon = icons[notification.type] || "🔔";
      toast.info(`${icon} ${notification.title}`, {
        position: "top-right",
        autoClose: 4000,
        toastId: `notif-${notification._id}`
      });
    };

    socketInstance.on("notification:new", handleNotification);
    socketInstance.on("notification", handleNotification);

    socketInstance.on("notification:read", ({ ids, readAt }) => {
      setNotifications(prev =>
        prev.map(n =>
          !ids?.length || ids.includes(String(n._id))
            ? { ...n, isRead: true, readAt }
            : n
        )
      );
      setUnreadCount(prev =>
        !ids?.length ? 0 : Math.max(0, prev - ids.length)
      );
    });

    return () => {
      clearHeartbeat();
      clearReconnectTimer();
      socketInstance.off("notification:new", handleNotification);
      socketInstance.off("notification", handleNotification);
      closeSocket(socketInstance);
      disconnectSocket();
      if (socketRef.current === socketInstance) socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers([]);
    };
  }, [authenticatedUserId, token, closeSocket, playNotificationSound, user?.notificationSettings?.inApp]);

  // Helper: mark notification as read
  const markNotificationRead = useCallback((notificationId) => {
    setNotifications(prev =>
      prev.map(n => String(n._id) === String(notificationId) ? { ...n, isRead: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  return (
    <SocketContext.Provider value={{
      socket,
      onlineUsers,
      isConnected,
      notifications,
      unreadCount,
      setNotifications,
      setUnreadCount,
      markNotificationRead,
      markAllRead
    }}>
      {children}
    </SocketContext.Provider>
  );
};
