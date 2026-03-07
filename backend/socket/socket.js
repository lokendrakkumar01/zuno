const { Server } = require("socket.io");
const http = require("http");
const express = require("express");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
      cors: {
            origin: "*",
            methods: ["GET", "POST", "PUT", "DELETE"],
            credentials: false
      },
      allowEIO3: true,  // backward-compat with older socket.io clients
      pingTimeout: 30000, // 30s timeout — tolerates short drops but faster than 60s
      pingInterval: 10000, // Fast ping every 10s to keep connection extremely active
      transports: ['websocket', 'polling'], // Allow polling fallback for networks blocking strict WebSockets
      perMessageDeflate: false // Disable compression for faster small message delivery
});

const userSocketMap = {}; // {userId: socketId}

const getReceiverSocketId = (receiverId) => {
      if (!receiverId) return undefined;
      return userSocketMap[receiverId.toString()];
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

      // WebRTC Call Signaling
      socket.on("callUser", (data) => {
            const receiverSocketId = getReceiverSocketId(data.userToCall);
            if (receiverSocketId) {
                  io.to(receiverSocketId).emit("callUser", {
                        signal: data.signalData,
                        from: data.from,
                        callType: data.callType // 'voice' or 'video'
                  });
            }
      });

      socket.on("answerCall", (data) => {
            const receiverSocketId = getReceiverSocketId(data.to);
            if (receiverSocketId) {
                  io.to(receiverSocketId).emit("callAccepted", data.signal);
            }
      });

      socket.on("cancelCall", (data) => {
            // Caller cancelled before callee answered
            const receiverSocketId = getReceiverSocketId(data.to);
            if (receiverSocketId) {
                  io.to(receiverSocketId).emit("callCancelled");
            }
      });

      socket.on("leaveCall", (data) => {
            const receiverSocketId = getReceiverSocketId(data.to);
            if (receiverSocketId) {
                  io.to(receiverSocketId).emit("callEnded");
            }
      });

      socket.on("disconnect", () => {
            console.log("User disconnected", socket.id);
            if (userId && userSocketMap[userId] === socket.id) {
                  delete userSocketMap[userId];
            }
            io.emit("getOnlineUsers", Object.keys(userSocketMap));
      });
});

module.exports = { app, io, server, getReceiverSocketId };
