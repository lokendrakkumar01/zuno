import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../config';

const makeClientMsgId = () => `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const mergeMessages = (messages) => {
  const byId = new Map();
  messages.forEach((message) => {
    const key = message._id || message.id || message.clientMsgId;
    if (key) byId.set(String(key), { ...byId.get(String(key)), ...message });
  });
  return Array.from(byId.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

export const useChat = ({ token, user, receiverId, socket, emitWithAck }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const typingTimer = useRef(null);

  const sortedMessages = useMemo(() => mergeMessages(messages), [messages]);

  const fetchMessages = useCallback(async (before) => {
    try {
      before ? setLoadingMore(true) : setLoading(true);
      setError('');
      const params = new URLSearchParams({ limit: '30' });
      if (before) params.set('before', before);
      const response = await fetch(`${API_URL}/messages/${receiverId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load messages');
      setMessages((prev) => before ? mergeMessages([...data.messages, ...prev]) : data.messages);
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [receiverId, token]);

  const loadMore = useCallback(() => {
    if (hasMore && cursor && !loadingMore) fetchMessages(cursor);
  }, [cursor, fetchMessages, hasMore, loadingMore]);

  const sendMessage = useCallback(async ({ text, media } = {}) => {
    const clientMsgId = makeClientMsgId();
    const optimistic = {
      _id: clientMsgId,
      clientMsgId,
      sender: { _id: user?.id || user?._id, id: user?.id || user?._id },
      receiver: receiverId,
      text,
      media,
      status: 'sent',
      createdAt: new Date().toISOString()
    };

    try {
      setMessages((prev) => mergeMessages([...prev, optimistic]));
      const response = await emitWithAck('send-message', { receiverId, text, media, clientMsgId });
      setMessages((prev) => mergeMessages(prev.map((msg) => msg.clientMsgId === clientMsgId ? response.message : msg)));
      return response.message;
    } catch (err) {
      setMessages((prev) => prev.map((msg) => msg.clientMsgId === clientMsgId ? { ...msg, status: 'failed' } : msg));
      setError(err.message);
      return null;
    }
  }, [emitWithAck, receiverId, user]);

  const emitTyping = useCallback(() => {
    if (!socket || !receiverId) return;
    socket.emit('typing', { receiverId });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit('stop-typing', { receiverId });
    }, 300);
  }, [receiverId, socket]);

  useEffect(() => {
    if (!token || !receiverId) return undefined;
    fetchMessages();
    return () => setMessages([]);
  }, [fetchMessages, receiverId, token]);

  useEffect(() => {
    if (!socket) return undefined;

    const onMessage = (message, ack) => {
      const senderId = message.sender?._id || message.sender?.id || message.sender;
      const receiver = message.receiver?._id || message.receiver?.id || message.receiver;
      const me = user?.id || user?._id;
      if (String(senderId) !== String(receiverId) && String(receiver) !== String(receiverId)) return;
      setMessages((prev) => mergeMessages([...prev, message]));
      if (String(receiver) === String(me)) {
        socket.emit('message-read', { messageId: message._id, senderId });
      }
      if (typeof ack === 'function') ack({ ok: true });
    };
    const onStatus = ({ messageId, status }) => {
      setMessages((prev) => prev.map((msg) => String(msg._id) === String(messageId) ? { ...msg, status, read: status === 'read' } : msg));
    };
    const onTyping = ({ senderId }) => setTypingUsers((prev) => new Set(prev).add(String(senderId)));
    const onStopTyping = ({ senderId }) => setTypingUsers((prev) => {
      const next = new Set(prev);
      next.delete(String(senderId));
      return next;
    });

    socket.on('message-received', onMessage);
    socket.on('message-status', onStatus);
    socket.on('typing', onTyping);
    socket.on('stop-typing', onStopTyping);

    return () => {
      socket.off('message-received', onMessage);
      socket.off('message-status', onStatus);
      socket.off('typing', onTyping);
      socket.off('stop-typing', onStopTyping);
      clearTimeout(typingTimer.current);
    };
  }, [receiverId, socket, user]);

  return { messages: sortedMessages, loading, loadingMore, error, hasMore, loadMore, sendMessage, emitTyping, typingUsers };
};

export default useChat;
