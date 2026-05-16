/**
 * hooks/useSendMessage.js — FIX: BUG 2 (Message Race Condition) + BUG 10 (Frontend Performance)
 *
 * BUGS FIXED:
 *  - BUG 2: Messages stuck in "sending" — socket was emitting before DB save.
 *    Fix: Use emitWithAck so the frontend waits for backend ACK (DB save + emit done).
 *    Optimistic update shows message INSTANTLY in UI while socket round-trip completes.
 *  - BUG 2: Duplicate messages when optimistic + real message both appear.
 *    Fix: clientMsgId deduplication — temp message swapped (not added) on ACK.
 *  - BUG 10: No optimistic update → apparent lag between typing and seeing your message.
 *    Fix: Message appears instantly in local state before any network call.
 *
 * USAGE:
 *   const { sendMessage, sending, error } = useSendMessage({ socket, emitWithAck, user, receiverId, setMessages });
 */

import { useCallback, useRef, useState } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeClientId = () =>
  `opt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * Merge incoming message into existing list.
 * - Replaces optimistic copy (clientMsgId match) with real server message.
 * - Deduplicates by _id to prevent double rendering on socket echo.
 */
export const mergeMessage = (prev, incoming) => {
  const list = Array.isArray(prev) ? prev : [];

  // If a temp message with this clientMsgId exists, replace it
  if (incoming.clientMsgId) {
    const idx = list.findIndex(
      (m) => m.clientMsgId === incoming.clientMsgId || m._id === incoming.clientMsgId
    );
    if (idx !== -1) {
      const updated = [...list];
      updated[idx] = { ...updated[idx], ...incoming };
      return updated;
    }
  }

  // Prevent duplicate by real _id
  if (incoming._id && list.some((m) => String(m._id) === String(incoming._id))) {
    return list;
  }

  return [...list, incoming].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {Function} opts.emitWithAck   - from useSocket: returns Promise<response>
 * @param {object}   opts.user          - current authenticated user
 * @param {string}   opts.receiverId    - user ID of recipient
 * @param {Function} opts.setMessages   - React state setter for messages array
 */
export const useSendMessage = ({ emitWithAck, user, receiverId, setMessages }) => {
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');
  const abortRef = useRef(false);

  const myId = String(user?.id || user?._id || '');

  /**
   * Send a message with optimistic UI update.
   *
   * @param {{ text?: string, media?: object, replyTo?: string }} payload
   * @returns {Promise<object|null>}  The confirmed server message, or null on failure.
   */
  const sendMessage = useCallback(async ({ text = '', media = null, replyTo = null } = {}) => {
    const trimmedText = String(text || '').trim();
    if (!trimmedText && !media) return null;
    if (!receiverId) { setError('No recipient selected'); return null; }
    if (!emitWithAck) { setError('Not connected'); return null; }

    const clientMsgId = makeClientId();
    abortRef.current  = false;
    setError('');
    setSending(true);

    // FIX BUG 10: Optimistic insert — message appears INSTANTLY
    const optimistic = {
      _id:         clientMsgId,
      clientMsgId,
      sender:      { _id: myId, id: myId, username: user?.username, avatar: user?.avatar },
      receiver:    receiverId,
      text:        trimmedText,
      media:       media || null,
      replyTo:     replyTo || null,
      status:      'sending',   // frontend shows clock icon for this status
      createdAt:   new Date().toISOString(),
    };

    // FIX BUG 2: Add to UI immediately
    setMessages((prev) => mergeMessage(prev, optimistic));

    try {
      // FIX BUG 2: emitWithAck — backend saves to DB first, then ACKs
      const response = await emitWithAck('send-message', {
        receiverId,
        text:       trimmedText,
        media:      media || undefined,
        replyTo:    replyTo || undefined,
        clientMsgId,
      });

      if (!response?.success) {
        throw new Error(response?.message || 'Message failed to send');
      }

      const realMsg = response.message || response;

      if (!abortRef.current) {
        // FIX BUG 2: Replace optimistic with real server message (preserves _id, status)
        setMessages((prev) =>
          mergeMessage(prev, { ...realMsg, clientMsgId })
        );
      }

      return realMsg;
    } catch (err) {
      if (!abortRef.current) {
        // FIX BUG 2: Mark as failed so user can see retry option
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMsgId === clientMsgId ? { ...m, status: 'failed' } : m
          )
        );
        setError(err.message || 'Failed to send message');
      }
      return null;
    } finally {
      if (!abortRef.current) setSending(false);
    }
  }, [emitWithAck, myId, receiverId, setMessages, user]);

  /**
   * Retry a failed message.
   * Removes the failed copy and re-sends with a new clientMsgId.
   */
  const retryMessage = useCallback(async (failedMsg) => {
    // Remove the failed optimistic copy
    setMessages((prev) => prev.filter((m) => m.clientMsgId !== failedMsg.clientMsgId));
    return sendMessage({ text: failedMsg.text, media: failedMsg.media, replyTo: failedMsg.replyTo });
  }, [sendMessage, setMessages]);

  // Cancel any in-flight operation (e.g. on unmount)
  const cancel = useCallback(() => { abortRef.current = true; }, []);

  return { sendMessage, retryMessage, cancel, sending, error, setError };
};

export default useSendMessage;
