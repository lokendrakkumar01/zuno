const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Message } = require('../models/Message');
const { createNotification } = require('../utils/notificationService');

const userSockets = new Map();
const socketUsers = new Map();
let io;

const normalizeId = (value) => value?.toString?.() || String(value || '');
const now = () => new Date();

const getOnlineUsers = () => Array.from(userSockets.keys());

const addSocket = (userId, socketId) => {
  const id = normalizeId(userId);
  const sockets = userSockets.get(id) || new Set();
  sockets.add(socketId);
  userSockets.set(id, sockets);
  socketUsers.set(socketId, id);
};

const removeSocket = (socketId) => {
  const userId = socketUsers.get(socketId);
  if (!userId) return null;
  const sockets = userSockets.get(userId) || new Set();
  sockets.delete(socketId);
  if (sockets.size) userSockets.set(userId, sockets);
  else userSockets.delete(userId);
  socketUsers.delete(socketId);
  return userId;
};

const emitOnlineUsers = () => {
  io.emit('online-users', getOnlineUsers());
  io.emit('getOnlineUsers', getOnlineUsers());
};

const emitPresenceChange = (userId, isOnline) => {
  if (!io || !userId) return;
  io.emit(isOnline ? 'user_online' : 'user_offline', {
    userId: normalizeId(userId),
    at: now().toISOString()
  });
};

const emitToUser = (userId, event, payload, ack) => {
  const sockets = userSockets.get(normalizeId(userId));
  if (!sockets || sockets.size === 0) return false;
  sockets.forEach((socketId) => io.to(socketId).emit(event, payload, ack));
  return true;
};

const markPresence = async (userId, isOnline) => {
  try {
    await User.findByIdAndUpdate(userId, isOnline
      ? { isOnline: true, offlineStatus: null }
      : { isOnline: false, offlineStatus: now() });
  } catch (error) {
    console.error('[Socket] Presence update failed:', error.message);
  }
};

