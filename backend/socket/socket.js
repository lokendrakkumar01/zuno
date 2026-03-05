const { Server } = require("socket.io");
const http = require("http");
const express = require("express");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
      cors: {
            origin: [
                  "http://localhost:3000",
                  "http://localhost:5173",
                  "http://127.0.0.1:5173",
                  process.env.FRONTEND_URL || "*"
            ],
            methods: ["GET", "POST", "PUT", "DELETE"]
      }
});

const userSocketMap = {}; // {userId: socketId}

const getReceiverSocketId = (receiverId) => {
      return userSocketMap[receiverId];
};

io.on("connection", (socket) => {
      console.log("A user connected", socket.id);

      const userId = socket.handshake.query.userId;
      if (userId && userId !== "undefined") {
            userSocketMap[userId] = socket.id;
      }

      // Emit event to all connected clients
      io.emit("getOnlineUsers", Object.keys(userSocketMap));

      // Real-time Chat Features (WhatsApp-like)
      socket.on("typing", (data) => {
            const receiverSocketId = getReceiverSocketId(data.receiverId);
            if (receiverSocketId) {
                  io.to(receiverSocketId).emit("typing", { senderId: userId });
            }
      });

      socket.on("stopTyping", (data) => {
            const receiverSocketId = getReceiverSocketId(data.receiverId);
            if (receiverSocketId) {
                  io.to(receiverSocketId).emit("stopTyping", { senderId: userId });
            }
      });

      socket.on("messageRead", (data) => {
            const receiverSocketId = getReceiverSocketId(data.receiverId);
            if (receiverSocketId) {
                  io.to(receiverSocketId).emit("messageRead", { messageId: data.messageId, readerId: userId });
            }
      });

      socket.on("disconnect", () => {
            console.log("User disconnected", socket.id);
            if (userId && userSocketMap[userId]) {
                  delete userSocketMap[userId];
            }
            io.emit("getOnlineUsers", Object.keys(userSocketMap));
      });
});

module.exports = { app, io, server, getReceiverSocketId };
