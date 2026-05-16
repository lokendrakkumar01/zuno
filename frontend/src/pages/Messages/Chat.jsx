import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import { useCallContext } from '../../context/CallContext';
import UserAvatar from '../../components/User/UserAvatar';
import { getEntityId, sameEntityId } from '../../utils/session';

const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '😮', '😢', '👏', '🙏', '👍', '🔥', '❤️', '🎉', '✨', '💯', '🙌', '🤝', '✅', '💬', '📸'];
const PAGE_SIZE = 30;

const styles = `
.rq-chat{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:var(--color-bg-primary,#fff)}
.rq-chat-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--color-border-light,#e5e7eb);background:rgba(255,255,255,.92);backdrop-filter:blur(14px);z-index:2}
.rq-chat-peer{display:flex;align-items:center;gap:10px;min-width:0;color:inherit;text-decoration:none}
.rq-chat-peer strong,.rq-bubble-name{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rq-chat-peer span{display:block;color:var(--color-text-secondary,#64748b);font-size:.82rem}
.rq-head-actions{display:flex;gap:8px}
.rq-icon-btn{width:38px;height:38px;border:1px solid var(--color-border-light,#e5e7eb);border-radius:999px;background:var(--color-bg-card,#fff);display:grid;place-items:center;cursor:pointer;color:var(--color-text-primary,#111827);font-weight:800}
.rq-list{min-height:0}
.rq-row{display:flex;padding:4px 14px}
.rq-row.mine{justify-content:flex-end}
.rq-bubble{max-width:min(76%,620px);border-radius:18px;padding:9px 11px;background:var(--color-bg-secondary,#f1f5f9);color:var(--color-text-primary,#111827);box-shadow:0 1px 2px rgba(15,23,42,.05);position:relative;word-break:break-word}
.rq-row.mine .rq-bubble{background:linear-gradient(135deg,#2563eb,#14b8a6);color:#fff}
.rq-deleted{font-style:italic;opacity:.72}
.rq-media{display:block;max-width:260px;max-height:320px;border-radius:14px;margin-bottom:7px;object-fit:cover;background:#0f172a}
.rq-meta{display:flex;gap:6px;justify-content:flex-end;align-items:center;margin-top:4px;font-size:.68rem;opacity:.72}
.rq-menu{position:absolute;right:8px;top:calc(100% + 6px);display:grid;gap:4px;z-index:6;min-width:170px;padding:6px;border-radius:14px;background:var(--color-bg-card,#fff);border:1px solid var(--color-border-light,#e5e7eb);box-shadow:0 18px 50px rgba(15,23,42,.18)}
.rq-row.mine .rq-menu{color:var(--color-text-primary,#111827)}
.rq-menu button{border:0;background:transparent;text-align:left;padding:9px 10px;border-radius:10px;cursor:pointer;color:inherit}
.rq-menu button:hover{background:var(--color-bg-secondary,#f1f5f9)}
.rq-typing{min-height:20px;padding:0 18px 4px;color:var(--color-text-secondary,#64748b);font-size:.82rem}
.rq-composer{position:relative;display:flex;align-items:flex-end;gap:8px;padding:10px 12px;border-top:1px solid var(--color-border-light,#e5e7eb);background:var(--color-bg-primary,#fff)}
.rq-composer textarea{flex:1;max-height:120px;resize:none;border:1px solid var(--color-border-light,#e5e7eb);border-radius:18px;padding:11px 13px;background:var(--color-bg-secondary,#f8fafc);color:var(--color-text-primary,#111827);outline:none}
.rq-send{width:42px;height:42px;border:0;border-radius:999px;background:#2563eb;color:#fff;font-weight:900;cursor:pointer}
.rq-send:disabled{opacity:.45;cursor:not-allowed}
.rq-emoji{position:absolute;left:12px;bottom:64px;width:min(320px,calc(100vw - 32px));display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:10px;border-radius:18px;background:var(--color-bg-card,#fff);border:1px solid var(--color-border-light,#e5e7eb);box-shadow:0 18px 50px rgba(15,23,42,.18);z-index:8}
.rq-emoji button{border:0;background:transparent;font-size:1.35rem;padding:8px;border-radius:10px;cursor:pointer}
.rq-emoji button:hover{background:var(--color-bg-secondary,#f1f5f9)}
.rq-preview{position:absolute;left:60px;right:70px;bottom:64px;display:flex;align-items:center;gap:10px;padding:8px;border-radius:14px;background:var(--color-bg-card,#fff);border:1px solid var(--color-border-light,#e5e7eb);box-shadow:0 14px 40px rgba(15,23,42,.14);z-index:7}
.rq-preview img,.rq-preview video{width:54px;height:54px;object-fit:cover;border-radius:10px;background:#0f172a}
.rq-skeleton{padding:18px;display:grid;gap:10px}
.rq-skeleton div{height:38px;border-radius:18px;background:linear-gradient(90deg,#eef2f7,#f8fafc,#eef2f7);animation:rq-pulse 1.1s infinite}
@keyframes rq-pulse{50%{opacity:.55}}
`;

