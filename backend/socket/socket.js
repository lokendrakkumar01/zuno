const { Server } = require("socket.io");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'https://zunoworld.tech',
  'https://www.zunoworld.tech',
  'https://zuno-frontend.onrender.com',
  'https://zuno-admin.onrender.com',
  'http://localhost:3000',
  'https://localhost:3000',
  'http://localhost:5173',
];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || /\.onrender\.com$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Socket CORS: origin ${origin} not allowed`), false);
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  pingTimeout: 10000,
  pingInterval: 5000,
  transports: ['websocket', 'polling'],
  perMessageDeflate: false
});

// ============================================================
// JWT AUTH MIDDLEWARE — verify token before ANY socket event
// ============================================================
io.use((socket, next) => {
  // Token can come from handshake.auth.token (preferred) or header
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
  if (!token) {
    console.warn(`[Socket] Rejected unauthenticated connection: ${socket.id}`);
    return next(new Error('Authentication required'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id; // set from verified JWT, NOT from query string
    next();
  } catch (err) {
    console.warn(`[Socket] Rejected invalid token: ${socket.id}`);
    return next(new Error('Invalid or expired token'));
  }
});

const userSocketMap = {};  // {userId: count}
const activeDirectCalls = new Map(); // {userId: { peerId, updatedAt }}
const pendingDirectCallDisconnects = new Map(); // {userId: timeoutId}
const activeStreams = new Map(); // {hostUserId: {viewers: Set, ...}}
const streamCommentCooldowns = new Map(); // {"hostId:userId": timestamp}

const DIRECT_CALL_DISCONNECT_GRACE_MS = 12000;
const STREAM_SLOW_MODE_COOLDOWN_MS = 5000;

const normalizeId = (value) => value?.toString?.() || null;

const clearPendingDirectCallDisconnect = (userId) => {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) return;

  const timer = pendingDirectCallDisconnects.get(normalizedUserId);
  if (timer) {
    clearTimeout(timer);
    pendingDirectCallDisconnects.delete(normalizedUserId);
  }
};

const setDirectCallLink = (userId, peerId) => {
  const normalizedUserId = normalizeId(userId);
  const normalizedPeerId = normalizeId(peerId);
  if (!normalizedUserId || !normalizedPeerId) return;

  clearPendingDirectCallDisconnect(normalizedUserId);
  clearPendingDirectCallDisconnect(normalizedPeerId);
  activeDirectCalls.set(normalizedUserId, { peerId: normalizedPeerId, updatedAt: Date.now() });
};

const clearDirectCallLink = (userId, peerId) => {
  const normalizedUserId = normalizeId(userId);
  const normalizedPeerId = normalizeId(peerId);
  if (!normalizedUserId) return;

  const current = activeDirectCalls.get(normalizedUserId);
  if (!current) return;
  if (normalizedPeerId && current.peerId !== normalizedPeerId) return;

  activeDirectCalls.delete(normalizedUserId);
};

const endDirectCall = (userId, peerId, notifyPeer = false) => {
  const normalizedUserId = normalizeId(userId);
  const normalizedPeerId = normalizeId(peerId);

  clearPendingDirectCallDisconnect(normalizedUserId);
  clearPendingDirectCallDisconnect(normalizedPeerId);
  clearDirectCallLink(normalizedUserId, normalizedPeerId);
  clearDirectCallLink(normalizedPeerId, normalizedUserId);

  if (notifyPeer && normalizedPeerId) {
    io.to(normalizedPeerId).emit("callEnded");
  }
};

const scheduleDirectCallDisconnect = (userId, peerId) => {
  const normalizedUserId = normalizeId(userId);
  const normalizedPeerId = normalizeId(peerId);
  if (!normalizedUserId || !normalizedPeerId) return;

  clearPendingDirectCallDisconnect(normalizedUserId);

  const timeoutId = setTimeout(() => {
    pendingDirectCallDisconnects.delete(normalizedUserId);

    const current = activeDirectCalls.get(normalizedUserId);
    if (!current || current.peerId !== normalizedPeerId) {
      return;
    }

    if ((userSocketMap[normalizedUserId] || 0) > 0) {
      return;
    }

    endDirectCall(normalizedUserId, normalizedPeerId, true);
  }, DIRECT_CALL_DISCONNECT_GRACE_MS);

  pendingDirectCallDisconnects.set(normalizedUserId, timeoutId);
};

io.on("connection", (socket) => {
  const userId = socket.userId; // from JWT, safe
  console.log(`[Socket] Connected: ${socket.id} (user: ${userId})`);

  if (userId) {
    socket.join(userId);
    userSocketMap[userId] = (userSocketMap[userId] || 0) + 1;
    clearPendingDirectCallDisconnect(userId);
    
    // Update online status in DB
    User.findByIdAndUpdate(userId, { isOnline: true, offlineStatus: null }).catch(err => {
      console.error(`[Socket] Error updating online status for ${userId}:`, err);
    });
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("typing", (data) => {
    if (data.receiverId) {
      io.to(data.receiverId).emit("typing", { senderId: userId });
    }
  });

  socket.on("joinConversation", (data) => {
    if (!data?.conversationId) return;
    socket.join(`conversation:${data.conversationId}`);
  });

  socket.on("leaveConversation", (data) => {
    if (!data?.conversationId) return;
    socket.leave(`conversation:${data.conversationId}`);
  });

  socket.on("stopTyping", (data) => {
    if (data.receiverId) {
      io.to(data.receiverId).emit("stopTyping", { senderId: userId });
    }
  });

  socket.on("messageRead", (data) => {
    if (data.receiverId) {
      io.to(data.receiverId).emit("messageRead", { messageId: data.messageId, readerId: userId });
    }
  });

  // ── 1:1 WebRTC Calls ─────────────────────────────────────
  socket.on("callUser", (data) => {
    if (data.userToCall) {
      setDirectCallLink(userId, data.userToCall);
      io.to(data.userToCall).emit("callUser", {
        signal: data.signalData,
        from: data.from,
        callType: data.callType
      });
    }
  });

  socket.on("webrtcSignal", (data) => {
    if (data.to) {
      io.to(data.to).emit("webrtcSignal", data.signal);
    }
  });

  socket.on("answerCall", (data) => {
    if (data.to) {
      setDirectCallLink(userId, data.to);
      setDirectCallLink(data.to, userId);
      io.to(data.to).emit("callAccepted", data.signal);
    }
  });

  socket.on("cancelCall", (data) => {
    endDirectCall(userId, data?.to, false);
    if (data.to) io.to(data.to).emit("callCancelled");
  });

  socket.on("leaveCall", (data) => {
    endDirectCall(userId, data?.to, false);
    if (data.to) io.to(data.to).emit("callEnded");
  });

  // ── Group Calls ───────────────────────────────────────────
  socket.on("groupCallUser", (data) => {
    if (data.targetUserId) {
      io.to(data.targetUserId).emit("groupCallIncoming", {
        signal: data.signalData,
        from: data.from,
        groupId: data.groupId,
        callType: data.callType
      });
    }
  });

  socket.on("groupCallAnswer", (data) => {
    if (data.to) {
      io.to(data.to).emit("groupCallAccepted", {
        signal: data.signal,
        from: data.from,
        groupId: data.groupId
      });
    }
  });

  socket.on("groupCallLeft", (data) => {
    if (data.participants) {
      data.participants.forEach(uid => {
        io.to(uid).emit("groupCallParticipantLeft", { userId, groupId: data.groupId });
      });
    }
  });

  // ── Live Streaming (Socket signaling + chat; video via LiveKit SFU) ──
  socket.on("startStream", (data) => {
    const roomId = data.roomId || `stream_${userId}`;
    const existingStream = activeStreams.get(userId) || {};
    socket.join(roomId);
    activeStreams.set(userId, {
      ...existingStream,
      id: existingStream.id || roomId,
      hostId: existingStream.hostId || userId,
      roomId,
      title: data.title || existingStream.title || '',
      description: data.description || existingStream.description || '',
      viewers: existingStream.viewers || new Set(),
      hostSocketId: socket.id,
      bannedViewers: existingStream.bannedViewers || new Set(),
      slowMode: existingStream.slowMode || false,
      pinnedComment: existingStream.pinnedComment || null
    });
    io.emit("streamStarted", { hostId: userId, title: data.title, roomId });
    console.log(`[Stream] Started by ${userId} — room: ${roomId}`);
  });

  socket.on("joinStream", (data) => {
    if (!data?.hostId) return;
    const stream = activeStreams.get(data.hostId);
    if (!stream || (!stream.hostSocketId && !stream.liveKitProvisioned)) {
      return socket.emit("streamNotFound");
    }

    stream.viewers = stream.viewers || new Set();
    stream.bannedViewers = stream.bannedViewers || new Set();

    if (stream.bannedViewers?.has(userId)) {
      return socket.emit("streamBanned", { reason: 'You have been removed from this stream.' });
    }

    const roomId = stream.roomId || stream.id || `stream_${data.hostId}`;
    stream.roomId = roomId;
    socket.join(roomId);
    stream.viewers.add(userId);
    const viewerCount = stream.viewers.size;

    if (stream.hostSocketId) {
      io.to(stream.hostSocketId).emit("viewerJoined", { viewerId: userId, viewerCount });
    }

    socket.emit("streamJoined", {
      hostId: data.hostId, roomId, viewerCount,
      hostSocketId: stream.hostSocketId,
      slowMode: stream.slowMode,
      pinnedComment: stream.pinnedComment
    });

    if (stream.hostSocketId) {
      io.to(stream.hostSocketId).emit("initPeerWithViewer", { viewerId: userId, viewerSocketId: socket.id });
    }
  });

  socket.on("streamSignal", (data) => {
    if (data.to) io.to(data.to).emit("streamSignal", { signal: data.signal, from: socket.id });
  });

  socket.on("streamComment", (data) => {
    const stream = activeStreams.get(data.hostId);
    if (!stream) return;
    if (stream.bannedViewers?.has(userId)) return;

    const commentText = String(data.comment || '');
    const isReaction = commentText.startsWith('REACTION:');

    if (stream.slowMode && !isReaction && normalizeId(userId) !== normalizeId(data.hostId)) {
      const cooldownKey = `${normalizeId(data.hostId)}:${normalizeId(userId)}`;
      const lastCommentAt = streamCommentCooldowns.get(cooldownKey) || 0;
      if (Date.now() - lastCommentAt < STREAM_SLOW_MODE_COOLDOWN_MS) {
        return;
      }
      streamCommentCooldowns.set(cooldownKey, Date.now());
    }

    io.to(stream.roomId).emit("newStreamComment", {
      comment: commentText, username: data.username,
      avatar: data.avatar, userId, timestamp: new Date().toISOString()
    });
  });

  socket.on("streamReaction", (data) => {
    const stream = activeStreams.get(data.hostId);
    if (stream) {
      io.to(stream.roomId).emit("streamReaction", { emoji: data.emoji, userId });
    }
  });

  socket.on("pinStreamComment", (data) => {
    // Only host can pin
    const stream = activeStreams.get(userId);
    if (!stream) return;
    stream.pinnedComment = data.comment;
    io.to(stream.roomId).emit("streamCommentPinned", { comment: data.comment });
  });

  socket.on("kickStreamViewer", (data) => {
    // Only host can kick
    const stream = activeStreams.get(userId);
    if (!stream) return;
    stream.bannedViewers.add(data.viewerId);
    stream.viewers.delete(data.viewerId);
    io.to(data.viewerId).emit("streamKicked", { reason: data.reason || 'Removed by host' });
    io.to(stream.roomId).emit("viewerLeft", { viewerId: data.viewerId, viewerCount: stream.viewers.size });
    console.log(`[Stream] Viewer ${data.viewerId} kicked from stream of ${userId}`);
  });

  socket.on("setSlowMode", (data) => {
    const stream = activeStreams.get(userId);
    if (!stream) return;
    stream.slowMode = !!data.enabled;
    io.to(stream.roomId).emit("slowModeUpdated", { enabled: stream.slowMode });
  });

  socket.on("endStream", (data) => {
    const stream = activeStreams.get(userId);
    if (stream) {
      io.to(stream.roomId).emit("streamEnded", { hostId: userId });
      activeStreams.delete(userId);
      console.log(`[Stream] Ended by host ${userId}`);
    }
  });

  socket.on("leaveStreamView", (data) => {
    const stream = activeStreams.get(data.hostId);
    if (stream) {
      stream.viewers = stream.viewers || new Set();
      stream.viewers.delete(userId);
      socket.leave(stream.roomId || stream.id || `stream_${data.hostId}`);
      if (stream.hostSocketId) {
        io.to(stream.hostSocketId).emit("viewerLeft", { viewerId: userId, viewerCount: stream.viewers.size });
      }
    }
  });

  // ── Disconnect ────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`[Socket] Disconnected: ${socket.id} (user: ${userId})`);

    for (const [hostUserId, stream] of activeStreams.entries()) {
      if (stream.hostSocketId === socket.id) {
        io.to(stream.roomId).emit("streamEnded", { hostId: hostUserId });
        activeStreams.delete(hostUserId);
        console.log(`[Stream] Host ${hostUserId} disconnected — stream ended`);
      } else if (stream.viewers?.has(userId)) {
        stream.viewers.delete(userId);
        if (stream.hostSocketId) {
          io.to(stream.hostSocketId).emit("viewerLeft", { viewerId: userId, viewerCount: stream.viewers.size });
        }
      }
    }

    if (userId) {
      userSocketMap[userId] = Math.max(0, (userSocketMap[userId] || 0) - 1);
      if (userSocketMap[userId] === 0) {
        delete userSocketMap[userId];
        const directCall = activeDirectCalls.get(userId);
        if (directCall?.peerId) {
          scheduleDirectCallDisconnect(userId, directCall.peerId);
        }
        // Update offline status in DB
        User.findByIdAndUpdate(userId, { isOnline: false, offlineStatus: new Date() }).catch(err => {
          console.error(`[Socket] Error updating offline status for ${userId}:`, err);
        });
      }
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

const getReceiverSocketId = (receiverId) => {
  if (!receiverId) return undefined;
  return receiverId.toString();
};

module.exports = { app, io, server, getReceiverSocketId, activeStreams };
