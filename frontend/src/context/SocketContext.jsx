import { createContext, useState, useEffect, useContext, useRef } from "react";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext";
import io from "socket.io-client";
import { SOCKET_URL } from "../config";
import { getEntityId } from "../utils/session";

const SocketContext = createContext();

export const useSocketContext = () => {
      return useContext(SocketContext);
};

export const SocketContextProvider = ({ children }) => {
      const [socket, setSocket] = useState(null);
      const [onlineUsers, setOnlineUsers] = useState([]);
      const [isConnected, setIsConnected] = useState(false);
      const { user, token } = useAuth();
      const authenticatedUserId = getEntityId(user) || null;
      const socketRef = useRef(null);
      const heartbeatIntervalRef = useRef(null);
      const lastHeartbeatAckRef = useRef(0);

      const closeSocket = (socketInstance) => {
            if (!socketInstance) return;

            socketInstance.removeAllListeners();
            socketInstance.io?.removeAllListeners?.();
            socketInstance.close();
      };

      const clearHeartbeat = () => {
            if (heartbeatIntervalRef.current) {
                  window.clearInterval(heartbeatIntervalRef.current);
                  heartbeatIntervalRef.current = null;
            }
      };

      useEffect(() => {
            if (authenticatedUserId && token) {
                  if (socketRef.current) {
                        closeSocket(socketRef.current);
                  }

                  const socketInstance = io(SOCKET_URL, {
                        auth: { token, userId: authenticatedUserId },
                        transports: ['polling', 'websocket'],
                        withCredentials: true,
                        reconnection: true,
                        reconnectionAttempts: Infinity,
                        reconnectionDelay: 1000,
                        reconnectionDelayMax: 8000,
                        randomizationFactor: 0.2,
                        timeout: 20000,
                        upgrade: true,
                        rememberUpgrade: false,
                        autoConnect: true
                  });

                  socketRef.current = socketInstance;
                  setSocket(socketInstance);

                  const handleConnect = () => {
                        setIsConnected(true);
                        lastHeartbeatAckRef.current = Date.now();
                  };

                  const handleDisconnect = () => {
                        setIsConnected(false);
                        setOnlineUsers([]);
                  };

                  const handleConnectError = (err) => {
                        console.warn('[Socket] Connection error:', err.message);
                        if (socketInstance.io.opts.transports?.[0] === 'websocket') {
                              socketInstance.io.opts.transports = ['polling', 'websocket'];
                        }
                        setIsConnected(false);
                  };

                  const handleReconnectAttempt = () => {
                        setIsConnected(false);
                  };

                  const handleReconnectFailed = () => {
                        console.error('[Socket] All reconnection attempts failed');
                        setIsConnected(false);
                        setOnlineUsers([]);
                        if (typeof window !== 'undefined') {
                              toast.warning(
                                    'Could not reconnect to live updates. Try refreshing the page.',
                                    { toastId: 'socket-reconnect-failed' }
                              );
                        }
                  };

                  const handleOnlineUsers = (users) => {
                        setOnlineUsers(Array.isArray(users) ? users : []);
                  };

                  const handleHeartbeatAck = () => {
                        lastHeartbeatAckRef.current = Date.now();
                        setIsConnected(true);
                  };

                  socketInstance.on("connect", handleConnect);
                  socketInstance.on("disconnect", handleDisconnect);
                  socketInstance.on("connect_error", handleConnectError);
                  socketInstance.on("getOnlineUsers", handleOnlineUsers);
                  socketInstance.on("presence:heartbeat:ack", handleHeartbeatAck);
                  socketInstance.io.on("reconnect_attempt", handleReconnectAttempt);
                  socketInstance.io.on("reconnect_failed", handleReconnectFailed);

                  clearHeartbeat();
                  heartbeatIntervalRef.current = window.setInterval(() => {
                        if (!socketInstance.connected) return;

                        socketInstance.emit('presence:heartbeat');
                        if (Date.now() - lastHeartbeatAckRef.current > 65000) {
                              setIsConnected(false);
                        }
                  }, 20000);

                  return () => {
                        clearHeartbeat();
                        socketInstance.off("connect", handleConnect);
                        socketInstance.off("disconnect", handleDisconnect);
                        socketInstance.off("connect_error", handleConnectError);
                        socketInstance.off("getOnlineUsers", handleOnlineUsers);
                        socketInstance.off("presence:heartbeat:ack", handleHeartbeatAck);
                        socketInstance.io.off("reconnect_attempt", handleReconnectAttempt);
                        socketInstance.io.off("reconnect_failed", handleReconnectFailed);

                        if (socketRef.current === socketInstance) {
                              socketRef.current = null;
                        }

                        socketInstance.close();
                        setSocket((currentSocket) => (currentSocket === socketInstance ? null : currentSocket));
                        setIsConnected(false);
                        setOnlineUsers([]);
                  };
            }

            if (socketRef.current) {
                  clearHeartbeat();
                  closeSocket(socketRef.current);
                  socketRef.current = null;
            }

            setSocket(null);
            setIsConnected(false);
            setOnlineUsers([]);

            return undefined;
      }, [authenticatedUserId, token]);

      return (
            <SocketContext.Provider value={{ socket, onlineUsers, isConnected }}>
                  {children}
            </SocketContext.Provider>
      );
};