const ensureStyles = () => {
  if (document.getElementById('zuno-rq-chat-styles')) return;
  const node = document.createElement('style');
  node.id = 'zuno-rq-chat-styles';
  node.textContent = styles;
  document.head.appendChild(node);
};

const messageId = (message) => getEntityId(message?._id || message?.id || message?.clientMsgId);
const messageText = (message) => message?.content || message?.text || '';
const messageMediaUrl = (message) => message?.mediaUrl || message?.media?.url || '';
const senderId = (message) => getEntityId(message?.sender);
const isEditable = (message, currentUserId) => {
  if (!sameEntityId(message?.sender, currentUserId) || message?.deletedForEveryone) return false;
  return Date.now() - new Date(message.createdAt || 0).getTime() <= 60 * 60 * 1000;
};

const mergeMessages = (messages = []) => {
  const byId = new Map();
  messages
    .filter(Boolean)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .forEach((message) => {
      const id = messageId(message);
      const clientId = message.clientMsgId;
      const existingKey = id || clientId;
      if (!existingKey) return;

      const optimisticKey = clientId && Array.from(byId.keys()).find((key) => key === clientId);
      const finalKey = id || optimisticKey || clientId;
      const previous = optimisticKey ? byId.get(optimisticKey) : byId.get(finalKey);
      if (optimisticKey && optimisticKey !== finalKey) byId.delete(optimisticKey);
      byId.set(finalKey, { ...(previous || {}), ...message, _sending: false });
    });
  return Array.from(byId.values()).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
};

const flattenPages = (data, currentUserId) => {
  const pages = data?.pages || [];
  return mergeMessages(
    [...pages].reverse().flatMap((page) => page?.messages || [])
  ).filter((message) => {
    const deletedFor = message.deletedFor || message.deletedBy || [];
    return !deletedFor.some((id) => sameEntityId(id, currentUserId));
  });
};

