/**
 * hooks/useListenMessages.js — FIX: BUG 1 (Memory Leak) + BUG 2 (Race Condition) + BUG 10 (Performance)
 *
 * BUGS FIXED:
 *  - BUG 1: Socket listeners added but never cleaned up → memory growing over time.
 *    Fix: useEffect return cleans up ALL listeners that were registered.
 *    Covers every event alias emitted by the backend (kebab-case + camelCase).
 *  - BUG 2: Duplicate messages when socket echo arrives alongside optimistic copy.
 *    Fix: mergeMessage() deduplicates by clientMsgId → replaces optimistic, not adds.
 *  - BUG 10: No seen/delivered tracking → unread badges wrong.
 *    Fix: Auto-emit message-read when message arrives and tab is visible.
 *    message-status event updates individual message status in real-time.
 *
 * USAGE:
 *   useListenMessages({ socket, user, receiverId, setMessages });
 */

import { useEffect } from 'react';
import { mergeMessage } from './useSendMessage';

/**
 * @param {object} opts
 * @param {object}   opts.socket      - Socket.io client instance
 * @param {object}   opts.user        - current authenticated user
 * @param {string}   opts.receiverId  - the other party's user ID (current conversation)
 * @param {Function} opts.setMessages - React state setter for messages array
 */
export const useListenMessages = ({ socket, user, receiverId, setMessages }) => {
  const myId  = String(user?.id  || user?._id || '');
  const otherId = String(receiverId || '');

  useEffect(() => {
    if (!socket || !myId || !otherId) return undefined;

    // ── Helpers ─────────────────────────────────────────────────────────────

    const isRelevant = (msg) => {
      if (!msg) return false;
      const sid = String(msg.sender?._id || msg.sender?.id || msg.sender || '');
      const rid = String(msg.receiver?._id || msg.receiver?.id || msg.receiver || '');
      // Message belongs to this conversation
      return (
        (sid === otherId && rid === myId) ||
        (sid === myId   && rid === otherId)
      );
    };

    // ── Handlers ─────────────────────────────────────────────────────────────

    /**
     * FIX BUG 2: New message received.
     * mergeMessage replaces optimistic copies; deduplicates by _id.
     */
    const onNewMessage = (msg) => {
      if (!isRelevant(msg)) return;

      setMessages((prev) => mergeMessage(prev, msg));

      // FIX BUG 10: Auto read-receipt when tab is visible and message is for me
      const rid = String(msg.receiver?._id || msg.receiver?.id || msg.receiver || '');
      if (rid === myId && document.visibilityState === 'visible') {
        const sid = String(msg.sender?._id || msg.sender?.id || msg.sender || '');
        socket.emit('message-read', { messageId: msg._id, senderId: sid });
      }
    };

    /**
     * FIX BUG 10: Real-time status update (sent → delivered → read).
     * Updates only the specific message in state; no full list re-fetch.
     */
    const onStatus = ({ messageId, status }) => {
      if (!messageId || !status) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(messageId)
            ? { ...m, status, read: status === 'read' }
            : m
        )
      );
    };

    /**
     * FIX BUG 1: Message deleted for everyone.
     */
    const onMessageDeleted = ({ messageId, mode }) => {
      if (!messageId) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(messageId)
            ? mode === 'everyone'
              ? { ...m, deletedForEveryone: true, text: '', media: null }
              : { ...m, deletedBy: [...(m.deletedBy || []), myId] }
            : m
        )
      );
    };

    /**
     * Message reaction updated.
     */
    const onReaction = ({ messageId, reactions }) => {
      if (!messageId) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(messageId) ? { ...m, reactions } : m
        )
      );
    };

    // ── FIX BUG 1: Subscribe — register all event aliases ────────────────────
    // Backend emits under different names depending on event path; cover all.
    socket.on('newMessage',              onNewMessage);
    socket.on('new_message',             onNewMessage);
    socket.on('message-received',        onNewMessage);

    socket.on('message-status',          onStatus);
    socket.on('message_status',          onStatus);

    socket.on('message_deleted',         onMessageDeleted);
    socket.on('messageDeletedForEveryone', onMessageDeleted);

    socket.on('messageReaction',         onReaction);
    socket.on('message_reaction',        onReaction);

    // FIX BUG 1: CLEANUP — remove every listener we registered
    return () => {
      socket.off('newMessage',              onNewMessage);
      socket.off('new_message',             onNewMessage);
      socket.off('message-received',        onNewMessage);

      socket.off('message-status',          onStatus);
      socket.off('message_status',          onStatus);

      socket.off('message_deleted',         onMessageDeleted);
      socket.off('messageDeletedForEveryone', onMessageDeleted);

      socket.off('messageReaction',         onReaction);
      socket.off('message_reaction',        onReaction);
    };
  }, [myId, otherId, setMessages, socket]);
};

export default useListenMessages;
