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
const activeStreams = new Map(); // {hostUserId: {viewers: Set, ...}} for live streams

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

      // ==========================================
      // GROUP CALL SIGNALING (Mesh WebRTC - up to 4)
      // ==========================================
      socket.on("groupCallUser", (data) => {
            // data: { targetUserId, groupId, from, callType, signalData }
            if (data.targetUserId) {
                  activeCalls.set(socket.id, data.groupId);
                  io.to(data.targetUserId).emit("groupCallIncoming", {
                        signal: data.signalData,
                        from: data.from,
                        groupId: data.groupId,
                        callType: data.callType
                  });
            }
      });

      socket.on("groupCallAnswer", (data) => {
            // data: { to, signal, from, groupId }
            if (data.to) {
                  io.to(data.to).emit("groupCallAccepted", {
                        signal: data.signal,
                        from: data.from,
                        groupId: data.groupId
                  });
            }
      });

      socket.on("groupCallLeft", (data) => {
            // data: { groupId, participants[] }
            activeCalls.delete(socket.id);
            if (data.participants) {
                  data.participants.forEach(uid => {
                        io.to(uid).emit("groupCallParticipantLeft", { userId: userId, groupId: data.groupId });
                  });
            }
      });

      // ==========================================
      // LIVE STREAMING SOCKET EVENTS
      // ==========================================
      socket.on("startStream", (data) => {
            // data: { hostId, title, roomId }
            const roomId = data.roomId || `stream_${data.hostId}`;
            socket.join(roomId);
            activeStreams.set(data.hostId, { roomId, viewers: new Set(), hostSocketId: socket.id });
            io.emit("streamStarted", { hostId: data.hostId, title: data.title, roomId });
      });

      socket.on("joinStream", (data) => {
            // data: { hostId, viewerId }
            const stream = activeStreams.get(data.hostId);
            if (!stream) {
                  socket.emit("streamNotFound");
                  return;
            }
            socket.join(stream.roomId);
            stream.viewers.add(data.viewerId);
            const viewerCount = stream.viewers.size;
            // Notify host about new viewer
            io.to(stream.hostSocketId).emit("viewerJoined", { viewerId: data.viewerId, viewerCount });
            // Send stream info to viewer including host's socket ID for direct signaling
            socket.emit("streamJoined", { 
                  hostId: data.hostId, 
                  roomId: stream.roomId, 
                  viewerCount,
                  hostSocketId: stream.hostSocketId
            });
            // Tell host to initiate WebRTC stream to this viewer
            io.to(stream.hostSocketId).emit("initPeerWithViewer", { viewerId: data.viewerId, viewerSocketId: socket.id });
      });

      socket.on("streamSignal", (data) => {
            // data: { to (socketId), signal }
            if (data.to) io.to(data.to).emit("streamSignal", { signal: data.signal, from: socket.id });
      });

      socket.on("streamComment", (data) => {
            // data: { hostId, comment, username, avatar }
            const stream = activeStreams.get(data.hostId);
            if (stream) {
                  io.to(stream.roomId).emit("newStreamComment", {
                        comment: data.comment,
                        username: data.username,
                        avatar: data.avatar,
                        timestamp: new Date().toISOString()
                  });
            }
      });

      socket.on("endStream", (data) => {
            // data: { hostId }
            const stream = activeStreams.get(data.hostId);
            if (stream) {
                  io.to(stream.roomId).emit("streamEnded", { hostId: data.hostId });
                  activeStreams.delete(data.hostId);
            }
      });

      socket.on("leaveStreamView", (data) => {
            // data: { hostId, viewerId }
            const stream = activeStreams.get(data.hostId);
            if (stream) {
                  stream.viewers.delete(data.viewerId);
                  socket.leave(stream.roomId);
                  io.to(stream.hostSocketId).emit("viewerLeft", { viewerId: data.viewerId, viewerCount: stream.viewers.size });
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

            // If the disconnecting socket was a live stream HOST, clean up and notify viewers
            for (const [hostUserId, stream] of activeStreams.entries()) {
                  if (stream.hostSocketId === socket.id) {
                        io.to(stream.roomId).emit("streamEnded", { hostId: hostUserId });
                        activeStreams.delete(hostUserId);
                        console.log(`[Stream] Host ${hostUserId} disconnected — stream ended`);
                        break;
                  }
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

module.exports = { app, io, server, getReceiverSocketId, activeStreams };