export default function Chat() {
  ensureStyles();
  const { userId: conversationParam } = useParams();
  const { token, user } = useAuth();
  const { socket, onlineUsers } = useSocketContext();
  const { startCall } = useCallContext();
  const queryClient = useQueryClient();
  const currentUserId = getEntityId(user);
  const virtuosoRef = useRef(null);
  const fileRef = useRef(null);
  const typingTimerRef = useRef(null);

  const [draft, setDraft] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuId, setMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [typingUser, setTypingUser] = useState(false);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const profileQuery = useQuery({
    queryKey: ['profile', conversationParam],
    enabled: Boolean(token && conversationParam),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`${API_URL}/users/id/${encodeURIComponent(conversationParam)}`, { headers: authHeaders });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || 'Could not load profile');
      return data.data?.user || data.user;
    }
  });

  const messagesQuery = useInfiniteQuery({
    queryKey: ['messages', conversationParam],
    enabled: Boolean(token && conversationParam),
    staleTime: 60_000,
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const url = new URL(`${API_URL}/messages/${encodeURIComponent(conversationParam)}`);
      url.searchParams.set('limit', String(PAGE_SIZE));
      if (pageParam) url.searchParams.set('before', pageParam);
      const res = await fetch(url.toString(), { headers: authHeaders });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || 'Could not load messages');
      return {
        messages: data.messages || data.data?.messages || [],
        nextCursor: data.nextCursor || data.data?.nextCursor || null,
        hasMore: Boolean(data.hasMore || data.data?.hasMore),
        otherUser: data.otherUser || data.data?.otherUser || null
      };
    },
    getNextPageParam: (lastPage) => lastPage?.hasMore ? lastPage.nextCursor : undefined,
    placeholderData: (previous) => previous
  });

  const messages = useMemo(() => flattenPages(messagesQuery.data, currentUserId), [currentUserId, messagesQuery.data]);
  const otherUser = messagesQuery.data?.pages?.[0]?.otherUser || profileQuery.data || null;
  const isOnline = onlineUsers.some((id) => sameEntityId(id, conversationParam));

  const patchMessagesCache = useCallback((updater) => {
    queryClient.setQueryData(['messages', conversationParam], (old) => {
      if (!old?.pages?.length) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({ ...page, messages: updater(page.messages || []) }))
      };
    });
  }, [conversationParam, queryClient]);

  const addMessageToCache = useCallback((message) => {
    queryClient.setQueryData(['messages', conversationParam], (old) => {
      if (!old?.pages?.length) {
        return { pages: [{ messages: [message], hasMore: false, nextCursor: null }], pageParams: [null] };
      }
      const pages = [...old.pages];
      pages[0] = { ...pages[0], messages: mergeMessages([...(pages[0].messages || []), message]) };
      return { ...old, pages };
    });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    requestAnimationFrame(() => virtuosoRef.current?.scrollToIndex?.({ index: 'LAST', align: 'end', behavior: 'smooth' }));
  }, [conversationParam, queryClient]);

  useEffect(() => {
    if (!mediaPreview) return undefined;
    return () => URL.revokeObjectURL(mediaPreview.url);
  }, [mediaPreview]);

  useEffect(() => {
    if (!socket) return undefined;

    const belongsHere = (message) => {
      const sId = senderId(message);
      const rId = getEntityId(message?.receiver);
      const cId = getEntityId(message?.conversationId);
      return cId === conversationParam || sId === conversationParam || rId === conversationParam;
    };

    const onNewMessage = (message) => {
      if (belongsHere(message)) addMessageToCache(message);
    };
    const onEdited = (message) => {
      patchMessagesCache((items) => items.map((item) => messageId(item) === messageId(message) ? { ...item, ...message, edited: true } : item));
    };
    const onDeleted = ({ messageId: deletedId, type, deletedBy }) => {
      patchMessagesCache((items) => type === 'me' && sameEntityId(deletedBy, currentUserId)
        ? items.filter((item) => messageId(item) !== String(deletedId))
        : items.map((item) => messageId(item) === String(deletedId)
          ? { ...item, deletedForEveryone: true, content: '', text: '', mediaUrl: '', media: { url: '', type: '' } }
          : item));
    };
    const onTypingStart = ({ senderId: typingSender }) => {
      if (sameEntityId(typingSender, conversationParam)) setTypingUser(true);
    };
    const onTypingStop = ({ senderId: typingSender }) => {
      if (sameEntityId(typingSender, conversationParam)) setTypingUser(false);
    };

    socket.on('newMessage', onNewMessage);
    socket.on('new_message', onNewMessage);
    socket.on('messageEdited', onEdited);
    socket.on('message_edited', onEdited);
    socket.on('messageDeletedForEveryone', onDeleted);
    socket.on('message_deleted', onDeleted);
    socket.on('typing-start', onTypingStart);
    socket.on('typing', onTypingStart);
    socket.on('typing-stop', onTypingStop);
    socket.on('stopTyping', onTypingStop);
    socket.on('stop-typing', onTypingStop);
    return () => {
      socket.off('newMessage', onNewMessage);
      socket.off('new_message', onNewMessage);
      socket.off('messageEdited', onEdited);
      socket.off('message_edited', onEdited);
      socket.off('messageDeletedForEveryone', onDeleted);
      socket.off('message_deleted', onDeleted);
      socket.off('typing-start', onTypingStart);
      socket.off('typing', onTypingStart);
      socket.off('typing-stop', onTypingStop);
      socket.off('stopTyping', onTypingStop);
      socket.off('stop-typing', onTypingStop);
    };
  }, [addMessageToCache, conversationParam, currentUserId, patchMessagesCache, socket]);

  const sendMutation = useMutation({
    mutationFn: async ({ content, file }) => {
      let mediaUrl = '';
      let mediaType = '';
      if (file) {
        const form = new FormData();
        form.append('file', file);
        const uploadRes = await fetch(`${API_URL}/upload`, { method: 'POST', headers: authHeaders, body: form });
        const uploadData = await uploadRes.json().catch(() => null);
        if (!uploadRes.ok || !uploadData?.success) throw new Error(uploadData?.message || 'Upload failed');
        mediaUrl = uploadData.data?.mediaUrl || uploadData.mediaUrl || uploadData.url;
        mediaType = uploadData.data?.type || (file.type.startsWith('video/') ? 'video' : 'image');
      }

      const clientMsgId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const optimistic = {
        _id: clientMsgId,
        clientMsgId,
        conversationId: conversationParam,
        sender: user,
        receiver: otherUser || conversationParam,
        content,
        text: content,
        mediaUrl,
        media: { url: mediaUrl, type: mediaType },
        createdAt: new Date().toISOString(),
        readBy: [currentUserId],
        _sending: true
      };
      addMessageToCache(optimistic);

      const res = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conversationParam, receiver: conversationParam, content, mediaUrl, mediaType, clientMsgId })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || 'Message failed');
      return { optimisticId: clientMsgId, message: data.data?.message || data.message };
    },
    onSuccess: ({ optimisticId, message }) => {
      patchMessagesCache((items) => mergeMessages(items.map((item) => messageId(item) === optimisticId ? message : item)));
    },
    onError: (error) => {
      patchMessagesCache((items) => items.map((item) => item._sending ? { ...item, _sending: false, _failed: true, error: error.message } : item));
    }
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, content }) => {
      const res = await fetch(`${API_URL}/messages/${id}/edit`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || 'Edit failed');
      return data.data?.message || data.message;
    },
    onMutate: ({ id, content }) => {
      patchMessagesCache((items) => items.map((item) => messageId(item) === id ? { ...item, content, text: content, edited: true } : item));
    },
    onSuccess: (message) => patchMessagesCache((items) => items.map((item) => messageId(item) === messageId(message) ? message : item))
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, mode }) => {
      const res = await fetch(`${API_URL}/messages/${id}/${mode === 'everyone' ? 'delete-for-everyone' : 'delete-for-me'}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || 'Delete failed');
      return { id, mode };
    },
    onMutate: ({ id, mode }) => {
      patchMessagesCache((items) => mode === 'me'
        ? items.filter((item) => messageId(item) !== id)
        : items.map((item) => messageId(item) === id
          ? { ...item, deletedForEveryone: true, content: '', text: '', mediaUrl: '', media: { url: '', type: '' } }
          : item));
    }
  });

  const handleDraftChange = (event) => {
    setDraft(event.target.value);
    if (!socket) return;
    socket.emit('typing-start', { receiverId: conversationParam });
    window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => socket.emit('typing-stop', { receiverId: conversationParam }), 900);
  };

  const handleSend = (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content && !mediaFile) return;
    setDraft('');
    setEmojiOpen(false);
    const file = mediaFile;
    setMediaFile(null);
    setMediaPreview(null);
    socket?.emit('typing-stop', { receiverId: conversationParam });
    sendMutation.mutate({ content, file });
  };

  const beginEdit = (message) => {
    setEditingId(messageId(message));
    setEditingText(messageText(message));
    setMenuId(null);
  };

  const saveEdit = (id) => {
    const content = editingText.trim();
    if (!content) return;
    setEditingId(null);
    setEditingText('');
    editMutation.mutate({ id, content });
  };

  const selectFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setMediaPreview({ url: URL.createObjectURL(file), type: file.type.startsWith('video/') ? 'video' : 'image', name: file.name });
    event.target.value = '';
  };

  return (
    <div className="rq-chat">
      <header className="rq-chat-head">
        <Link className="rq-chat-peer" to={otherUser?.username ? `/u/${otherUser.username}` : `/profile/${conversationParam}`}>
          <UserAvatar user={otherUser} size={42} />
          <div>
            <strong>{otherUser?.displayName || otherUser?.username || 'Conversation'}</strong>
            <span>{typingUser ? 'typing...' : isOnline ? 'online' : 'tap for profile'}</span>
          </div>
        </Link>
        <div className="rq-head-actions">
          <button className="rq-icon-btn" type="button" title="Voice call" onClick={() => startCall?.(conversationParam, 'voice', otherUser)}>☎</button>
          <button className="rq-icon-btn" type="button" title="Video call" onClick={() => startCall?.(conversationParam, 'video', otherUser)}>▣</button>
        </div>
      </header>

      <main className="rq-list">
        {messages.length === 0 && messagesQuery.isFetching ? (
          <div className="rq-skeleton"><div /><div style={{ width: '72%', justifySelf: 'end' }} /><div style={{ width: '64%' }} /></div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={messages}
            followOutput="smooth"
            alignToBottom
            startReached={() => {
              if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) messagesQuery.fetchNextPage();
            }}
            itemContent={(_, message) => {
              const id = messageId(message);
              const mine = sameEntityId(message.sender, currentUserId);
              const mediaUrl = messageMediaUrl(message);
              const text = messageText(message);
              return (
                <div className={`rq-row ${mine ? 'mine' : ''}`}>
                  <div
                    className="rq-bubble"
                    onContextMenu={(event) => { event.preventDefault(); setMenuId(menuId === id ? null : id); }}
                    onDoubleClick={() => setMenuId(menuId === id ? null : id)}
                  >
                    {message.deletedForEveryone ? (
                      <span className="rq-deleted">This message was deleted</span>
                    ) : editingId === id ? (
                      <form onSubmit={(event) => { event.preventDefault(); saveEdit(id); }}>
                        <textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} autoFocus />
                        <div className="rq-meta">
                          <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                          <button type="submit">Save</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        {mediaUrl && (message.media?.type === 'video' ? <video className="rq-media" src={mediaUrl} controls preload="metadata" /> : <img className="rq-media" src={mediaUrl} alt="" loading="lazy" />)}
                        {text ? <div>{text}</div> : null}
                      </>
                    )}
                    <div className="rq-meta">
                      <span>{new Date(message.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {message.edited ? <span>edited</span> : null}
                      {message._sending ? <span>sending</span> : null}
                      {message._failed ? <span>failed</span> : null}
                    </div>
                    {menuId === id && !message.deletedForEveryone ? (
                      <div className="rq-menu">
                        {isEditable(message, currentUserId) ? <button type="button" onClick={() => beginEdit(message)}>Edit</button> : null}
                        {mine ? <button type="button" onClick={() => { setMenuId(null); deleteMutation.mutate({ id, mode: 'everyone' }); }}>Delete for Everyone</button> : null}
                        <button type="button" onClick={() => { setMenuId(null); deleteMutation.mutate({ id, mode: 'me' }); }}>Delete for Me</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            }}
          />
        )}
      </main>

      <div className="rq-typing">{typingUser ? `${otherUser?.displayName || otherUser?.username || 'They'} is typing...` : ''}</div>

      {emojiOpen ? <div className="rq-emoji">{EMOJIS.map((emoji) => <button type="button" key={emoji} onClick={() => setDraft((value) => `${value}${emoji}`)}>{emoji}</button>)}</div> : null}
      {mediaPreview ? (
        <div className="rq-preview">
          {mediaPreview.type === 'video' ? <video src={mediaPreview.url} muted /> : <img src={mediaPreview.url} alt="" />}
          <span>{mediaPreview.name}</span>
          <button className="rq-icon-btn" type="button" onClick={() => { setMediaFile(null); setMediaPreview(null); }}>×</button>
        </div>
      ) : null}

      <form className="rq-composer" onSubmit={handleSend}>
        <button className="rq-icon-btn" type="button" title="Emoji" onClick={() => setEmojiOpen((value) => !value)}>☺</button>
        <button className="rq-icon-btn" type="button" title="Attach media" onClick={() => fileRef.current?.click()}>＋</button>
        <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={selectFile} />
        <textarea value={draft} onChange={handleDraftChange} placeholder="Message..." rows={1} />
        <button className="rq-send" type="submit" disabled={!draft.trim() && !mediaFile}>➤</button>
      </form>
    </div>
  );
}
