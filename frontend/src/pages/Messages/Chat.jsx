import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import { API_URL } from '../../config';
import { useCallContext } from '../../context/CallContext';

// Common emojis organized by category
const EMOJI_DATA = {
      '😀': ['😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😇', '🤗', '🤔', '😏', '😴', '🤤', '😋', '🤪', '😜', '😝'],
      '❤️': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💖', '💗', '💘', '💝', '💞', '💓', '💔', '🫶', '🤝', '👍', '👎'],
      '🎉': ['🎉', '🎊', '🎈', '🎁', '🎂', '🔥', '⭐', '✨', '💫', '🌟', '💯', '✅', '❌', '⚡', '💥', '💢', '💤', '🎵', '🎶', '🎯'],
      '🙏': ['🙏', '💪', '✌️', '🤞', '👋', '👏', '🙌', '👐', '🤲', '🫡', '🫣', '🫢', '🤫', '🤭', '🫠', '😐', '😑', '😶', '🙄', '😬'],
      '🍕': ['🍕', '🍔', '🍟', '🌮', '🍜', '🍩', '🍪', '🎂', '🧁', '🍰', '🍫', '🍬', '☕', '🧃', '🍷', '🍻', '🥤', '🍳', '🥗', '🍣']
};

const Chat = () => {
      const { userId } = useParams();
      const { token, user } = useAuth();
      const { socket, onlineUsers } = useSocketContext();
      const navigate = useNavigate();
      const [messages, setMessages] = useState(() => {
            try {
                  const cached = sessionStorage.getItem(`zuno_chat_cache_${userId}`); // Use sessionStorage for temporary fast access
                  return cached ? JSON.parse(cached) : [];
            } catch {
                  return [];
            }
      });
      const [otherUser, setOtherUser] = useState(() => {
            try {
                  const cached = localStorage.getItem(`zuno_user_cache_${userId}`);
                  return cached ? JSON.parse(cached) : null;
            } catch {
                  return null;
            }
      });
      const [newMessage, setNewMessage] = useState('');
      const [loading, setLoading] = useState(!sessionStorage.getItem(`zuno_chat_cache_${userId}`));
      const [sending, setSending] = useState(false);
      const messagesEndRef = useRef(null);
      const pollRef = useRef(null);
      const fileInputRef = useRef(null);

      // Edit & Delete states
      const [activeMenu, setActiveMenu] = useState(null);
      const [editingId, setEditingId] = useState(null);
      const [editText, setEditText] = useState('');

      // Emoji picker
      const [showEmoji, setShowEmoji] = useState(false);

      // Media preview
      const [mediaPreview, setMediaPreview] = useState(null);
      const [mediaFile, setMediaFile] = useState(null);

      // WebRTC Call State from Context
      const { startCall, isCalling, callAccepted } = useCallContext();

      // Customization
      const [showCustomizeModal, setShowCustomizeModal] = useState(false);
      const defaultCustomization = { themeColor: '#6366f1', bgImage: null };
      const [chatCustomization, setChatCustomization] = useState(defaultCustomization);

      const THEMES = [
            { id: 'indigo', color: '#6366f1' },
            { id: 'rose', color: '#f43f5e' },
            { id: 'emerald', color: '#10b981' },
            { id: 'amber', color: '#f59e0b' },
            { id: 'purple', color: '#a855f7' },
            { id: 'blue', color: '#3b82f6' },
            { id: 'dark', color: '#334155' }
      ];

      // Load customization on mount
      useEffect(() => {
            if (user && user._id) {
                  const saved = localStorage.getItem(`zuno_chat_prefs_${user._id}`);
                  if (saved) {
                        try {
                              setChatCustomization(JSON.parse(saved));
                        } catch (e) {
                              console.error('Failed to parse chat preferences');
                        }
                  }
            }
      }, [user]);

      // Save customization
      const saveCustomization = (newPrefs) => {
            setChatCustomization(newPrefs);
            if (user && user._id) {
                  localStorage.setItem(`zuno_chat_prefs_${user._id}`, JSON.stringify(newPrefs));
            }
      };

      const handleBgImageUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
                  alert('Background image must be less than 5MB');
                  return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                  saveCustomization({ ...chatCustomization, bgImage: reader.result });
            };
            reader.readAsDataURL(file);
      };

      // Typing Indicator
      const [isTyping, setIsTyping] = useState(false);
      const typingTimeoutRef = useRef(null);

      // Replies
      const [replyingTo, setReplyingTo] = useState(null);

      const isOnline = onlineUsers.some(id => id.toString() === userId?.toString());

      useEffect(() => {
            // Reset and load from cache immediately when userId changes
            setMessages([]);
            setOtherUser(() => {
                  try {
                        const cached = localStorage.getItem(`zuno_user_cache_${userId}`);
                        return cached ? JSON.parse(cached) : null;
                  } catch { return null; }
            });
            fetchMessages();
      }, [userId]);

      useEffect(() => {
            if (!socket) return;

            socket.on("newMessage", (newMessage) => {
                  const incomingSenderId = (newMessage.sender?._id || newMessage.sender || '').toString();
                  if (incomingSenderId === userId?.toString()) {
                        setMessages((prev) => [...prev, newMessage]);
                        // Mark as read and emit read event to sender
                        if (document.visibilityState === 'visible') {
                              fetch(`${API_URL}/messages/${userId}/read`, {
                                    method: 'PUT',
                                    headers: { 'Authorization': `Bearer ${token}` }
                              }).catch(console.error);
                              socket.emit("messageRead", { receiverId: userId });
                        }
                  }
            });

            socket.on("typing", (data) => {
                  if (data.senderId === userId) setIsTyping(true);
            });

            socket.on("stopTyping", (data) => {
                  if (data.senderId === userId) setIsTyping(false);
            });

            socket.on("messageRead", () => {
                  setMessages(prev => prev.map(m => (!m.read && m.receiver === userId) ? { ...m, read: true } : m));
            });

            socket.on("messageReaction", (data) => {
                  setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
            });

            return () => {
                  socket.off("newMessage");
                  socket.off("typing");
                  socket.off("stopTyping");
                  socket.off("messageRead");
                  socket.off("messageReaction");
            };
      }, [socket, userId, token]);

      useEffect(() => {
            scrollToBottom();
      }, [messages]);

      // Close menu/emoji on click outside
      useEffect(() => {
            const handleClickOutside = (e) => {
                  if (!e.target.closest('.emoji-picker-container')) setShowEmoji(false);
                  setActiveMenu(null);
            };
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
      }, []);

      const scrollToBottom = () => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      };

      const fetchMessages = async () => {
            setLoading(true);
            try {
                  const res = await fetch(`${API_URL}/messages/${userId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setMessages(data.data.messages);
                        setOtherUser(data.data.otherUser);
                        // Cache for instant loading next time
                        try {
                              sessionStorage.setItem(`zuno_chat_cache_${userId}`, JSON.stringify(data.data.messages.slice(-100))); // Store up to 100 messages
                              localStorage.setItem(`zuno_user_cache_${userId}`, JSON.stringify(data.data.otherUser));
                        } catch (e) {
                              console.warn('Cache quota exceeded');
                        }
                        // Once loaded, tell the other user we've read their stuff
                        socket?.emit("messageRead", { receiverId: userId });
                  } else {
                        throw new Error(data.message || 'Failed to load messages');
                  }
            } catch (err) {
                  console.error('Failed to fetch messages:', err);
                  // Load from cache if API fails
                  const cachedMsgs = sessionStorage.getItem(`zuno_chat_cache_${userId}`);
                  if (cachedMsgs) setMessages(JSON.parse(cachedMsgs));
                  const cachedUser = localStorage.getItem(`zuno_user_cache_${userId}`);
                  if (cachedUser) setOtherUser(JSON.parse(cachedUser));
            } finally {
                  setLoading(false);
            }
      };

      // Compress image before upload (max 800px, JPEG quality 0.6)
      const compressImage = (file) => {
            return new Promise((resolve) => {
                  // Skip compression for non-images
                  if (!file.type.startsWith('image')) {
                        resolve(file);
                        return;
                  }

                  const img = new Image();
                  const canvas = document.createElement('canvas');
                  const reader = new FileReader();

                  reader.onload = (e) => {
                        img.onload = () => {
                              let { width, height } = img;
                              const MAX = 800;

                              if (width > MAX || height > MAX) {
                                    if (width > height) {
                                          height = Math.round((height * MAX) / width);
                                          width = MAX;
                                    } else {
                                          width = Math.round((width * MAX) / height);
                                          height = MAX;
                                    }
                              }

                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext('2d');
                              ctx.drawImage(img, 0, 0, width, height);

                              canvas.toBlob(
                                    (blob) => {
                                          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                                                type: 'image/jpeg',
                                                lastModified: Date.now()
                                          });
                                          resolve(compressed);
                                    },
                                    'image/jpeg',
                                    0.6
                              );
                        };
                        img.src = e.target.result;
                  };
                  reader.readAsDataURL(file);
            });
      };

      const handleSend = async (e) => {
            e.preventDefault();
            if ((!newMessage.trim() && !mediaFile) || sending) return;

            const msgText = newMessage.trim();
            const currentMedia = mediaFile;
            const currentPreview = mediaPreview;
            const currentReplyTarget = replyingTo;

            // Optimistic UI — show message immediately with local preview
            const tempId = 'temp_' + Date.now();
            const optimisticMsg = {
                  _id: tempId,
                  sender: user?._id || user,
                  text: msgText,
                  media: currentPreview ? { url: currentPreview.url, type: currentPreview.type } : null,
                  replyTo: currentReplyTarget,
                  read: false,
                  edited: false,
                  createdAt: new Date().toISOString(),
                  _sending: true
            };

            setMessages(prev => [...prev, optimisticMsg]);
            setNewMessage('');
            setMediaFile(null);
            setMediaPreview(null);
            setReplyingTo(null);
            if (fileInputRef.current) fileInputRef.current.value = '';

            socket?.emit("stopTyping", { receiverId: userId });

            setSending(true);
            try {
                  let res;
                  if (currentMedia) {
                        // Compress image before uploading
                        const fileToSend = await compressImage(currentMedia);
                        const formData = new FormData();
                        formData.append('media', fileToSend);
                        if (msgText) formData.append('text', msgText);
                        if (currentReplyTarget) formData.append('replyTo', currentReplyTarget._id);

                        res = await fetch(`${API_URL}/messages/${userId}`, {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${token}` },
                              body: formData
                        });
                  } else {
                        const payload = { text: msgText };
                        if (currentReplyTarget) payload.replyTo = currentReplyTarget._id;

                        res = await fetch(`${API_URL}/messages/${userId}`, {
                              method: 'POST',
                              headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                              },
                              body: JSON.stringify(payload)
                        });
                  }
                  const data = await res.json();
                  if (data.success) {
                        // Replace optimistic message with real one
                        setMessages(prev => {
                              const updated = prev.map(m => m._id === tempId ? data.data.message : m);
                              // Async update storage to not block main thread
                              setTimeout(() => {
                                    try {
                                          sessionStorage.setItem(`zuno_chat_cache_${userId}`, JSON.stringify(updated.slice(-100)));
                                    } catch (e) { }
                              }, 0);
                              return updated;
                        });
                  } else {
                        // Remove failed message
                        setMessages(prev => prev.filter(m => m._id !== tempId));
                  }
            } catch (err) {
                  console.error('Failed to send message:', err);
                  // Mark as failed
                  setMessages(prev => prev.map(m => m._id === tempId ? { ...m, _failed: true, _sending: false } : m));
            }
            setSending(false);
      };

      const handleEdit = async (messageId) => {
            if (!editText.trim()) return;
            try {
                  const res = await fetch(`${API_URL}/messages/edit/${messageId}`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ text: editText.trim() })
                  });
                  const data = await res.json();
                  if (data.success) {
                        setMessages(prev => prev.map(m =>
                              m._id === messageId ? { ...m, text: editText.trim(), edited: true } : m
                        ));
                        setEditingId(null);
                        setEditText('');
                  } else {
                        alert(data.message);
                  }
            } catch (err) {
                  console.error('Failed to edit message:', err);
            }
      };

      const handleDelete = async (messageId) => {
            if (!window.confirm('Delete this message?')) return;
            try {
                  const res = await fetch(`${API_URL}/messages/delete/${messageId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setMessages(prev => prev.filter(m => m._id !== messageId));
                  }
            } catch (err) {
                  console.error('Failed to delete message:', err);
            }
      };

      const handleReact = async (messageId, emoji) => {
            try {
                  const res = await fetch(`${API_URL}/messages/react/${messageId}`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ emoji })
                  });
                  const data = await res.json();
                  if (data.success) {
                        setMessages(prev => prev.map(m => m._id === messageId ? data.data.message : m));
                        setActiveMenu(null);
                  }
            } catch (err) {
                  console.error('Failed to react:', err);
            }
      };

      const handleClearChat = async () => {
            if (!window.confirm('Are you sure you want to clear all messages in this chat? This cannot be undone.')) return;
            try {
                  const res = await fetch(`${API_URL}/messages/clear/${userId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setMessages([]);
                        setActiveMenu(null);
                  }
            } catch (err) {
                  console.error('Failed to clear chat:', err);
            }
      };

      const handleDownloadMedia = async (url, type) => {
            try {
                  const res = await fetch(url);
                  const blob = await res.blob();
                  const objectUrl = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = objectUrl;
                  const extension = type === 'video' ? 'mp4' : 'jpg';
                  a.download = `zuno_media_${Date.now()}.${extension}`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(objectUrl);
                  setActiveMenu(null);
            } catch (err) {
                  console.error('Failed to download media:', err);
                  // fallback
                  window.open(url, '_blank');
                  setActiveMenu(null);
            }
      };

      const startEditing = (msg) => {
            setEditingId(msg._id);
            setEditText(msg.text);
            setActiveMenu(null);
      };

      const toggleMenu = (e, messageId) => {
            e.stopPropagation();
            setActiveMenu(prev => prev === messageId ? null : messageId);
      };

      const handleEmojiClick = (emoji) => {
            // If the emojis are for reacting to a message directly vs adding to input
            setNewMessage(prev => prev + emoji);
      };

      const handleTyping = (e) => {
            setNewMessage(e.target.value);
            if (socket) {
                  socket.emit("typing", { receiverId: userId });
                  clearTimeout(typingTimeoutRef.current);
                  typingTimeoutRef.current = setTimeout(() => {
                        socket.emit("stopTyping", { receiverId: userId });
                  }, 2000);
            }
      };

      const handleMediaSelect = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 25 * 1024 * 1024) {
                  alert('File must be less than 25MB');
                  return;
            }

            // Show preview immediately (before compression)
            const reader = new FileReader();
            reader.onloadend = () => setMediaPreview({ url: reader.result, type: file.type.startsWith('video') ? 'video' : 'image' });
            reader.readAsDataURL(file);
            setMediaFile(file);
      };

      const cancelMedia = () => {
            setMediaFile(null);
            setMediaPreview(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
      };

      const formatTime = (dateStr) => {
            const date = new Date(dateStr);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      };

      const formatDateSeparator = (dateStr) => {
            const date = new Date(dateStr);
            const now = new Date();
            const diff = now - date;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            if (days === 0) return 'Today';
            if (days === 1) return 'Yesterday';
            return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
      };

      const shouldShowDateSeparator = (msg, index) => {
            if (index === 0) return true;
            const prev = new Date(messages[index - 1].createdAt).toDateString();
            const curr = new Date(msg.createdAt).toDateString();
            return prev !== curr;
      };

      return (
            <div className="chat-page">
                  {/* Chat Header */}
                  <div className="chat-header">
                        <button onClick={() => navigate('/messages')} className="chat-back-btn">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                              </svg>
                        </button>
                        <Link to={`/u/${otherUser?.username}`} className="chat-user-info" style={{ flex: 1 }}>
                              <div className="msg-avatar msg-avatar-sm">
                                    {otherUser?.avatar ? (
                                          <img src={otherUser.avatar} alt={otherUser.displayName} />
                                    ) : (
                                          <span>{otherUser?.displayName?.charAt(0) || otherUser?.username?.charAt(0) || 'U'}</span>
                                    )}
                              </div>
                              <div>
                                    <div className="font-semibold">{otherUser?.displayName || otherUser?.username || 'Loading...'}</div>
                                    <div className="text-xs text-muted">
                                          {isTyping ? (
                                                <span style={{ color: 'var(--color-primary)' }}>typing...</span>
                                          ) : (
                                                <>
                                                      @{otherUser?.username || '...'}
                                                      {isOnline ? (
                                                            <span className="ml-2" style={{ color: '#10b981', marginLeft: '8px' }}>• Online</span>
                                                      ) : (
                                                            <span className="ml-2" style={{ opacity: 0.6, marginLeft: '8px' }}>• Offline</span>
                                                      )}
                                                </>
                                          )}
                                    </div>
                              </div>
                        </Link>
                        {/* Call Buttons */}
                        <div className="chat-call-buttons">
                              <button className="chat-call-btn" onClick={() => startCall(userId, 'voice', otherUser)} title="Voice Call" disabled={isCalling || callAccepted}>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                    </svg>
                              </button>
                              <button className="chat-call-btn" onClick={() => startCall(userId, 'video', otherUser)} title="Video Call" disabled={isCalling || callAccepted}>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                                    </svg>
                              </button>

                              {/* Header Menu (Clear Chat / Customize) */}
                              <div style={{ position: 'relative' }}>
                                    <button
                                          className="chat-call-btn"
                                          onClick={(e) => toggleMenu(e, 'header-menu')}
                                          title="More Options"
                                          style={{ marginLeft: '4px' }}
                                    >
                                          ⋮
                                    </button>

                                    {activeMenu === 'header-menu' && (
                                          <div className="chat-msg-menu" style={{ right: 0, top: '100%', minWidth: '150px' }} onClick={(e) => e.stopPropagation()}>
                                                <button
                                                      onClick={() => { setActiveMenu(null); setShowCustomizeModal(true); }}
                                                      className="chat-msg-menu-item"
                                                >
                                                      🎨 Customize Chat
                                                </button>
                                                <button
                                                      onClick={() => { setActiveMenu(null); handleClearChat(); }}
                                                      className="chat-msg-menu-item delete"
                                                >
                                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z" /></svg>
                                                      Clear Chat
                                                </button>
                                          </div>
                                    )}
                              </div>
                        </div>
                  </div>

                  {/* Messages Area */}
                  <div className="chat-messages" style={
                        chatCustomization.bgImage ? {
                              backgroundImage: `url(${chatCustomization.bgImage})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundAttachment: 'fixed'
                        } : {}
                  }>
                        {loading ? (
                              <div className="empty-state">
                                    <span className="spinner"></span>
                              </div>
                        ) : messages.length > 0 ? (
                              messages.map((msg, index) => {
                                    const isMine = msg.sender?._id === user?._id || msg.sender === user?._id;
                                    const isCallLog = msg.text?.startsWith('📞') || msg.text?.startsWith('📹') || msg.text?.startsWith('❌ Missed');

                                    if (isCallLog) {
                                          return (
                                                <div key={msg._id} style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
                                                      {shouldShowDateSeparator(msg, index) && (
                                                            <div className="chat-date-separator" style={{ position: 'absolute', top: '-30px' }}>
                                                                  <span>{formatDateSeparator(msg.createdAt)}</span>
                                                            </div>
                                                      )}
                                                      <div style={{
                                                            background: 'var(--bg-secondary)',
                                                            padding: '8px 16px',
                                                            borderRadius: '16px',
                                                            fontSize: '0.85rem',
                                                            color: 'var(--text-secondary)',
                                                            border: '1px solid var(--border-color)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px'
                                                      }}>
                                                            <span>{msg.text}</span>
                                                            <span style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: '4px' }}>{formatTime(msg.createdAt)}</span>
                                                      </div>
                                                </div>
                                          )
                                    }

                                    return (
                                          <div key={msg._id}>
                                                {shouldShowDateSeparator(msg, index) && (
                                                      <div className="chat-date-separator">
                                                            <span>{formatDateSeparator(msg.createdAt)}</span>
                                                      </div>
                                                )}
                                                <div className={`chat-bubble-wrapper ${isMine ? 'sent' : 'received'}`}>
                                                      <div
                                                            className={`chat-bubble ${isMine ? 'sent' : 'received'}`}
                                                            style={{
                                                                  position: 'relative',
                                                                  ...(isMine && chatCustomization.themeColor !== '#6366f1' ? {
                                                                        background: chatCustomization.themeColor,
                                                                        borderColor: chatCustomization.themeColor
                                                                  } : {})
                                                            }}
                                                      >

                                                            {/* Edit Mode */}
                                                            {editingId === msg._id ? (
                                                                  <div className="chat-edit-form">
                                                                        <input
                                                                              type="text"
                                                                              value={editText}
                                                                              onChange={(e) => setEditText(e.target.value)}
                                                                              className="chat-edit-input"
                                                                              autoFocus
                                                                              maxLength={2000}
                                                                              onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') handleEdit(msg._id);
                                                                                    if (e.key === 'Escape') { setEditingId(null); setEditText(''); }
                                                                              }}
                                                                        />
                                                                        <div className="chat-edit-actions">
                                                                              <button onClick={() => handleEdit(msg._id)} className="chat-edit-save">✓</button>
                                                                              <button onClick={() => { setEditingId(null); setEditText(''); }} className="chat-edit-cancel">✕</button>
                                                                        </div>
                                                                  </div>
                                                            ) : (
                                                                  <>
                                                                        {/* Replied Message Quote */}
                                                                        {msg.replyTo && (
                                                                              <div className="chat-reply-quote">
                                                                                    <div className="chat-reply-quote-sender" style={{ fontWeight: 'bold', fontSize: '0.8rem', color: isMine ? '#e0e7ff' : '#4f46e5' }}>
                                                                                          {msg.replyTo.sender?.displayName || msg.replyTo.sender?.username || 'User'}
                                                                                    </div>
                                                                                    <div className="chat-reply-quote-text" style={{ fontSize: '0.85rem', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                          {msg.replyTo.text || 'Embedded Media'}
                                                                                    </div>
                                                                              </div>
                                                                        )}

                                                                        {/* Media content */}
                                                                        {msg.media?.url && (
                                                                              <div className="chat-media">
                                                                                    {msg.media.type === 'video' ? (
                                                                                          <video src={msg.media.url} controls className="chat-media-content" />
                                                                                    ) : (
                                                                                          <img src={msg.media.url} alt="Shared media" className="chat-media-content" onClick={() => window.open(msg.media.url, '_blank')} />
                                                                                    )}
                                                                              </div>
                                                                        )}
                                                                        {msg.text && <p className="chat-bubble-text">{msg.text}</p>}
                                                                        <div className="chat-bubble-meta">
                                                                              {msg.edited && <span className="chat-edited-label">edited</span>}
                                                                              <span className="chat-bubble-time">{formatTime(msg.createdAt)}</span>
                                                                              {isMine && (
                                                                                    <span className={`chat-bubble-status ${msg.read ? 'read' : ''}`} style={(msg.read && !msg._sending) ? { color: '#3b82f6' } : {}}>
                                                                                          {msg._sending ? <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>🕒</span> : (msg.read ? '✓✓' : '✓')}
                                                                                    </span>
                                                                              )}
                                                                        </div>

                                                                        {/* Reactions */}
                                                                        {msg.reactions && msg.reactions.length > 0 && (
                                                                              <div className="chat-bubble-reactions" style={{ display: 'flex', gap: '2px', position: 'absolute', bottom: '-12px', right: isMine ? '0' : 'auto', left: isMine ? 'auto' : '0', background: 'var(--bg-card)', padding: '2px 4px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                                                                                    {msg.reactions.map((r, i) => (
                                                                                          <span key={i} title={r.user?.username || 'User'}>{r.emoji}</span>
                                                                                    ))}
                                                                              </div>
                                                                        )}
                                                                  </>
                                                            )}

                                                            {/* Three-dot menu for ALL messages (own = edit+delete, received = delete only) */}
                                                            {editingId !== msg._id && (
                                                                  <button
                                                                        className="chat-msg-menu-btn"
                                                                        onClick={(e) => toggleMenu(e, msg._id)}
                                                                        title="Message options"
                                                                  >
                                                                        ⋮
                                                                  </button>
                                                            )}

                                                            {/* Context Menu */}
                                                            {activeMenu === msg._id && (
                                                                  <div className="chat-msg-menu" onClick={(e) => e.stopPropagation()}>
                                                                        <div className="chat-msg-menu-reactions" style={{ display: 'flex', gap: '8px', padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
                                                                              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                                                                    <button key={emoji} onClick={() => handleReact(msg._id, emoji)} style={{ fontSize: '1.2rem', background: 'none', border: 'none', cursor: 'pointer' }}>{emoji}</button>
                                                                              ))}
                                                                        </div>
                                                                        <button onClick={() => { setReplyingTo(msg); setActiveMenu(null); }} className="chat-msg-menu-item">
                                                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" /></svg>
                                                                              Reply
                                                                        </button>
                                                                        {msg.text && (
                                                                              <button onClick={() => { navigator.clipboard?.writeText(msg.text).catch(() => { }); setActiveMenu(null); }} className="chat-msg-menu-item">
                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" /></svg>
                                                                                    Copy
                                                                              </button>
                                                                        )}
                                                                        {msg.media?.url && (
                                                                              <button
                                                                                    onClick={() => handleDownloadMedia(msg.media.url, msg.media.type)}
                                                                                    className="chat-msg-menu-item"
                                                                              >
                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>
                                                                                    Download
                                                                              </button>
                                                                        )}
                                                                        {isMine && (
                                                                              <button onClick={() => startEditing(msg)} className="chat-msg-menu-item">
                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                                                                                    Edit
                                                                              </button>
                                                                        )}
                                                                        <button
                                                                              onClick={() => { setActiveMenu(null); handleDelete(msg._id); }}
                                                                              className="chat-msg-menu-item delete"
                                                                        >
                                                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                                                                              Delete
                                                                        </button>
                                                                  </div>
                                                            )}
                                                      </div>
                                                </div>
                                          </div>
                                    );
                              })
                        ) : (
                              <div className="empty-state" style={{ padding: '3rem 1rem' }}>
                                    <div className="empty-state-icon">👋</div>
                                    <h3 className="text-lg font-semibold mb-sm">Start a conversation</h3>
                                    <p className="text-muted">
                                          Say hello to {otherUser?.displayName || otherUser?.username || 'this user'}!
                                    </p>
                              </div>
                        )}
                        <div ref={messagesEndRef} />
                  </div>

                  {/* Media Preview */}
                  {mediaPreview && (
                        <div className="chat-media-preview">
                              <div className="chat-media-preview-inner">
                                    {mediaPreview.type === 'video' ? (
                                          <video src={mediaPreview.url} className="chat-media-preview-thumb" muted />
                                    ) : (
                                          <img src={mediaPreview.url} alt="Preview" className="chat-media-preview-thumb" />
                                    )}
                                    <span className="text-sm">{mediaFile?.name}</span>
                                    <button onClick={cancelMedia} className="chat-media-preview-close">✕</button>
                              </div>
                        </div>
                  )}

                  {/* Emoji Picker */}
                  {showEmoji && (
                        <div className="emoji-picker" onClick={(e) => e.stopPropagation()}>
                              <div className="emoji-grid">
                                    {Object.values(EMOJI_DATA).flat().map((emoji, i) => (
                                          <button key={i} className="emoji-btn" onClick={() => handleEmojiClick(emoji)}>
                                                {emoji}
                                          </button>
                                    ))}
                              </div>
                        </div>
                  )}

                  {/* Reply Preview */}
                  {replyingTo && (
                        <div className="chat-reply-preview" style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderLeft: '4px solid var(--color-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div className="chat-reply-preview-inner" style={{ overflow: 'hidden' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                                          Replying to {replyingTo.sender?.displayName || replyingTo.sender?.username || 'User'}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {replyingTo.text || 'Media'}
                                    </div>
                              </div>
                              <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
                        </div>
                  )}

                  {/* Message Input */}
                  <form className="chat-input-area" onSubmit={handleSend} style={{ zIndex: 10 }}>
                        <div className="chat-input-actions">
                              {/* Emoji Button */}
                              <div className="emoji-picker-container" onClick={(e) => e.stopPropagation()}>
                                    <button type="button" className="chat-action-btn" onClick={() => setShowEmoji(!showEmoji)} title="Emojis">
                                          😊
                                    </button>
                              </div>
                              {/* Media Button */}
                              <button type="button" className="chat-action-btn" onClick={() => fileInputRef.current?.click()} title="Send Photo/Video">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                                    </svg>
                              </button>
                              <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,video/*"
                                    onChange={handleMediaSelect}
                                    style={{ display: 'none' }}
                              />
                        </div>
                        <input
                              type="text"
                              className="chat-input"
                              placeholder="Type a message..."
                              value={newMessage}
                              onChange={handleTyping}
                              maxLength={2000}
                        />
                        <button
                              type="submit"
                              className="chat-send-btn"
                              disabled={(!newMessage.trim() && !mediaFile) || sending}
                        >
                              {sending ? (
                                    <span className="spinner" style={{ width: '20px', height: '20px' }}></span>
                              ) : (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                    </svg>
                              )}
                        </button>
                  </form>

                  {/* Customize Chat Modal */}
                  {
                        showCustomizeModal && (
                              <div className="modal-overlay" onClick={() => setShowCustomizeModal(false)} style={{ zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                                    <div className="card modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto' }}>
                                          <div className="flex items-center justify-between mb-lg">
                                                <h3 className="text-lg font-bold">🎨 Customize Chat</h3>
                                                <button onClick={() => setShowCustomizeModal(false)} className="btn btn-ghost" style={{ padding: '4px 8px' }}>✕</button>
                                          </div>

                                          <div className="mb-lg">
                                                <h4 className="font-semibold mb-sm">Theme Color</h4>
                                                <div className="flex gap-sm flex-wrap">
                                                      {THEMES.map(theme => (
                                                            <div
                                                                  key={theme.id}
                                                                  onClick={() => saveCustomization({ ...chatCustomization, themeColor: theme.color })}
                                                                  style={{
                                                                        width: '36px', height: '36px',
                                                                        borderRadius: '50%',
                                                                        backgroundColor: theme.color,
                                                                        cursor: 'pointer',
                                                                        border: chatCustomization.themeColor === theme.color ? '3px solid white' : 'none',
                                                                        outline: chatCustomization.themeColor === theme.color ? `2px solid ${theme.color}` : 'none',
                                                                        boxShadow: 'var(--shadow-sm)'
                                                                  }}
                                                            />
                                                      ))}
                                                </div>
                                          </div>

                                          <div className="mb-lg">
                                                <h4 className="font-semibold mb-sm">Background Image</h4>
                                                {chatCustomization.bgImage ? (
                                                      <div style={{ position: 'relative', height: '150px', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '8px' }}>
                                                            <img src={chatCustomization.bgImage} alt="Background Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            <button
                                                                  onClick={() => saveCustomization({ ...chatCustomization, bgImage: null })}
                                                                  style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                            >✕</button>
                                                      </div>
                                                ) : (
                                                      <div
                                                            style={{ height: '100px', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--bg-secondary)' }}
                                                            onClick={() => document.getElementById('chat-bg-upload').click()}
                                                      >
                                                            <span className="text-muted">+ Add Wallpaper</span>
                                                      </div>
                                                )}
                                                <input type="file" id="chat-bg-upload" accept="image/*" style={{ display: 'none' }} onChange={handleBgImageUpload} />
                                          </div>

                                          <div className="flex mt-xl">
                                                <button
                                                      onClick={() => {
                                                            saveCustomization(defaultCustomization);
                                                      }}
                                                      className="btn btn-ghost text-red-500" style={{ flex: 1 }}
                                                >
                                                      Reset to Default
                                                </button>
                                                <button onClick={() => setShowCustomizeModal(false)} className="btn btn-primary" style={{ flex: 1 }}>Done</button>
                                          </div>
                                    </div>
                              </div>
                        )
                  }
            </div>
      );
};

export default Chat;
