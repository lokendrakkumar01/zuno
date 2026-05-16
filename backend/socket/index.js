/**
 * socket/index.js — FIX: PROBLEMS 1, 2, 3, 6
 *
 * FIX PROBLEM 1 (Message slow):
 *   - transports: ['websocket'] only — no polling fallback = instant delivery
 *   - Emit to receiver BEFORE awaiting DB write (fire-and-forget DB update)
 *   - Conversation lastMessage update is setImmediate (non-blocking)
 *
 * FIX PROBLEM 2 (Calling broken):
 *   - Complete callUser / acceptCall / rejectCall / endCall / iceCandidate flow
 *   - Auto-timeout with cleanup after 30 s if unanswered
 *   - All events in both camelCase and kebab-case for client compat
 *
 * FIX PROBLEM 3 (Socket errors):
 *   - CORS allows all project origins + env vars
 *   - JWT auth middleware validates every connection before join
 *   - userSocketMap tracks all socket IDs per userId (multi-tab safe)
 *   - Reconnect handled by socket.io built-ins + pingTimeout/pingInterval
 *
 * FIX PROBLEM 6 (Missing features):
 *   - typing / stopTyping events
 *   - message-delivered + message-read status events
 *   - Conversation lastMessage updated in background (setImmediate)
 */

'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Message, Conversation } = require('../models/Message');
const { createNotification } = require('../utils/notificationService');

// ─── State ───────────────────────────────────────────────────────────────────
// userSocketMap: userId (string) → Set of socketId strings  (multi-tab safe)
const userSocketMap = new Map();   // userId  → Set<socketId>
const socketUserMap = new Map();   // socketId → userId

let io; // singleton

// ─── Helpers ─────────────────────────────────────────────────────────────────

const normalizeId = (v) => (v?.toString?.() || String(v || ''));

const ts = () => new Date();

/** Register a socket for a user */
const addSocket = (userId, socketId) => {
  const id = normalizeId(userId);
  const set = userSocketMap.get(id) || new Set();
  set.add(socketId);
  userSocketMap.set(id, set);
  socketUserMap.set(socketId, id);
};

/** Remove a socket; return userId if that was their last socket */
const removeSocket = (socketId) => {
  const userId = socketUserMap.get(socketId);
  if (!userId) return null;
  const set = userSocketMap.get(userId) || new Set();
  set.delete(socketId);
  if (set.size) userSocketMap.set(userId, set);
  else userSocketMap.delete(userId);
  socketUserMap.delete(socketId);
  return userId;
};

/** Emit to ALL sockets of a user (multi-tab). Returns true if delivered. */
const emitToUser = (userId, event, data) => {
  const id = normalizeId(userId);
  const sockets = userSocketMap.get(id);
  if (!sockets || sockets.size === 0) return false;
  sockets.forEach((sid) => io.to(sid).emit(event, data));
  return true;
};

const getOnlineUsers = () => Array.from(userSocketMap.keys());

const broadcastOnline = () => {
  const online = getOnlineUsers();
  // FIX PROBLEM 3: broadcast under both event names for client compat
  io.emit('online-users', online);
  io.emit('getOnlineUsers', online);
};

/** Persist online/offline flag to DB (best-effort, non-blocking) */
const persistPresence = (userId, isOnline) =>
  User.findByIdAndUpdate(userId,
    isOnline
      ? { isOnline: true, offlineStatus: null }
      : { isOnline: false, offlineStatus: ts() }
  ).catch((err) => console.warn('[Socket] presence DB error:', err.message));

// ─── Init ─────────────────────────────────────────────────────────────────────

