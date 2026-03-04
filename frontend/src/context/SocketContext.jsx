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
                  const socketUrl = API_URL.replace(/\/api$/, ''); // Ensure we don't double slash if not needed

                  const socketInstance = io(socketUrl, {
                        query: {
                              userId: userId
                        }
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
