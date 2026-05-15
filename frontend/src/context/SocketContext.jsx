import { createContext, useState, useEffect, useContext, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext";
import io from "socket.io-client";
import { SOCKET_URL } from "../config";
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

    const socketInstance = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      randomizationFactor: 0.2,
      timeout: 15000,
      autoConnect: true,
      forceNew: false,
    });

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
        }, 1000);
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
    socketInstance.on("notification:new", (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

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
    });

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
      closeSocket(socketInstance);
      if (socketRef.current === socketInstance) socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers([]);
    };
  }, [authenticatedUserId, token, closeSocket]);

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
