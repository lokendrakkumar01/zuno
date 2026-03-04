import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

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
      const navigate = useNavigate();
      const [messages, setMessages] = useState([]);
      const [otherUser, setOtherUser] = useState(null);
      const [newMessage, setNewMessage] = useState('');
      const [loading, setLoading] = useState(true);
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

      // Call modal
      const [showCallModal, setShowCallModal] = useState(null); // 'voice' or 'video'

      useEffect(() => {
            fetchMessages();
            pollRef.current = setInterval(fetchMessages, 5000);
            return () => {
                  if (pollRef.current) clearInterval(pollRef.current);
            };
      }, [userId]);

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
            try {
                  const res = await fetch(`${API_URL}/messages/${userId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setMessages(data.data.messages);
                        setOtherUser(data.data.otherUser);
                  }
            } catch (err) {
                  console.error('Failed to fetch messages:', err);
            }
            setLoading(false);
      };

      const handleSend = async (e) => {
            e.preventDefault();
            if ((!newMessage.trim() && !mediaFile) || sending) return;

            setSending(true);
            try {
                  let res;
                  if (mediaFile) {
                        // Send with media file
                        const formData = new FormData();
                        formData.append('media', mediaFile);
                        if (newMessage.trim()) formData.append('text', newMessage.trim());

                        res = await fetch(`${API_URL}/messages/${userId}`, {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${token}` },
                              body: formData
                        });
                  } else {
                        // Text only
                        res = await fetch(`${API_URL}/messages/${userId}`, {
                              method: 'POST',
                              headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                              },
                              body: JSON.stringify({ text: newMessage.trim() })
                        });
                  }
                  const data = await res.json();
                  if (data.success) {
                        setMessages(prev => [...prev, data.data.message]);
                        setNewMessage('');
                        setMediaFile(null);
                        setMediaPreview(null);
                  }
            } catch (err) {
                  console.error('Failed to send message:', err);
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
            setNewMessage(prev => prev + emoji);
      };

      const handleMediaSelect = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 25 * 1024 * 1024) {
                  alert('File must be less than 25MB');
                  return;
            }

            setMediaFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setMediaPreview({ url: reader.result, type: file.type.startsWith('video') ? 'video' : 'image' });
            reader.readAsDataURL(file);
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
                                    <div className="text-xs text-muted">@{otherUser?.username || '...'}</div>
                              </div>
                        </Link>
                        {/* Call Buttons */}
                        <div className="chat-call-buttons">
                              <button className="chat-call-btn" onClick={() => setShowCallModal('voice')} title="Voice Call">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                    </svg>
                              </button>
                              <button className="chat-call-btn" onClick={() => setShowCallModal('video')} title="Video Call">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                                    </svg>
                              </button>
                        </div>
                  </div>

                  {/* Messages Area */}
                  <div className="chat-messages">
                        {loading ? (
                              <div className="empty-state">
                                    <span className="spinner"></span>
                              </div>
                        ) : messages.length > 0 ? (
                              messages.map((msg, index) => {
                                    const isMine = msg.sender?._id === user?._id || msg.sender === user?._id;

                                    return (
                                          <div key={msg._id}>
                                                {shouldShowDateSeparator(msg, index) && (
                                                      <div className="chat-date-separator">
                                                            <span>{formatDateSeparator(msg.createdAt)}</span>
                                                      </div>
                                                )}
                                                <div className={`chat-bubble-wrapper ${isMine ? 'sent' : 'received'}`}>
                                                      <div className={`chat-bubble ${isMine ? 'sent' : 'received'}`} style={{ position: 'relative' }}>

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
                                                                                    <span className="chat-bubble-status">
                                                                                          {msg.read ? '✓✓' : '✓'}
                                                                                    </span>
                                                                              )}
                                                                        </div>
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

                  {/* Message Input */}
                  <form className="chat-input-area" onSubmit={handleSend}>
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
                              onChange={(e) => setNewMessage(e.target.value)}
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

                  {/* Call Coming Soon Modal */}
                  {showCallModal && (
                        <div className="chat-call-modal-overlay" onClick={() => setShowCallModal(null)}>
                              <div className="chat-call-modal" onClick={(e) => e.stopPropagation()}>
                                    <div className="chat-call-modal-icon">
                                          {showCallModal === 'video' ? '📹' : '📞'}
                                    </div>
                                    <h3 className="text-lg font-bold mb-sm">
                                          {showCallModal === 'video' ? 'Video Call' : 'Voice Call'}
                                    </h3>
                                    <p className="text-muted text-sm mb-lg">
                                          {showCallModal === 'video' ? 'Video' : 'Voice'} calling feature is coming soon! Stay tuned for updates.
                                    </p>
                                    <button onClick={() => setShowCallModal(null)} className="btn btn-primary" style={{ width: '100%' }}>
                                          OK, Got it!
                                    </button>
                              </div>
                        </div>
                  )}
            </div>
      );
};

export default Chat;