const initSocket = (server) => {
  // FIX PROBLEM 3: comprehensive CORS allow-list
  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3002',
    'https://zunoworld.tech',
    'https://www.zunoworld.tech',
    'https://zuno-admin.onrender.com',
    ...(process.env.CLIENT_URL  || '').split(',').map((o) => o.trim()).filter(Boolean),
    ...(process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
  ]);

  io = new Server(server, {
    // FIX PROBLEM 1 & 3: websocket-only — no polling overhead
    transports: ['websocket'],
    cors: {
      origin(origin, cb) {
        // Allow requests with no Origin header (e.g. server-side / Postman)
        if (!origin || allowedOrigins.has(origin)) return cb(null, true);
        return cb(new Error(`Socket CORS blocked: ${origin}`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // FIX PROBLEM 3: aggressive ping to detect dead connections fast
    pingTimeout:     30000,
    pingInterval:    10000,
    maxHttpBufferSize: 10 * 1024 * 1024, // 10 MB for media payloads
  });

  // ─── JWT Auth Middleware — FIX PROBLEM 3 ───────────────────────────────────
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
      if (!token) return next(new Error('AUTH_REQUIRED'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = normalizeId(decoded.id || decoded._id);
      return next();
    } catch {
      return next(new Error('AUTH_INVALID'));
    }
  });

  // ─── Connection ───────────────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const userId = socket.userId;

    try {
      // Join personal room + register in maps
      socket.join(userId);
      addSocket(userId, socket.id);
      broadcastOnline();

      // FIX PROBLEM 3: non-blocking presence write
      setImmediate(() => persistPresence(userId, true));

      // ── TYPING INDICATORS — FIX PROBLEM 6 ──────────────────────────────
      socket.on('typing', ({ receiverId } = {}) => {
        if (receiverId) emitToUser(receiverId, 'typing', { senderId: userId });
      });

      socket.on('stopTyping', ({ receiverId } = {}) => {
        if (receiverId) emitToUser(receiverId, 'stopTyping', { senderId: userId });
      });

      // Legacy aliases
      socket.on('stop-typing', ({ receiverId } = {}) => {
        if (receiverId) emitToUser(receiverId, 'stopTyping', { senderId: userId });
      });

      // ── SEND MESSAGE — FIX PROBLEMS 1 & 6 ──────────────────────────────
      socket.on('send-message', handleSendMessage);
      socket.on('send_message', handleSendMessage);

      async function handleSendMessage(payload = {}, ack = () => {}) {
        try {
          const receiverId = normalizeId(payload.receiverId || payload.receiver || payload.to);
          if (!receiverId) throw new Error('receiverId required');

          const text = String(payload.text || '').trim().slice(0, 2000);
          const clientMsgId = payload.clientMsgId || null;

          // FIX PROBLEM 1: construct optimistic payload BEFORE hitting DB
          const optimisticPayload = {
            _id:          `opt_${Date.now()}`, // temp id, replaced after DB insert
            clientMsgId,
            sender:       { _id: userId, id: userId },
            receiver:     receiverId,
            text,
            media:        payload.media || null,
            status:       'sent',
            createdAt:    ts().toISOString(),
          };

          // FIX PROBLEM 1: deliver to receiver IMMEDIATELY (before DB write)
          emitToUser(receiverId, 'newMessage', optimisticPayload);
          // Also echo to sender's other tabs immediately
          const sockets = userSocketMap.get(userId) || new Set();
          sockets.forEach((sid) => {
            if (sid !== socket.id) io.to(sid).emit('newMessage', optimisticPayload);
          });

          // Persist to DB (can happen in parallel with delivery)
          const message = await Message.create({
            sender:       userId,
            receiver:     receiverId,
            text,
            media:        payload.media || undefined,
            replyTo:      payload.replyTo || undefined,
            clientMsgId:  clientMsgId || undefined,
            status:       'sent',
          });

          const finalPayload = {
            ...message.toObject(),
            _id:      normalizeId(message._id),
            clientMsgId,
            sender:   { _id: userId, id: userId },
            receiver: receiverId,
            status:   'sent',
          };

          // FIX PROBLEM 1: replace optimistic with real message on both sides
          emitToUser(receiverId, 'newMessage', finalPayload);
          sockets.forEach((sid) => io.to(sid).emit('newMessage', finalPayload));

          // FIX PROBLEM 6: update Conversation lastMessage in background (non-blocking)
          setImmediate(() => updateConversationLastMessage(userId, receiverId, text, message._id));

          // FIX PROBLEM 6: mark as delivered if receiver is online
          const delivered = userSocketMap.has(normalizeId(receiverId));
          if (delivered) {
            Message.findByIdAndUpdate(message._id, { status: 'delivered', deliveredAt: ts() })
              .catch(() => {});
            finalPayload.status = 'delivered';
            socket.emit('message-status', { messageId: normalizeId(message._id), status: 'delivered' });
          }

          // Notify (fire-and-forget)
          createNotification({
            recipientId: receiverId,
            actor: userId,
            type: 'message',
            title: 'New message',
            body: text || 'Media shared',
            entityType: 'message',
            entityId: normalizeId(message._id),
          }).catch(() => {});

          return ack({ success: true, message: finalPayload });
        } catch (err) {
          return ack({ success: false, message: err.message });
        }
      }

      // ── MESSAGE STATUS — FIX PROBLEM 6 ─────────────────────────────────

      // Delivered confirmation from receiver
      socket.on('message-delivered', async ({ messageId, senderId } = {}, ack = () => {}) => {
        try {
          if (!messageId) throw new Error('messageId required');
          await Message.findByIdAndUpdate(messageId, { status: 'delivered', deliveredAt: ts() });
          if (senderId) {
            emitToUser(senderId, 'message-status', { messageId, status: 'delivered' });
          }
          ack({ success: true });
        } catch (err) {
          ack({ success: false, message: err.message });
        }
      });

      // Read receipt from receiver
      const handleMessageRead = async ({ messageId, senderId } = {}, ack = () => {}) => {
        try {
          if (!messageId) throw new Error('messageId required');
          await Message.findByIdAndUpdate(messageId, { read: true, status: 'read', readAt: ts() });
          if (senderId) {
            emitToUser(senderId, 'message-status', { messageId, status: 'read', readerId: userId });
          }
          ack({ success: true });
        } catch (err) {
          ack({ success: false, message: err.message });
        }
      };

      socket.on('message-read', handleMessageRead);
      socket.on('messageRead',  handleMessageRead);

      // ── CALLING — FIX PROBLEM 2 ─────────────────────────────────────────
      //
      // Full WebRTC signaling flow:
      //   Caller  → callUser      → Server → Receiver (incoming-call)
      //   Receiver→ acceptCall    → Server → Caller   (call-accepted)
      //   Either  → rejectCall    → Server → Other    (call-rejected)
      //   Either  → endCall       → Server → Other    (call-ended)
      //   Both    → iceCandidate  → Server → Other    (ice-candidate)

      const callTimeouts = new Map(); // callerUserId-receiverUserId → timer

      /** callUser — FIX PROBLEM 2: instantly notify receiver */
      const handleCallUser = (payload = {}, ack = () => {}) => {
        try {
          const to = normalizeId(payload.userToCall || payload.to || payload.calleeId);
          if (!to) throw new Error('calleeId required');

          const callData = {
            from:     userId,
            caller:   payload.from || payload.caller || null,
            signal:   payload.signalData || payload.signal || payload.offer,
            callType: payload.callType || 'video',
          };

          // FIX PROBLEM 2: immediate delivery — no DB round-trip
          const delivered = emitToUser(to, 'incoming-call', callData);
          // Also emit under legacy event name
          emitToUser(to, 'callUser', callData);

          ack({ success: delivered });

          // Auto-timeout: cancel call if no answer in 30 s
          const key = `${userId}:${to}`;
          if (callTimeouts.has(key)) clearTimeout(callTimeouts.get(key));
          const tid = setTimeout(() => {
            callTimeouts.delete(key);
            socket.emit('call-timeout', { to });
            emitToUser(to, 'call-rejected', { from: userId, reason: 'timeout' });
          }, 30_000);
          callTimeouts.set(key, tid);
        } catch (err) {
          ack({ success: false, message: err.message });
        }
      };

      socket.on('callUser',   handleCallUser);
      socket.on('call-user',  handleCallUser);
      socket.on('call_user',  handleCallUser);

      /** acceptCall — FIX PROBLEM 2 */
      const handleAcceptCall = (payload = {}, ack = () => {}) => {
        try {
          const to = normalizeId(payload.to || payload.callerId);
          if (!to) throw new Error('callerId required');

          // Clear timeout for this call pair
          const key = `${to}:${userId}`;
          if (callTimeouts.has(key)) {
            clearTimeout(callTimeouts.get(key));
            callTimeouts.delete(key);
          }

          const acceptData = {
            from:   userId,
            signal: payload.signal || payload.answer,
          };
          emitToUser(to, 'call-accepted', acceptData);
          emitToUser(to, 'callAccepted',  acceptData);

          ack({ success: true });
        } catch (err) {
          ack({ success: false, message: err.message });
        }
      };

      socket.on('acceptCall',    handleAcceptCall);
      socket.on('answerCall',    handleAcceptCall);
      socket.on('call-accepted', handleAcceptCall);

      /** rejectCall — FIX PROBLEM 2 */
      const handleRejectCall = (payload = {}, ack = () => {}) => {
        try {
          const to = normalizeId(payload.to || payload.callerId);
          if (!to) throw new Error('callerId required');

          const key = `${to}:${userId}`;
          if (callTimeouts.has(key)) {
            clearTimeout(callTimeouts.get(key));
            callTimeouts.delete(key);
          }

          const rejectData = { from: userId, reason: payload.reason || 'rejected' };
          emitToUser(to, 'call-rejected',  rejectData);
          emitToUser(to, 'callCancelled',  rejectData);

          ack({ success: true });
        } catch (err) {
          ack({ success: false, message: err.message });
        }
      };

      socket.on('rejectCall',    handleRejectCall);
      socket.on('call-rejected', handleRejectCall);
      socket.on('cancelCall',    handleRejectCall);

      /** endCall — FIX PROBLEM 2 */
      const handleEndCall = (payload = {}, ack = () => {}) => {
        try {
          const to = normalizeId(payload.to || payload.peerId);
          if (!to) throw new Error('peerId required');

          const endData = { from: userId };
          emitToUser(to, 'call-ended', endData);
          emitToUser(to, 'callEnded',  endData);

          ack({ success: true });
        } catch (err) {
          ack({ success: false, message: err.message });
        }
      };

      socket.on('endCall',    handleEndCall);
      socket.on('call-ended', handleEndCall);
      socket.on('leaveCall',  handleEndCall);

      /** ICE Candidate relay — FIX PROBLEM 2 */
      const handleIce = (payload = {}, ack = () => {}) => {
        try {
          const to = normalizeId(payload.to || payload.targetId);
          if (!to) throw new Error('target required');
          const iceData = { from: userId, candidate: payload.candidate || payload.signal };
          emitToUser(to, 'ice-candidate', iceData);
          emitToUser(to, 'webrtcSignal',  iceData);
          ack({ success: true });
        } catch (err) {
          ack({ success: false, message: err.message });
        }
      };

      socket.on('iceCandidate',  handleIce);
      socket.on('ice-candidate', handleIce);
      socket.on('webrtcSignal',  handleIce);

      // ── DISCONNECT — FIX PROBLEM 3 ──────────────────────────────────────
      socket.on('disconnect', async () => {
        const uid = removeSocket(socket.id);
        if (uid && !userSocketMap.has(uid)) {
          // Last socket for this user — go offline
          setImmediate(() => persistPresence(uid, false));
          io.emit('user_offline', { userId: uid, at: ts().toISOString() });
        }
        broadcastOnline();
      });

    } catch (err) {
      socket.emit('socket-error', { message: err.message });
      socket.disconnect(true);
    }
  });

  return io;
};

