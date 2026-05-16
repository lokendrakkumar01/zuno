/**
 * useChat.js — FIX: PROBLEMS 1, 5 & 6
 *
 * FIX PROBLEM 1 (Message slow):
 *   - Optimistic message is added to UI instantly (before any network call)
 *   - On server confirm → temp message is swapped for real one (with real _id)
 *   - On failure → temp message shows status: 'failed' so user can retry
 *
 * FIX PROBLEM 5 (Frontend laggy):
 *   - mergeMessages deduplicates by _id/clientMsgId so socket echoes never
 *     create duplicates alongside the optimistic copy
 *   - fetchMessages normalises the response shape correctly
 *
 * FIX PROBLEM 6 (Missing features):
 *   - Typing indicator emitted via socket (typing / stopTyping)
 *   - message-status (sent/delivered/read) handled in real-time
 *   - Auto read-receipt emitted when a message arrives and window is active
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../config';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeClientId = () =>
  `opt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Merge message arrays, deduplicating on _id > clientMsgId.
 * - Real server messages (with _id) always win over temp optimistic copies.
 * - Sorted oldest → newest for display.
 */
const mergeMessages = (incoming, existing = []) => {
  const byKey = new Map();

  // Existing first so real messages are the base
  [...existing, ...incoming].forEach((msg) => {
    if (!msg) return;
    // Prefer real _id; fall back to clientMsgId so optimistic copies are found
    const key = msg._id && !msg._id.startsWith('opt_')
      ? String(msg._id)
      : msg.clientMsgId
        ? `c_${String(msg.clientMsgId)}`
        : `rnd_${Math.random()}`;

    const prev = byKey.get(key);
    // If we already have a real message for this key, don't overwrite with optimistic
    if (prev && !prev._id?.startsWith('opt_') && msg._id?.startsWith('opt_')) return;
    byKey.set(key, { ...prev, ...msg });
  });

  return Array.from(byKey.values()).sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useChat = ({ token, user, receiverId, socket, emitWithAck }) => {
  const [messages, setMessages]       = useState([]);
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [hasMore, setHasMore]         = useState(true);
  const oldestIdRef  = useRef(null);
  const typingTimer  = useRef(null);

  const myId = useMemo(
    () => String(user?.id || user?._id || ''),
    [user]
  );

  // ── Fetch (initial + pagination) ───────────────────────────────────────────

  const fetchMessages = useCallback(async (beforeId) => {
    if (!token || !receiverId) return;

    try {
      beforeId ? setLoadingMore(true) : setLoading(true);
      setError('');

      const params = new URLSearchParams({ limit: '30' });
      if (beforeId) params.set('beforeId', beforeId);

      const res  = await fetch(`${API_URL}/messages/${receiverId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load messages');

      // API returns newest-first; reverse so UI shows oldest at top
      const fetched = (data.data?.messages || data.messages || []).slice().reverse();

      if (fetched.length > 0) {
        oldestIdRef.current = fetched[0]._id || null;
      }

      setHasMore(Boolean(data.data?.hasMore ?? data.hasMore));

      // FIX PROBLEM 5: merge so we don't lose optimistic messages mid-load
      setMessages((prev) =>
        beforeId ? mergeMessages(fetched, prev) : mergeMessages(fetched)
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [receiverId, token]);

  const loadMore = useCallback(() => {
    if (hasMore && oldestIdRef.current && !loadingMore) {
      fetchMessages(oldestIdRef.current);
    }
  }, [fetchMessages, hasMore, loadingMore]);

  // ── Send message — FIX PROBLEMS 1 & 5 ─────────────────────────────────────

  const sendMessage = useCallback(async ({ text, media } = {}) => {
    const clientMsgId = makeClientId();

    // FIX PROBLEM 1: optimistic insert — appears IMMEDIATELY in UI
    const optimistic = {
      _id:       clientMsgId,   // starts with 'opt_' so merge knows it's temp
      clientMsgId,
      sender:    { _id: myId, id: myId },
      receiver:  receiverId,
      text:      text || '',
      media:     media || null,
      status:    'sending',     // UI can show a spinner/clock on this
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => mergeMessages([optimistic], prev));

    try {
      // FIX PROBLEM 1: use socket emit (not HTTP) for lowest latency
      const response = await emitWithAck('send-message', {
        receiverId,
        text,
        media,
        clientMsgId,
      });

      if (!response?.success) throw new Error(response?.message || 'Send failed');

      const realMsg = response.message || response;

      // FIX PROBLEM 5: swap optimistic copy with real server message
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMsgId === clientMsgId
            ? { ...realMsg, clientMsgId }
            : m
        )
      );

      return realMsg;
    } catch (err) {
      // FIX PROBLEM 5: mark as failed so UI can show retry button
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMsgId === clientMsgId
            ? { ...m, status: 'failed' }
            : m
        )
      );
      setError(err.message);
      return null;
    }
  }, [emitWithAck, myId, receiverId]);

  // ── Typing indicator — FIX PROBLEM 6 ──────────────────────────────────────

  const emitTyping = useCallback(() => {
    if (!socket?.connected || !receiverId) return;
    socket.emit('typing', { receiverId });
    clearTimeout(typingTimer.current);
    // Auto stop-typing after 2 s of silence
    typingTimer.current = setTimeout(() => {
      socket.emit('stopTyping', { receiverId });
    }, 2000);
  }, [receiverId, socket]);

  // ── Load on mount ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token || !receiverId) return undefined;
    setMessages([]);
    oldestIdRef.current = null;
    fetchMessages();
    return () => {
      setMessages([]);
      clearTimeout(typingTimer.current);
    };
  }, [receiverId, token, fetchMessages]);

  // ── Socket listeners — FIX PROBLEMS 1, 5 & 6 ─────────────────────────────

  useEffect(() => {
    if (!socket) return undefined;

    const relevantSender = (msg) => {
      const sid = String(msg.sender?._id || msg.sender?.id || msg.sender || '');
      const rid = String(msg.receiver?._id || msg.receiver?.id || msg.receiver || '');
      // Message is relevant if it's part of this conversation
      return (
        (sid === String(receiverId) || rid === String(receiverId)) ||
        (sid === myId && rid === String(receiverId)) ||
        (sid === String(receiverId) && rid === myId)
      );
    };

    /** Handle new inbound or echo message — FIX PROBLEM 1 & 5 */
    const onNewMessage = (msg) => {
      if (!msg || !relevantSender(msg)) return;

      // FIX PROBLEM 5: merge so optimistic isn't duplicated
      setMessages((prev) => mergeMessages([msg], prev));

      // FIX PROBLEM 6: auto read-receipt when window is visible
      const rid = String(msg.receiver?._id || msg.receiver?.id || msg.receiver || '');
      if (rid === myId && document.visibilityState === 'visible') {
        socket.emit('message-read', {
          messageId: msg._id,
          senderId:  String(msg.sender?._id || msg.sender),
        });
      }
    };

    /** Handle status updates (sent/delivered/read) — FIX PROBLEM 6 */
    const onStatus = ({ messageId, status }) => {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(messageId)
            ? { ...m, status, read: status === 'read' }
            : m
        )
      );
    };

    /** Typing on — FIX PROBLEM 6 */
    const onTyping = ({ senderId }) => {
      if (String(senderId) === String(receiverId)) {
        setTypingUsers((prev) => new Set(prev).add(String(senderId)));
      }
    };

    /** Typing off — FIX PROBLEM 6 */
    const onStopTyping = ({ senderId }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(String(senderId));
        return next;
      });
    };

    // Subscribe — cover both naming conventions used by the backend
    socket.on('newMessage',       onNewMessage);
    socket.on('new_message',      onNewMessage);
    socket.on('message-received', onNewMessage);

    socket.on('message-status',   onStatus);
    socket.on('message_status',   onStatus);

    socket.on('typing',           onTyping);
    socket.on('typing_start',     onTyping);

    socket.on('stopTyping',       onStopTyping);
    socket.on('stop-typing',      onStopTyping);
    socket.on('typing_stop',      onStopTyping);

    return () => {
      socket.off('newMessage',       onNewMessage);
      socket.off('new_message',      onNewMessage);
      socket.off('message-received', onNewMessage);

      socket.off('message-status',   onStatus);
      socket.off('message_status',   onStatus);

      socket.off('typing',           onTyping);
      socket.off('typing_start',     onTyping);

      socket.off('stopTyping',       onStopTyping);
      socket.off('stop-typing',      onStopTyping);
      socket.off('typing_stop',      onStopTyping);

      clearTimeout(typingTimer.current);
    };
  }, [myId, receiverId, socket]);

  return {
    messages,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    sendMessage,
    emitTyping,
    typingUsers,
  };
};

export default useChat;
