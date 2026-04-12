import { createContext, useState, useEffect, useContext, useRef } from "react";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext";
import io from "socket.io-client";
import { SOCKET_URL } from "../config";

const SocketContext = createContext();

export const useSocketContext = () => {
      return useContext(SocketContext);
};

export const SocketContextProvider = ({ children }) => {
      const [socket, setSocket] = useState(null);
      const [onlineUsers, setOnlineUsers] = useState([]);
      const [isConnected, setIsConnected] = useState(false);
      const { user, token } = useAuth();
      const socketRef = useRef(null);

      const closeSocket = (socketInstance) => {
            if (!socketInstance) return;

            socketInstance.removeAllListeners();
            socketInstance.io?.removeAllListeners?.();
            socketInstance.close();
      };

      useEffect(() => {
            if (user && token) {
                  if (socketRef.current) {
                        closeSocket(socketRef.current);
                  }

                  const socketInstance = io(SOCKET_URL, {
                        auth: { token },
                        transports: ['polling', 'websocket'],
                        withCredentials: true,
                        reconnection: true,
                        reconnectionAttempts: 30,
                        reconnectionDelay: 2000,
                        reconnectionDelayMax: 15000,
                        randomizationFactor: 0.5,
                        timeout: 20000,
                        upgrade: true,
                        rememberUpgrade: false,
                        autoConnect: true
                  });

                  socketRef.current = socketInstance;
                  setSocket(socketInstance);

                  const handleConnect = () => {
                        setIsConnected(true);
                  };

                  const handleDisconnect = () => {
                        setIsConnected(false);
                        setOnlineUsers([]);
                  };

                  const handleConnectError = (err) => {
                        console.warn('[Socket] Connection error:', err.message);
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

                  socketInstance.on("connect", handleConnect);
                  socketInstance.on("disconnect", handleDisconnect);
                  socketInstance.on("connect_error", handleConnectError);
                  socketInstance.on("getOnlineUsers", handleOnlineUsers);
                  socketInstance.io.on("reconnect_attempt", handleReconnectAttempt);
                  socketInstance.io.on("reconnect_failed", handleReconnectFailed);

                  return () => {
                        socketInstance.off("connect", handleConnect);
                        socketInstance.off("disconnect", handleDisconnect);
                        socketInstance.off("connect_error", handleConnectError);
                        socketInstance.off("getOnlineUsers", handleOnlineUsers);
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
                  closeSocket(socketRef.current);
                  socketRef.current = null;
            }

            setSocket(null);
            setIsConnected(false);
            setOnlineUsers([]);

            return undefined;
      }, [user, token]);

      return (
            <SocketContext.Provider value={{ socket, onlineUsers, isConnected }}>
                  {children}
            </SocketContext.Provider>
      );
};
