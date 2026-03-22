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
      const { user } = useAuth();

      useEffect(() => {
            if (user) {
                  const userId = (user._id || user.id || user).toString();
                  // Remove /api suffix to get base URL for socket connection
                  const socketUrl = API_URL.replace(/\/api$/, '');

                  const socketInstance = io(socketUrl, {
                        query: { userId },
                        // Allow both WebSocket and polling so it works on ALL networks
                        transports: ['websocket', 'polling'],
                        reconnection: true,
                        reconnectionAttempts: 15,
                        reconnectionDelay: 500,
                        reconnectionDelayMax: 5000,
                        timeout: 10000,
                        // Upgrade to websocket as soon as possible
                        upgrade: true,
                        forceNew: false
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
                  if (socket) {
                        socket.close();
                        setSocket(null);
                        setIsConnected(false);
                  }
            }
      }, [user]);

      return (
            <SocketContext.Provider value={{ socket, onlineUsers, isConnected }}>
                  {children}
            </SocketContext.Provider>
      );
};