// ─── Background helper — FIX PROBLEM 6 ───────────────────────────────────────
/**
 * Update Conversation's lastMessage snapshot and increment receiver unread count.
 * Called with setImmediate so it never blocks the send-message response.
 */
async function updateConversationLastMessage(senderId, receiverId, text, messageId) {
  try {
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
      isGroup: false,
    });

    const lastMessage = {
      text:      text || 'Media shared',
      sender:    senderId,
      createdAt: new Date(),
    };

    if (conversation) {
      conversation.lastMessage = lastMessage;
      if (!conversation.unreadCount) conversation.unreadCount = new Map();
      conversation.unreadCount.set(receiverId, (conversation.unreadCount.get(receiverId) || 0) + 1);
      await conversation.save();
    } else {
      await Conversation.create({
        participants: [senderId, receiverId],
        isGroup:      false,
        lastMessage,
        unreadCount:  new Map([[receiverId, 1]]),
      });
    }
  } catch (err) {
    console.warn('[Socket] updateConversationLastMessage failed:', err.message);
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = initSocket;

module.exports.getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized — call initSocket(server) first');
  return io;
};

/** Get first socketId for a user (for legacy single-socket controllers) */
module.exports.getReceiverSocketId = (userId) => {
  const sockets = userSocketMap.get(normalizeId(userId));
  return sockets?.values?.().next?.().value || null;
};

/** Emit to all sockets of a user — exposed for controllers */
module.exports.emitToUser = emitToUser;
