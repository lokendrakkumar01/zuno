import { createContext, useState, useEffect, useContext } from "react";
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

      useEffect(() => {
            if (user && token) {
                  const socketInstance = io(SOCKET_URL, {
                        auth: { token },
                        transports: ['websocket', 'polling'],
                        withCredentials: true,
                        reconnection: true,
                        reconnectionAttempts: 20,
                        reconnectionDelay: 500,
                        reconnectionDelayMax: 3000,
                        randomizationFactor: 0.25,
                        timeout: 10000,
                        upgrade: true,
                        rememberUpgrade: true,
                        autoConnect: true
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

                  socketInstance.on("reconnect_attempt", () => {
                        setIsConnected(false);
                  });

                  socketInstance.on("getOnlineUsers", (users) => {
                        setOnlineUsers(users);
                  });

                  return () => {
                        socketInstance.off("connect");
                        socketInstance.off("disconnect");
                        socketInstance.off("connect_error");
                        socketInstance.off("reconnect_attempt");
                        socketInstance.off("getOnlineUsers");
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
