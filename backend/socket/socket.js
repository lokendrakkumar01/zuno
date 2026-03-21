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
      pingTimeout: 10000, // 10s timeout — extremely fast detection of broken lines
      pingInterval: 5000, // Very aggressive 5s ping to keep cellular/flaky links alive
      transports: ['websocket', 'polling'], // Allow polling fallback for networks blocking strict WebSockets
      perMessageDeflate: false // Disable compression for faster small message delivery
});

const userSocketMap = {}; // {userId: count} - track online status simply
const activeCalls = new Map(); // {socketId: otherPartyId} - track active calls for sudden disconnects

io.on("connection", (socket) => {
      console.log("A user connected", socket.id);

      const userId = socket.handshake.query.userId;
      if (userId && userId !== "undefined") {
            // Join a personal room to receive events across all their devices/tabs
            socket.join(userId);
            userSocketMap[userId] = (userSocketMap[userId] || 0) + 1;
      }

      // Emit event to all connected clients
      io.emit("getOnlineUsers", Object.keys(userSocketMap));

      // Real-time Chat Features (WhatsApp-like)
      socket.on("typing", (data) => {
            if (data.receiverId) {
                  io.to(data.receiverId).volatile.emit("typing", { senderId: userId });
            }
      });

      socket.on("stopTyping", (data) => {
            if (data.receiverId) {
                  io.to(data.receiverId).volatile.emit("stopTyping", { senderId: userId });
            }
      });

      socket.on("messageRead", (data) => {
            if (data.receiverId) {
                  io.to(data.receiverId).emit("messageRead", { messageId: data.messageId, readerId: userId });
            }
      });

      // WebRTC Call Signaling (Using volatile to avoid queue blocking for realtime state)
      socket.on("callUser", (data) => {
            if (data.userToCall) {
                  activeCalls.set(socket.id, data.userToCall);
                  io.to(data.userToCall).emit("callUser", {
                        signal: data.signalData,
                        from: data.from,
                        callType: data.callType // 'voice' or 'video'
                  }); // Normal emit for initial call so it doesn't get dropped
            }
      });

      // Trickle ICE candidates (asynchronous WebRTC signals)
      socket.on("webrtcSignal", (data) => {
            if (data.to) {
                  io.to(data.to).volatile.emit("webrtcSignal", data.signal);
            }
      });

      socket.on("answerCall", (data) => {
            if (data.to) {
                  activeCalls.set(socket.id, data.to);
                  io.to(data.to).emit("callAccepted", data.signal);
            }
      });

      socket.on("cancelCall", (data) => {
            activeCalls.delete(socket.id);
            if (data.to) {
                  io.to(data.to).emit("callCancelled");
            }
      });

      socket.on("leaveCall", (data) => {
            activeCalls.delete(socket.id);
            if (data.to) {
                  io.to(data.to).emit("callEnded");
            }
      });

      socket.on("disconnect", () => {
            console.log("User disconnected", socket.id);

            // If the user was in an active call and abruptly disconnected (e.g., refresh), notify the other party
            const otherPartyId = activeCalls.get(socket.id);
            if (otherPartyId) {
                  io.to(otherPartyId).emit("callEnded");
                  activeCalls.delete(socket.id);
            }

            if (userId && userSocketMap[userId]) {
                  userSocketMap[userId]--;
                  if (userSocketMap[userId] === 0) {
                        delete userSocketMap[userId];
                  }
            }
            io.emit("getOnlineUsers", Object.keys(userSocketMap));
      });
});

// Helper for when external code (like HTTP controllers) needs to emit to a user
const getReceiverSocketId = (receiverId) => {
      // Return the room name (which is just the user's ID)
      if (!receiverId) return undefined;
      return receiverId.toString();
};

module.exports = { app, io, server, getReceiverSocketId };
