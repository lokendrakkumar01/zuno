const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Message } = require('../models/Message');

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
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket'],
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

      socket.on('send-message', async (payload = {}, ack = () => {}) => {
        try {
          const receiverId = normalizeId(payload.receiverId);
          if (!receiverId) throw new Error('receiverId required');

          const message = await Message.create({
            roomId: payload.roomId || undefined,
            sender: userId,
            receiver: receiverId,
            text: String(payload.text || '').trim().slice(0, 2000),
            media: payload.media || { url: '', type: '' },
            clientMsgId: payload.clientMsgId || undefined,
            status: 'sent'
          });

          const populated = await Message.findById(message._id)
            .populate('sender', 'username displayName avatar')
            .populate('receiver', 'username displayName avatar')
            .lean();

          const delivered = emitToUser(receiverId, 'message-received', populated, async () => {
            try {
              await Message.findByIdAndUpdate(message._id, { status: 'delivered', deliveredAt: now() });
              socket.emit('message-status', { messageId: normalizeId(message._id), status: 'delivered' });
            } catch (error) {
              socket.emit('socket-error', { message: error.message });
            }
          });

          const status = delivered ? 'delivered' : 'sent';
          await Message.findByIdAndUpdate(message._id, delivered ? { status, deliveredAt: now() } : { status });
          const response = { ...populated, status };
          socket.emit('message-received', response);
          return ack({ success: true, message: response });
        } catch (error) {
          return ack({ success: false, message: error.message });
        }
      });

      socket.on('message-read', async ({ messageId, senderId } = {}, ack = () => {}) => {
        try {
          if (!messageId) throw new Error('messageId required');
          await Message.findByIdAndUpdate(messageId, { read: true, status: 'read', readAt: now() });
          if (senderId) emitToUser(senderId, 'message-status', { messageId, status: 'read', readerId: userId });
          ack({ success: true });
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('typing', ({ receiverId } = {}) => {
        try {
          if (receiverId) emitToUser(receiverId, 'typing', { senderId: userId });
        } catch (error) {
          socket.emit('socket-error', { message: error.message });
        }
      });

      socket.on('stop-typing', ({ receiverId } = {}) => {
        try {
          if (receiverId) emitToUser(receiverId, 'stop-typing', { senderId: userId });
        } catch (error) {
          socket.emit('socket-error', { message: error.message });
        }
      });

      socket.on('call-user', (payload = {}, ack = () => {}) => {
        try {
          const delivered = emitToUser(payload.to, 'incoming-call', {
            from: userId,
            offer: payload.offer,
            callType: payload.callType || 'video',
            caller: payload.caller || null
          });
          ack({ success: delivered });
          setTimeout(() => {
            socket.emit('call-timeout', { to: payload.to });
            emitToUser(payload.to, 'call-rejected', { from: userId, reason: 'timeout' });
          }, 30000);
        } catch (error) {
          ack({ success: false, message: error.message });
        }
      });

      socket.on('call-accepted', (payload = {}, ack = () => {}) => {
        try {
          emitToUser(payload.to, 'call-accepted', { from: userId, answer: payload.answer });
          emitToUser(payload.to, 'callAccepted', { from: userId, signal: payload.answer });
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

      socket.on('ice-candidate', (payload = {}, ack = () => {}) => {
        try {
          emitToUser(payload.to, 'ice-candidate', { from: userId, candidate: payload.candidate });
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
          if (removedUserId && !userSockets.has(removedUserId)) await markPresence(removedUserId, false);
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
