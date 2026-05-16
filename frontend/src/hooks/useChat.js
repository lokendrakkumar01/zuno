import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '../config';

const makeClientId = () => `opt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const getId = (value) => String(value?._id || value?.id || value || '');

const sortMessages = (messages = []) =>
  [...messages].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

const mergeMessageList = (messages = []) => {
  const byId = new Map();
  const clientToKey = new Map();

  sortMessages(messages).forEach((message, index) => {
    if (!message) return;
    const realId = getId(message._id);
    const clientId = message.clientMsgId ? String(message.clientMsgId) : '';

    if (clientId && clientToKey.has(clientId)) {
      const previousKey = clientToKey.get(clientId);
      const nextKey = realId || previousKey;
      const previous = byId.get(previousKey) || {};
      if (previousKey !== nextKey) byId.delete(previousKey);
      byId.set(nextKey, { ...previous, ...message, _sending: false, _failed: false });
      clientToKey.set(clientId, nextKey);
      return;
    }

    if (realId && byId.has(realId)) {
      byId.set(realId, { ...byId.get(realId), ...message });
      if (clientId) clientToKey.set(clientId, realId);
      return;
    }

    const key = realId || clientId || `message-${index}`;
    byId.set(key, message);
    if (clientId) clientToKey.set(clientId, key);
  });

  return sortMessages(Array.from(byId.values()));
};

const extractMessages = (queryData) =>
  mergeMessageList((queryData?.pages || []).flatMap((page) => page.messages || []));

const patchFirstPage = (queryClient, queryKey, updater) => {
  queryClient.setQueryData(queryKey, (oldData) => {
    if (!oldData?.pages?.length) {
      return {
        pageParams: [undefined],
        pages: [{ messages: updater([]), hasMore: false, nextCursor: null }]
      };
    }

    const pages = oldData.pages.map((page, index) => (
      index === 0 ? { ...page, messages: updater(page.messages || []) } : page
    ));

    return { ...oldData, pages };
  });
};

export const useChat = ({ token, user, receiverId, socket, emitWithAck }) => {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const typingTimer = useRef(null);

  const myId = useMemo(() => getId(user), [user]);
  const queryKey = useMemo(() => ['messages', String(receiverId || '')], [receiverId]);

  const query = useInfiniteQuery({
    queryKey,
    enabled: Boolean(token && receiverId),
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '30' });
      if (pageParam) params.set('before', pageParam);

      const res = await fetch(`${API_URL}/messages/${receiverId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Could not load messages.');
      }

      const payload = data.data || data;
      const messages = payload.messages || [];
      return {
        messages,
        hasMore: Boolean(payload.hasMore),
        nextCursor: payload.nextCursor || payload.oldestMessageId || messages[0]?._id || null,
        otherUser: payload.otherUser || null,
        blockedInfo: payload.blockedInfo || null
      };
    },
    getNextPageParam: (lastPage) => (lastPage?.hasMore ? lastPage.nextCursor : undefined),
    staleTime: 20_000,
    retry: 1
  });

  const messages = useMemo(() => extractMessages(query.data), [query.data]);

  const setMessages = useCallback((updater) => {
    patchFirstPage(queryClient, queryKey, (current) => (
      typeof updater === 'function' ? updater(current) : updater
    ));
  }, [queryClient, queryKey]);

  const sendMessage = useCallback(async ({ text, media } = {}) => {
    const trimmed = String(text || '').trim();
    if (!trimmed && !media) return null;
    if (!receiverId || !emitWithAck) {
      setError('Realtime connection is not ready.');
      return null;
    }

    const clientMsgId = makeClientId();
    const optimistic = {
      _id: clientMsgId,
      clientMsgId,
      sender: { _id: myId, id: myId, username: user?.username, avatar: user?.avatar },
      receiver: receiverId,
      text: trimmed,
      media: media || null,
      status: 'sending',
      createdAt: new Date().toISOString()
    };

    patchFirstPage(queryClient, queryKey, (current) => mergeMessageList([...current, optimistic]));
    setError('');

    try {
      const response = await emitWithAck('send-message', {
        receiverId,
        text: trimmed,
        media: media || undefined,
        clientMsgId
      });

      if (!response?.success) throw new Error(response?.message || 'Message failed to send.');
      const realMessage = { ...(response.message || response), clientMsgId };
      patchFirstPage(queryClient, queryKey, (current) => mergeMessageList([...current, realMessage]));
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      return realMessage;
    } catch (err) {
      patchFirstPage(queryClient, queryKey, (current) =>
        current.map((message) => (
          message.clientMsgId === clientMsgId ? { ...message, status: 'failed' } : message
        ))
      );
      setError(err.message || 'Message failed to send.');
      return null;
    }
  }, [emitWithAck, myId, queryClient, queryKey, receiverId, user]);

  const emitTyping = useCallback(() => {
    if (!socket?.connected || !receiverId) return;
    socket.emit('typing', { receiverId });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit('stopTyping', { receiverId });
    }, 1800);
  }, [receiverId, socket]);

  useEffect(() => {
    if (!socket || !receiverId) return undefined;

    const isRelevant = (message) => {
      const senderId = getId(message?.sender);
      const targetId = getId(message?.receiver);
      return (
        (senderId === String(receiverId) && targetId === myId) ||
        (senderId === myId && targetId === String(receiverId))
      );
    };

    const onNewMessage = (message) => {
      if (!isRelevant(message)) return;
      patchFirstPage(queryClient, queryKey, (current) => mergeMessageList([...current, message]));
      queryClient.invalidateQueries({ queryKey: ['conversations'] });

      if (getId(message.receiver) === myId && document.visibilityState === 'visible') {
        socket.emit('message-read', { messageId: message._id, senderId: getId(message.sender) });
      }
    };

    const onStatus = ({ messageId, status }) => {
      patchFirstPage(queryClient, queryKey, (current) =>
        current.map((message) => (
          String(message._id) === String(messageId)
            ? { ...message, status, read: status === 'read' }
            : message
        ))
      );
    };

    const onTyping = ({ senderId }) => {
      if (String(senderId) === String(receiverId)) {
        setTypingUsers((previous) => new Set(previous).add(String(senderId)));
      }
    };

    const onStopTyping = ({ senderId }) => {
      if (String(senderId) === String(receiverId)) {
        setTypingUsers((previous) => {
          const next = new Set(previous);
          next.delete(String(senderId));
          return next;
        });
      }
    };

    socket.on('newMessage', onNewMessage);
    socket.on('new_message', onNewMessage);
    socket.on('message-received', onNewMessage);
    socket.on('message-status', onStatus);
    socket.on('typing', onTyping);
    socket.on('stopTyping', onStopTyping);
    socket.on('stop-typing', onStopTyping);

    return () => {
      socket.off('newMessage', onNewMessage);
      socket.off('new_message', onNewMessage);
      socket.off('message-received', onNewMessage);
      socket.off('message-status', onStatus);
      socket.off('typing', onTyping);
      socket.off('stopTyping', onStopTyping);
      socket.off('stop-typing', onStopTyping);
      clearTimeout(typingTimer.current);
    };
  }, [myId, queryClient, queryKey, receiverId, socket]);

  return {
    messages,
    loading: query.isLoading,
    loadingMore: query.isFetchingNextPage,
    error: error || (query.error?.message || ''),
    hasMore: Boolean(query.hasNextPage),
    loadMore: query.fetchNextPage,
    sendMessage,
    emitTyping,
    typingUsers,
    setMessages
  };
};

export default useChat;
