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
      const { user } = useAuth();

      useEffect(() => {
            if (user) {
                  const userId = (user._id || user.id || user).toString();
                  // Simplified URL logic - let socket.io handle protocol switching
                  const socketUrl = API_URL.replace(/\/api$/, '');

                  const socketInstance = io(socketUrl, {
                        query: { userId },
                        transports: ['websocket'], // Enforce WebSocket for instant delivery
                        reconnection: true,
                        reconnectionAttempts: Infinity,
                        reconnectionDelay: 1000,
                        reconnectionDelayMax: 5000, // Quicker max delay for faster retries
                        timeout: 10000              // 10s connection timeout instead of 20s
                  });

                  setSocket(socketInstance);

                  socketInstance.on("getOnlineUsers", (users) => {
                        setOnlineUsers(users);
                  });

                  return () => socketInstance.close();
            } else {
                  if (socket) {
                        socket.close();
                        setSocket(null);
                  }
            }
      }, [user]);

      return (
            <SocketContext.Provider value={{ socket, onlineUsers }}>
                  {children}
            </SocketContext.Provider>
      );
};
