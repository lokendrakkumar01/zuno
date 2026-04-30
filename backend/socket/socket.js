const { Server } = require('socket.io');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isOriginAllowed } = require('../config/appConfig');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Socket CORS: origin ${origin} not allowed`), false);
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  allowEIO3: true,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  perMessageDeflate: false,
  // Optimize for speed
  maxHttpBufferSize: 1e8,
  upgradeTimeout: 10000,
  rememberUpgrade: true,
  // Fast connection settings
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

const onlineUserSockets = new Map();
const socketHeartbeats = new Map();
const activeDirectCalls = new Map();
const pendingDirectCallDisconnects = new Map();
const activeStreams = new Map();
const pendingStreamDisconnects = new Map();
const streamCommentCooldowns = new Map();

const DIRECT_CALL_DISCONNECT_GRACE_MS = 12000;
const STREAM_HOST_DISCONNECT_GRACE_MS = 15000;
const STREAM_SLOW_MODE_COOLDOWN_MS = 5000;
const STREAM_SESSION_TTL_MS = 3 * 60 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 20000;
const HEARTBEAT_TIMEOUT_MS = 70000;

const normalizeId = (value) => value?.toString?.() || null;
const nowIso = () => new Date().toISOString();

const markUserPresence = (userId, isOnline) => {
  if (!userId) return;

  User.findByIdAndUpdate(
    userId,
    isOnline
      ? { isOnline: true, offlineStatus: null }
      : { isOnline: false, offlineStatus: new Date() }
  ).catch((error) => {
    console.error(`[Socket] Failed to update presence for ${userId}:`, error);
  });
};

const emitOnlineUsers = () => {
  io.emit('getOnlineUsers', Array.from(onlineUserSockets.keys()));
};

const addUserSocket = (userId, socketId) => {
  if (!userId || !socketId) return;

  const sockets = onlineUserSockets.get(userId) || new Set();
  sockets.add(socketId);
  onlineUserSockets.set(userId, sockets);
};

const getReceiverSocketId = (userId) => {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) return null;

  const sockets = onlineUserSockets.get(normalizedUserId);
  if (!sockets || sockets.size === 0) return null;

  const firstSocketId = sockets.values().next().value;
  return firstSocketId || null;
};

const removeUserSocket = (userId, socketId) => {
  if (!userId || !socketId) return 0;

  const sockets = onlineUserSockets.get(userId);
  if (!sockets) return 0;

  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUserSockets.delete(userId);
    return 0;
  }

  onlineUserSockets.set(userId, sockets);
  return sockets.size;
};

// Direct socket targeting for realtime events.
// Use regular emits so signaling and critical updates are not dropped.
const deliverMessageFast = (receiverId, eventName, data) => {
  const normalizedReceiverId = normalizeId(receiverId);
  if (!normalizedReceiverId) return false;
  
  const receiverSockets = onlineUserSockets.get(normalizedReceiverId);
  if (!receiverSockets || receiverSockets.size === 0) return false;
  
  // Send to all active sockets for this user with volatile flag for speed
  let delivered = false;
  receiverSockets.forEach(socketId => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.connected) {
      socket.emit(eventName, data);
      delivered = true;
    }
  });
  
  return delivered;
};

// Enhanced message delivery with acknowledgment
const deliverMessageWithAck = async (receiverId, eventName, data, timeout = 5000) => {
  const normalizedReceiverId = normalizeId(receiverId);
  if (!normalizedReceiverId) return false;
  
  const receiverSockets = onlineUserSockets.get(normalizedReceiverId);
  if (!receiverSockets || receiverSockets.size === 0) return false;
  
  // Send to first available socket and wait for ack
  for (const socketId of receiverSockets) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.connected) {
      try {
        await socket.timeout(timeout).emitWithAck(eventName, data);
        return true;
      } catch (error) {
        console.log('Message delivery timeout, trying next socket');
        continue;
      }
    }
  }
  
  return false;
};

const clearPendingDirectCallDisconnect = (userId) => {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) return;

  const timer = pendingDirectCallDisconnects.get(normalizedUserId);
  if (timer) {
    clearTimeout(timer);
    pendingDirectCallDisconnects.delete(normalizedUserId);
  }
};

const linkDirectCall = (userId, peerId) => {
  const normalizedUserId = normalizeId(userId);
  const normalizedPeerId = normalizeId(peerId);
  if (!normalizedUserId || !normalizedPeerId) return;

  clearPendingDirectCallDisconnect(normalizedUserId);
  clearPendingDirectCallDisconnect(normalizedPeerId);
  activeDirectCalls.set(normalizedUserId, normalizedPeerId);
  activeDirectCalls.set(normalizedPeerId, normalizedUserId);
};

const clearDirectCall = (userId, peerId) => {
  const normalizedUserId = normalizeId(userId);
  const normalizedPeerId = normalizeId(peerId);
  if (!normalizedUserId) return;

  const currentPeerId = activeDirectCalls.get(normalizedUserId);
  if (normalizedPeerId && currentPeerId !== normalizedPeerId) return;

  activeDirectCalls.delete(normalizedUserId);
  if (normalizedPeerId) {
    activeDirectCalls.delete(normalizedPeerId);
  }
};

const scheduleDirectCallDisconnect = (userId) => {
  const normalizedUserId = normalizeId(userId);
  const peerId = activeDirectCalls.get(normalizedUserId);
  if (!normalizedUserId || !peerId) return;

  clearPendingDirectCallDisconnect(normalizedUserId);

  const timeoutId = setTimeout(() => {
    pendingDirectCallDisconnects.delete(normalizedUserId);

    if (onlineUserSockets.has(normalizedUserId)) {
      return;
    }

    clearDirectCall(normalizedUserId, peerId);
    io.to(peerId).emit('callEnded');
  }, DIRECT_CALL_DISCONNECT_GRACE_MS);

  pendingDirectCallDisconnects.set(normalizedUserId, timeoutId);
};

const touchStream = (stream) => {
  if (stream) {
    stream.updatedAt = nowIso();
  }
};

const serializeStream = (stream) => ({
  id: stream.id,
  roomId: stream.roomId || stream.id,
  hostId: stream.hostId,
  hostUsername: stream.hostUsername,
  hostAvatar: stream.hostAvatar,
  hostDisplayName: stream.hostDisplayName,
  title: stream.title,
  description: stream.description || '',
  startedAt: stream.startedAt,
  updatedAt: stream.updatedAt || stream.startedAt,
  viewerCount: stream.viewers?.size || 0,
  slowMode: Boolean(stream.slowMode),
  pinnedComment: stream.pinnedComment || null,
  cloudinaryProvisioned: Boolean(stream.cloudinaryProvisioned),
  streamProvider: stream.streamProvider || 'cloudinary'
});

const isStreamJoinable = (stream) => {
  if (!stream) return false;
  if (stream.hostSocketId) return true;
  if (!stream.cloudinaryProvisioned) return false;

  const referenceTime = stream.cloudinaryProvisionedAt || stream.updatedAt || stream.startedAt;
  return referenceTime
    ? Date.now() - new Date(referenceTime).getTime() < STREAM_SESSION_TTL_MS
    : false;
};

const pruneExpiredStreams = () => {
  const removedHostIds = [];

  for (const [hostUserId, stream] of activeStreams.entries()) {
    if (isStreamJoinable(stream)) continue;
    if (stream.hostSocketId || stream.viewers?.size) continue;

    activeStreams.delete(hostUserId);
    removedHostIds.push(hostUserId);
  }

  return removedHostIds;
};

const clearPendingStreamDisconnect = (hostUserId) => {
  const normalizedHostId = normalizeId(hostUserId);
  if (!normalizedHostId) return;

  const timer = pendingStreamDisconnects.get(normalizedHostId);
  if (timer) {
    clearTimeout(timer);
    pendingStreamDisconnects.delete(normalizedHostId);
  }
};

const scheduleStreamDisconnect = (hostUserId, expectedSocketId) => {
  const normalizedHostId = normalizeId(hostUserId);
  if (!normalizedHostId) return;

  clearPendingStreamDisconnect(normalizedHostId);

  const timeoutId = setTimeout(() => {
    pendingStreamDisconnects.delete(normalizedHostId);

    const stream = activeStreams.get(normalizedHostId);
    if (!stream) return;
    if (stream.hostSocketId && stream.hostSocketId !== expectedSocketId) return;

    io.to(stream.roomId).emit('streamEnded', { hostId: normalizedHostId });
    activeStreams.delete(normalizedHostId);
  }, STREAM_HOST_DISCONNECT_GRACE_MS);

  pendingStreamDisconnects.set(normalizedHostId, timeoutId);
};

const removeStreamViewerSocket = (stream, viewerUserId, socketId) => {
  const normalizedViewerId = normalizeId(viewerUserId);
  if (!stream || !normalizedViewerId) {
    return { removedViewer: false, viewerCount: stream?.viewers?.size || 0 };
  }

  const viewerSockets = stream.viewerSockets || new Map();
  const socketIds = viewerSockets.get(normalizedViewerId) || new Set();
  if (socketId) socketIds.delete(socketId);

  if (socketIds.size === 0) {
    viewerSockets.delete(normalizedViewerId);
    const removedViewer = stream.viewers.delete(normalizedViewerId);
    touchStream(stream);
    return { removedViewer, viewerCount: stream.viewers.size };
  }

  viewerSockets.set(normalizedViewerId, socketIds);
  stream.viewerSockets = viewerSockets;
  return { removedViewer: false, viewerCount: stream.viewers.size };
};

const addStreamViewerSocket = (stream, viewerUserId, socketId) => {
  const normalizedViewerId = normalizeId(viewerUserId);
  if (!stream || !normalizedViewerId || !socketId) return 0;

  const viewerSockets = stream.viewerSockets || new Map();
  const socketIds = viewerSockets.get(normalizedViewerId) || new Set();
  socketIds.add(socketId);
  viewerSockets.set(normalizedViewerId, socketIds);

  stream.viewerSockets = viewerSockets;
  stream.viewers = stream.viewers || new Set();
  stream.viewers.add(normalizedViewerId);
  touchStream(stream);
  return stream.viewers.size;
};

const emitHeartbeatAck = (socket) => {
  socketHeartbeats.set(socket.id, Date.now());
  socket.emit('presence:heartbeat:ack', { ts: Date.now() });
};

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

setInterval(() => {
  pruneExpiredStreams();

  const threshold = Date.now() - HEARTBEAT_TIMEOUT_MS;
  for (const [socketId, lastSeenAt] of socketHeartbeats.entries()) {
    if (lastSeenAt >= threshold) continue;

    const staleSocket = io.sockets.sockets.get(socketId);
    socketHeartbeats.delete(socketId);
    staleSocket?.disconnect(true);
  }
}, HEARTBEAT_INTERVAL_MS).unref();

io.on('connection', (socket) => {
  const userId = normalizeId(socket.userId);

  socket.join(userId);
  addUserSocket(userId, socket.id);
  clearPendingDirectCallDisconnect(userId);
  markUserPresence(userId, true);
  emitHeartbeatAck(socket);
  emitOnlineUsers();

  const hostedStream = activeStreams.get(userId);
  if (hostedStream) {
    clearPendingStreamDisconnect(userId);
    hostedStream.hostSocketId = socket.id;
    hostedStream.cloudinaryProvisioned = true;
    hostedStream.cloudinaryProvisionedAt = hostedStream.cloudinaryProvisionedAt || nowIso();
    socket.join(hostedStream.roomId);
    touchStream(hostedStream);
  }

  socket.on('presence:heartbeat', () => emitHeartbeatAck(socket));
  // Enhanced messaging with fast delivery
  socket.on('sendMessage', async (data = {}) => {
    const { receiverId, text, media, type = 'direct' } = data;
    if (!receiverId) return;
    
    const messagePayload = {
      sender: {
        _id: userId,
        username: data.senderUsername || '',
        displayName: data.senderDisplayName || '',
        avatar: data.senderAvatar || ''
      },
      receiver: { _id: receiverId },
      text,
      media,
      type,
      createdAt: nowIso(),
      messageId: `msg_${Date.now()}_${userId}`
    };
    
    // Fast delivery to receiver
    const delivered = deliverMessageFast(receiverId, 'newMessage', messagePayload);
    
    // Send confirmation to sender
    socket.emit('messageSent', {
      ...messagePayload,
      delivered,
      timestamp: nowIso()
    });
    
    console.log(`Message ${delivered ? 'delivered' : 'failed to deliver'} from ${userId} to ${receiverId}`);
  });
  
  socket.on('typing', (data = {}) => {
    if (data.receiverId) {
      deliverMessageFast(data.receiverId, 'typing', { senderId: userId });
    }
  });
  
  socket.on('stopTyping', (data = {}) => {
    if (data.receiverId) {
      deliverMessageFast(data.receiverId, 'stopTyping', { senderId: userId });
    }
  });
  
  socket.on('messageRead', (data = {}) => {
    if (data.receiverId) {
      deliverMessageFast(data.receiverId, 'messageRead', { messageId: data.messageId, readerId: userId });
    }
  });
  socket.on('joinConversation', (data = {}) => data.conversationId && socket.join(`conversation:${data.conversationId}`));
  socket.on('leaveConversation', (data = {}) => data.conversationId && socket.leave(`conversation:${data.conversationId}`));

  // Enhanced calling system with fast notifications
  socket.on('callUser', (data = {}) => {
    if (!data.userToCall) return;

    linkDirectCall(userId, data.userToCall);
    const callerProfile = data.from || {};
    const callPayload = {
      signal: data.signalData || data.signal,
      from: {
        _id: userId,
        username: callerProfile.username || data.username || '',
        displayName: callerProfile.displayName || callerProfile.name || data.displayName || data.name || '',
        avatar: callerProfile.avatar || data.avatar || ''
      },
      callType: data.callType || 'voice',
      timestamp: nowIso(),
      callId: `call_${Date.now()}_${userId}`
    };

    // Fast delivery with priority
    const delivered = deliverMessageFast(data.userToCall, 'callUser', callPayload);
    
    // Send call status to caller
    socket.emit('callInitiated', {
      targetId: data.userToCall,
      delivered,
      callId: callPayload.callId,
      timestamp: nowIso()
    });
    
    console.log(`Call ${delivered ? 'delivered' : 'failed to deliver'} from ${userId} to ${data.userToCall}`);
  });

  socket.on('answerCall', (data = {}) => {
    if (!data.to) return;
    linkDirectCall(userId, data.to);
    
    const answerPayload = {
      signal: data.signal,
      from: userId,
      timestamp: nowIso()
    };
    
    const delivered = deliverMessageFast(data.to, 'callAccepted', answerPayload);
    console.log(`Call answer ${delivered ? 'delivered' : 'failed to deliver'} from ${userId} to ${data.to}`);
  });

  socket.on('webrtcSignal', (data = {}) => {
    if (data.to) {
      const delivered = deliverMessageFast(data.to, 'webrtcSignal', { signal: data.signal, from: userId });
      console.log(`WebRTC signal ${delivered ? 'delivered' : 'failed to deliver'} from ${userId} to ${data.to}`);
    }
  });
  
  socket.on('cancelCall', (data = {}) => {
    clearDirectCall(userId, data.to);
    if (data.to) {
      const delivered = deliverMessageFast(data.to, 'callCancelled', { 
        from: userId, 
        timestamp: nowIso() 
      });
      console.log(`Call cancellation ${delivered ? 'delivered' : 'failed to deliver'} from ${userId} to ${data.to}`);
    }
  });
  
  socket.on('leaveCall', (data = {}) => {
    clearDirectCall(userId, data.to);
    if (data.to) {
      const delivered = deliverMessageFast(data.to, 'callEnded', { 
        from: userId, 
        timestamp: nowIso() 
      });
      console.log(`Call end ${delivered ? 'delivered' : 'failed to deliver'} from ${userId} to ${data.to}`);
    }
  });

  socket.on('groupCallUser', (data = {}) => {
    if (!data.targetUserId) return;
    
    // Send enriched payload with group info for proper UI initialization
    io.to(data.targetUserId).emit('groupCallIncoming', {
      signal: data.signalData,
      from: userId,
      groupId: data.groupId,
      groupName: data.groupName || 'Group Call',
      participants: data.participants || [],
      callType: data.callType || 'video'
    });
  });

  socket.on('groupCallAnswer', (data = {}) => {
    if (!data.to) return;
    io.to(data.to).emit('groupCallAccepted', {
      signal: data.signal,
      from: userId,
      groupId: data.groupId
    });
  });

  socket.on('groupCallRejected', (data = {}) => {
    if (!data.to) return;
    io.to(data.to).emit('groupCallRejected', {
      from: userId,
      groupId: data.groupId
    });
  });

  socket.on('groupCallLeft', (data = {}) => {
    (data.participants || []).forEach((participantId) => {
      io.to(participantId).emit('groupCallParticipantLeft', {
        userId,
        groupId: data.groupId
      });
    });
  });

  socket.on('startStream', (data = {}) => {
    const roomId = data.roomId || `stream_${userId}`;
    const existingStream = activeStreams.get(userId) || {};
    const stream = {
      ...existingStream,
      id: roomId,
      roomId,
      hostId: userId,
      hostSocketId: socket.id,
      hostUsername: data.hostUsername || existingStream.hostUsername || '',
      hostAvatar: data.hostAvatar || existingStream.hostAvatar || '',
      hostDisplayName: data.hostDisplayName || existingStream.hostDisplayName || '',
      title: data.title || existingStream.title || 'Live stream',
      description: data.description || existingStream.description || '',
      startedAt: existingStream.startedAt || nowIso(),
      updatedAt: nowIso(),
      viewers: existingStream.viewers || new Set(),
      viewerSockets: existingStream.viewerSockets || new Map(),
      slowMode: Boolean(data.slowMode || existingStream.slowMode),
      pinnedComment: existingStream.pinnedComment || null,
      bannedViewers: existingStream.bannedViewers || new Set(),
      cloudinaryProvisioned: true,
      cloudinaryProvisionedAt: existingStream.cloudinaryProvisionedAt || nowIso(),
      streamProvider: 'cloudinary'
    };

    activeStreams.set(userId, stream);
    clearPendingStreamDisconnect(userId);
    socket.join(roomId);
    io.emit('streamStarted', { hostId: userId, title: stream.title, roomId, streamProvider: 'cloudinary' });
  });

  socket.on('joinStreamView', (data = {}) => {
    const hostId = normalizeId(data.hostId);
    const stream = activeStreams.get(hostId);
    if (!stream || !isStreamJoinable(stream)) return;
    if (stream.bannedViewers?.has(userId)) return;

    socket.join(stream.roomId);
    const viewerCount = addStreamViewerSocket(stream, userId, socket.id);

    if (stream.hostSocketId) {
      io.to(stream.hostSocketId).emit('viewerJoined', { viewerId: userId, viewerCount });
    }

    socket.emit('streamJoined', {
      hostId,
      roomId: stream.roomId,
      viewerCount,
      hostSocketId: stream.hostSocketId,
      slowMode: stream.slowMode,
      pinnedComment: stream.pinnedComment
    });
  });

  socket.on('leaveStreamView', (data = {}) => {
    const hostId = normalizeId(data.hostId);
    const stream = activeStreams.get(hostId);
    if (!stream) return;

    socket.leave(stream.roomId);
    const { removedViewer, viewerCount } = removeStreamViewerSocket(stream, userId, socket.id);
    if (removedViewer && stream.hostSocketId) {
      io.to(stream.hostSocketId).emit('viewerLeft', { viewerId: userId, viewerCount });
    }
  });

  socket.on('streamSignal', (data = {}) => data.to && io.to(data.to).emit('streamSignal', { signal: data.signal, from: socket.id }));
  socket.on('streamReaction', (data = {}) => {
    const stream = activeStreams.get(normalizeId(data.hostId));
    if (!stream) return;

    touchStream(stream);
    io.to(stream.roomId).emit('streamReaction', { emoji: data.emoji, userId });
  });

  socket.on('streamComment', (data = {}) => {
    const hostId = normalizeId(data.hostId);
    const stream = activeStreams.get(hostId);
    if (!stream || stream.bannedViewers?.has(userId)) return;

    const commentText = String(data.comment || '');
    const cooldownKey = `${hostId}:${userId}`;
    const isReaction = commentText.startsWith('REACTION:');

    if (stream.slowMode && !isReaction && hostId !== userId) {
      const lastCommentAt = streamCommentCooldowns.get(cooldownKey) || 0;
      if (Date.now() - lastCommentAt < STREAM_SLOW_MODE_COOLDOWN_MS) return;
      streamCommentCooldowns.set(cooldownKey, Date.now());
    }

    touchStream(stream);
    io.to(stream.roomId).emit('newStreamComment', {
      comment: commentText,
      username: data.username,
      avatar: data.avatar,
      userId,
      timestamp: nowIso()
    });
  });

  socket.on('pinStreamComment', (data = {}) => {
    const stream = activeStreams.get(userId);
    if (!stream) return;

    stream.pinnedComment = data.comment || null;
    touchStream(stream);
    io.to(stream.roomId).emit('streamCommentPinned', { comment: stream.pinnedComment });
  });

  socket.on('kickStreamViewer', (data = {}) => {
    const stream = activeStreams.get(userId);
    const viewerId = normalizeId(data.viewerId);
    if (!stream || !viewerId) return;

    stream.bannedViewers = stream.bannedViewers || new Set();
    stream.bannedViewers.add(viewerId);

    const viewerSocketIds = Array.from(stream.viewerSockets?.get(viewerId) || []);
    const { viewerCount } = removeStreamViewerSocket(stream, viewerId);

    viewerSocketIds.forEach((viewerSocketId) => {
      const viewerSocket = io.sockets.sockets.get(viewerSocketId);
      viewerSocket?.leave(stream.roomId);
      io.to(viewerSocketId).emit('streamKicked', { reason: data.reason || 'Removed by host' });
    });

    io.to(stream.roomId).emit('viewerLeft', { viewerId, viewerCount });
  });

  socket.on('setSlowMode', (data = {}) => {
    const stream = activeStreams.get(userId);
    if (!stream) return;

    stream.slowMode = Boolean(data.enabled);
    touchStream(stream);
    io.to(stream.roomId).emit('slowModeUpdated', { enabled: stream.slowMode });
  });

  socket.on('endStream', () => {
    const stream = activeStreams.get(userId);
    if (!stream) return;

    clearPendingStreamDisconnect(userId);
    io.to(stream.roomId).emit('streamEnded', { hostId: userId });
    activeStreams.delete(userId);
  });

  socket.on('disconnect', () => {
    socketHeartbeats.delete(socket.id);

    // Clean up from all streams
    for (const [hostId, stream] of activeStreams.entries()) {
      if (stream.hostSocketId === socket.id) {
        stream.hostSocketId = null;
        touchStream(stream);
        scheduleStreamDisconnect(hostId, socket.id);
        continue;
      }

      if (stream.viewers?.has(userId)) {
        const { removedViewer, viewerCount } = removeStreamViewerSocket(stream, userId, socket.id);
        if (removedViewer && stream.hostSocketId) {
          io.to(stream.hostSocketId).emit('viewerLeft', { viewerId: userId, viewerCount });
        }
      }
    }

    // Clean up from direct calls with grace period
    const peerId = activeDirectCalls.get(userId);
    if (peerId) {
      // Use grace period instead of immediate ending
      scheduleDirectCallDisconnect(userId);
    }

    const remainingSockets = removeUserSocket(userId, socket.id);
    if (remainingSockets === 0) {
      markUserPresence(userId, false);
    }

    emitOnlineUsers();
    
    // Force garbage collection hint (Node.js will handle this automatically)
    if (global.gc) {
      global.gc();
    }
  });
});

module.exports = {
  app,
  io,
  server,
  getReceiverSocketId,
  deliverMessageFast,
  deliverMessageWithAck,
  activeStreams,
  serializeStream,
  pruneExpiredStreams,
  isStreamJoinable
};