const initSocket = (server) => {
  const socketAllowedOrigins = new Set([
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3002',
    'https://zunoworld.tech',
    'https://www.zunoworld.tech',
    'https://zuno-admin.onrender.com',
    ...(process.env.CLIENT_URL || '').split(',').map((origin) => origin.trim()).filter(Boolean),
    ...(process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean)
  ]);

  io = new Server(server, {
    cors: {
      origin(origin, callback) {
        // Allow all origins – same policy as app.js CORS middleware
        if (!origin || socketAllowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error(`Socket origin not allowed: ${origin}`));
      },
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e7
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = normalizeId(decoded.id);
      return next();
    } catch (error) {
      return next(new Error('Invalid socket token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = normalizeId(socket.userId);

    try {
      socket.join(userId);
      addSocket(userId, socket.id);
      await markPresence(userId, true);
      emitOnlineUsers();
      emitPresenceChange(userId, true);

      socket.on('join-room', async ({ roomId } = {}, ack = () => {}) => {
        try {
          if (!roomId) throw new Error('roomId required');
          socket.join(normalizeId(roomId));
          emitOnlineUsers();
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('leave-room', async ({ roomId } = {}, ack = () => {}) => {
        try {
          if (!roomId) throw new Error('roomId required');
          socket.leave(normalizeId(roomId));
          emitOnlineUsers();
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      const handleSendMessage = async (payload = {}, ack = () => {}) => {
        try {
          const receiverId = normalizeId(payload.receiverId || payload.receiver || payload.to);
          if (!receiverId) throw new Error('receiverId required');

          const message = await Message.create({
            roomId: payload.roomId || undefined,
            conversationId: payload.conversationId || undefined,
            sender: userId,
            receiver: receiverId,
            text: String(payload.text || payload.content || '').trim().slice(0, 2000),
            type: payload.type || payload.media?.type || 'text',
            media: payload.media || { url: '', type: '' },
            replyTo: payload.replyTo || undefined,
            clientMsgId: payload.clientMsgId || undefined,
            status: 'sent'
          });

          // Instead of a second DB query (findById + populate), we construct the response immediately
          // using the user data we already have or just the ID for maximum speed.
          const populated = {
            ...message.toObject(),
            sender: {
              _id: userId,
              username: payload.senderName || 'User', // Fallback if name not provided
              avatar: payload.senderAvatar || ''
            }
          };

          const delivered = emitToUser(receiverId, 'message-received', populated, async () => {
            try {
              await Message.findByIdAndUpdate(message._id, { status: 'delivered', deliveredAt: now() });
              socket.emit('message-status', { messageId: normalizeId(message._id), status: 'delivered' });
            } catch (error) {
              socket.emit('socket-error', { message: error.message });
            }
          });
          emitToUser(receiverId, 'new_message', populated);
          emitToUser(receiverId, 'newMessage', populated);

          const status = delivered ? 'delivered' : 'sent';
          await Message.findByIdAndUpdate(message._id, delivered ? { status, deliveredAt: now() } : { status });
          const response = { ...populated, status };
          socket.emit('message-received', response);
          socket.emit('new_message', response);
          socket.emit('newMessage', response);

          createNotification({
            recipientId: receiverId,
            actor: userId,
            type: 'message',
            title: 'New message',
            body: response.text || 'Sent you a message',
            entityType: 'message',
            entityId: normalizeId(message._id),
            metadata: {
              senderId: userId,
              conversationId: normalizeId(message.conversationId || message.roomId || '')
            }
          }).catch((error) => console.warn('[Socket] Message notification failed:', error.message));

          return ack({ success: true, message: response });
        } catch (error) {
          return ack({ success: false, message: error.message });
        }
      };

      socket.on('send-message', handleSendMessage);
      socket.on('send_message', handleSendMessage);

      const handleMessageRead = async ({ messageId, senderId } = {}, ack = () => {}) => {
        try {
          if (!messageId) throw new Error('messageId required');
          await Message.findByIdAndUpdate(messageId, { read: true, status: 'read', readAt: now() });
          if (senderId) emitToUser(senderId, 'message-status', { messageId, status: 'read', readerId: userId });
          if (senderId) emitToUser(senderId, 'message_read', { messageId, status: 'read', readerId: userId });
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      };

      socket.on('message-read', handleMessageRead);
      socket.on('message_read', handleMessageRead);
      socket.on('messageRead', ({ messageId, senderId, receiverId } = {}, ack = () => {}) =>
        handleMessageRead({ messageId, senderId: senderId || receiverId }, ack));

      socket.on('message_delivered', async ({ messageId, senderId } = {}, ack = () => {}) => {
        try {
          if (!messageId) throw new Error('messageId required');
          await Message.findByIdAndUpdate(messageId, { status: 'delivered', deliveredAt: now() });
          if (senderId) emitToUser(senderId, 'message-status', { messageId, status: 'delivered', readerId: userId });
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('typing', ({ receiverId } = {}) => {
        try {
          if (receiverId) emitToUser(receiverId, 'typing', { senderId: userId });
          if (receiverId) emitToUser(receiverId, 'typing_start', { senderId: userId });
        } catch (error) {
          socket.emit('socket-error', { message: error.message });
        }
      });

      socket.on('typing_start', ({ receiverId, to } = {}) => {
        const targetId = receiverId || to;
        if (targetId) {
          emitToUser(targetId, 'typing', { senderId: userId });
          emitToUser(targetId, 'typing_start', { senderId: userId });
        }
      });

      socket.on('stop-typing', ({ receiverId } = {}) => {
        try {
          if (receiverId) emitToUser(receiverId, 'stop-typing', { senderId: userId });
          if (receiverId) emitToUser(receiverId, 'typing_stop', { senderId: userId });
        } catch (error) {
          socket.emit('socket-error', { message: error.message });
        }
      });

      socket.on('typing_stop', ({ receiverId, to } = {}) => {
        const targetId = receiverId || to;
        if (targetId) {
          emitToUser(targetId, 'stop-typing', { senderId: userId });
          emitToUser(targetId, 'typing_stop', { senderId: userId });
        }
      });

      socket.on('react_message', async ({ messageId, emoji } = {}, ack = () => {}) => {
        try {
          if (!messageId || !emoji) throw new Error('messageId and emoji required');
          const message = await Message.findById(messageId);
          if (!message) throw new Error('Message not found');
          message.reactions = message.reactions.filter((reaction) => normalizeId(reaction.user) !== userId);
          message.reactions.push({ user: userId, emoji });
          await message.save();
          const payload = { messageId, userId, emoji, reactions: message.reactions };
          emitToUser(message.sender, 'message_reaction', payload);
          if (message.receiver) emitToUser(message.receiver, 'message_reaction', payload);
          ack({ success: true, reaction: payload });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('delete_message', async ({ messageId, mode = 'me' } = {}, ack = () => {}) => {
        try {
          if (!messageId) throw new Error('messageId required');
          const update = mode === 'everyone'
            ? { deletedForEveryone: true, text: '', media: { url: '', type: '' } }
            : { $addToSet: { deletedBy: userId } };
          const message = await Message.findByIdAndUpdate(messageId, update, { new: true });
          if (!message) throw new Error('Message not found');
          const payload = { messageId, mode, deletedBy: userId };
          emitToUser(message.sender, 'message_deleted', payload);
          if (message.receiver) emitToUser(message.receiver, 'message_deleted', payload);
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      const callTimeouts = new Map(); // Track pending call timeouts keyed by callerId

      socket.on('call-user', (payload = {}, ack = () => {}) => {
        try {
          const delivered = emitToUser(payload.to, 'incoming-call', {
            from: userId,
            offer: payload.offer,
            callType: payload.callType || 'video',
            caller: payload.caller || null
          });
          ack({ success: delivered });
          // Auto-timeout if no answer after 30s
          const timeoutKey = `${userId}-${payload.to}`;
          if (callTimeouts.has(timeoutKey)) clearTimeout(callTimeouts.get(timeoutKey));
          const tid = setTimeout(() => {
            callTimeouts.delete(timeoutKey);
            if (!callTimeouts.has(timeoutKey)) {
              socket.emit('call-timeout', { to: payload.to });
              emitToUser(payload.to, 'call-rejected', { from: userId, reason: 'timeout' });
            }
          }, 30000);
          callTimeouts.set(timeoutKey, tid);
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('call_request', (payload = {}, ack = () => {}) => {
        try {
          const calleeId = payload.calleeId || payload.to;
          const body = {
            callerId: userId,
            from: userId,
            offer: payload.offer,
            callType: payload.callType || 'video',
            caller: payload.caller || null
          };
          const delivered = emitToUser(calleeId, 'call_request', body);
          emitToUser(calleeId, 'incoming-call', body);
          createNotification({
            recipientId: calleeId,
            actor: userId,
            type: 'call_incoming',
            title: 'Incoming call',
            body: 'You have an incoming call',
            entityType: 'user',
            entityId: userId,
            metadata: { callType: payload.callType || 'video' }
          }).catch(() => {});
          ack({ success: delivered });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('call-accepted', (payload = {}, ack = () => {}) => {
        try {
          // Clear any pending timeout for this call pair
          const timeoutKey = `${payload.to}-${userId}`;
          if (callTimeouts.has(timeoutKey)) {
            clearTimeout(callTimeouts.get(timeoutKey));
            callTimeouts.delete(timeoutKey);
          }
          emitToUser(payload.to, 'call-accepted', { from: userId, answer: payload.answer });
          emitToUser(payload.to, 'callAccepted', { from: userId, signal: payload.answer });
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('call_accept', (payload = {}, ack = () => {}) => {
        try {
          const callerId = payload.callerId || payload.to;
          emitToUser(callerId, 'call_accept', { calleeId: userId, from: userId, answer: payload.answer });
          emitToUser(callerId, 'call-accepted', { from: userId, answer: payload.answer });
          emitToUser(callerId, 'callAccepted', { from: userId, signal: payload.answer });
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('call-rejected', (payload = {}, ack = () => {}) => {
        try {
          emitToUser(payload.to, 'call-rejected', { from: userId, reason: payload.reason || 'rejected' });
          emitToUser(payload.to, 'callCancelled', { from: userId, reason: payload.reason || 'rejected' });
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('call_reject', (payload = {}, ack = () => {}) => {
        try {
          const callerId = payload.callerId || payload.to;
          emitToUser(callerId, 'call_reject', { from: userId, reason: payload.reason || 'rejected' });
          emitToUser(callerId, 'call-rejected', { from: userId, reason: payload.reason || 'rejected' });
          emitToUser(callerId, 'callCancelled', { from: userId, reason: payload.reason || 'rejected' });
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('ice-candidate', (payload = {}, ack = () => {}) => {
        try {
          emitToUser(payload.to, 'ice-candidate', { from: userId, candidate: payload.candidate });
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('ice_candidate', (payload = {}, ack = () => {}) => {
        try {
          const targetId = payload.to || payload.targetId;
          emitToUser(targetId, 'ice_candidate', { from: userId, candidate: payload.candidate });
          emitToUser(targetId, 'ice-candidate', { from: userId, candidate: payload.candidate });
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('call-ended', (payload = {}, ack = () => {}) => {
        try {
          emitToUser(payload.to, 'call-ended', { from: userId });
          emitToUser(payload.to, 'callEnded', { from: userId });
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('callUser', (payload = {}, ack = () => {}) => {
        try {
          const targetId = payload.userToCall || payload.to;
          const delivered = emitToUser(targetId, 'callUser', {
            from: payload.from || userId,
            signal: payload.signalData || payload.signal,
            callType: payload.callType || 'video'
          });
          emitToUser(targetId, 'incoming-call', {
            from: userId,
            offer: payload.signalData || payload.signal,
            callType: payload.callType || 'video',
            caller: payload.from || null
          });
          ack({ success: delivered });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('answerCall', (payload = {}, ack = () => {}) => {
        try {
          emitToUser(payload.to, 'callAccepted', { from: userId, signal: payload.signal });
          emitToUser(payload.to, 'call-accepted', { from: userId, answer: payload.signal });
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('webrtcSignal', (payload = {}, ack = () => {}) => {
        try {
          emitToUser(payload.to, 'webrtcSignal', { from: userId, signal: payload.signal });
          emitToUser(payload.to, 'ice-candidate', { from: userId, candidate: payload.signal });
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('cancelCall', (payload = {}, ack = () => {}) => {
        try {
          emitToUser(payload.to, 'callCancelled', { from: userId });
          emitToUser(payload.to, 'call-rejected', { from: userId, reason: 'cancelled' });
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('leaveCall', (payload = {}, ack = () => {}) => {
        try {
          emitToUser(payload.to, 'callEnded', { from: userId });
          emitToUser(payload.to, 'call-ended', { from: userId });
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('disconnect', async () => {
        try {
          const removedUserId = removeSocket(socket.id);
          if (removedUserId && !userSockets.has(removedUserId)) {
            await markPresence(removedUserId, false);
            emitPresenceChange(removedUserId, false);
          }
          emitOnlineUsers();
        } catch (error) {
          console.error('[Socket] Disconnect cleanup failed:', error.message);
        }
      });
    } catch (error) {
      socket.emit('socket-error', { message: error.message });
      socket.disconnect(true);
    }
  });

  return io;
};

module.exports = initSocket;
module.exports.getIO = () => io;
module.exports.getReceiverSocketId = (userId) => {
  const sockets = userSockets.get(normalizeId(userId));
  return sockets?.values?.().next?.().value || null;
};
module.exports.emitToUser = emitToUser;
