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
                  const userId = user._id || user.id || user;
                  // Ensure we use the base url without /api
                  let socketUrl = API_URL.replace(/\/api$/, '');
                  // For Render production, enforce secure websocket (wss://) if the URL is https
                  if (socketUrl.startsWith('https://')) {
                        socketUrl = socketUrl.replace('https://', 'wss://');
                  } else if (socketUrl.startsWith('http://')) {
                        socketUrl = socketUrl.replace('http://', 'ws://');
                  }

                  // In production (Render), ensure it uses secure websockets by letting socket.io handle it
                  const socketInstance = io(socketUrl, {
                        query: {
                              userId: userId
                        },
                        transports: ['websocket'], // Force websocket for speed
                        reconnection: true,
                        reconnectionAttempts: 10,
                        reconnectionDelay: 500, // Faster reconnection attempts
                        timeout: 20000
                  });

                  setSocket(socketInstance);

                  // socket.on is used to listen to the events. can be used both on client and server side
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
