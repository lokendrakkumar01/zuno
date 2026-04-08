import { createContext, useState, useEffect, useContext } from "react";
import { useAuth } from "./AuthContext";
import io from "socket.io-client";
import { API_URL } from "../config";

const SocketContext = createContext();

export const useSocketContext = () => {
      return useContext(SocketContext);
};

export const SocketContextProvider = ({ children }) => {
      const [socket, setSocket] = useState(null);
      const [onlineUsers, setOnlineUsers] = useState([]);
      const [isConnected, setIsConnected] = useState(false);
      const { user, token } = useAuth();

      useEffect(() => {
            if (user && token) {
                  const userId = (user._id || user.id || user).toString();
                  // Remove /api suffix to get base URL for socket connection
                  const socketUrl = API_URL.replace(/\/api$/, '');

                  const socketInstance = io(socketUrl, {
                        query: { userId },
                        auth: { token },
                        transports: ['websocket', 'polling'],
                        reconnection: true,
                        reconnectionAttempts: Infinity, // Keep trying
                        reconnectionDelay: 1000,
                        reconnectionDelayMax: 5000,
                        timeout: 20000,
                        upgrade: true,
                        forceNew: true
                  });

                  setSocket(socketInstance);

                  socketInstance.on("connect", () => {
                        setIsConnected(true);
                  });

                  socketInstance.on("disconnect", () => {
                        setIsConnected(false);
                  });

                  socketInstance.on("connect_error", (err) => {
                        console.warn('[Socket] Connection error:', err.message);
                        setIsConnected(false);
                  });

                  socketInstance.on("getOnlineUsers", (users) => {
                        setOnlineUsers(users);
                  });

                  return () => {
                        socketInstance.close();
                        setSocket(null);
                        setIsConnected(false);
                  };
            } else {
                  // user logged out — cleanup is handled by the return() above
                  // No action needed here, avoids stale closure bug
            }
      }, [user, token]);

      return (
            <SocketContext.Provider value={{ socket, onlineUsers, isConnected }}>
                  {children}
            </SocketContext.Provider>
      );
};
