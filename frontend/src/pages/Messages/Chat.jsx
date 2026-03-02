import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

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

      // Edit & Delete states
      const [activeMenu, setActiveMenu] = useState(null); // messageId of active context menu
      const [editingId, setEditingId] = useState(null);
      const [editText, setEditText] = useState('');

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

      // Close menu on click outside
      useEffect(() => {
            const handleClickOutside = () => setActiveMenu(null);
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
            if (!newMessage.trim() || sending) return;

            setSending(true);
            try {
                  const res = await fetch(`${API_URL}/messages/${userId}`, {
                        method: 'POST',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ text: newMessage.trim() })
                  });
                  const data = await res.json();
                  if (data.success) {
                        setMessages(prev => [...prev, data.data.message]);
                        setNewMessage('');
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

      // Check if message can be edited (within 15 minutes)
      const canEdit = (msg) => {
            const fifteenMin = 15 * 60 * 1000;
            return Date.now() - new Date(msg.createdAt).getTime() < fifteenMin;
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
                        <Link to={`/u/${otherUser?.username}`} className="chat-user-info">
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
                                                                        <p className="chat-bubble-text">{msg.text}</p>
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

                                                            {/* Three-dot menu for own messages (only if not editing) */}
                                                            {isMine && editingId !== msg._id && (
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
                                                                        {canEdit(msg) && (
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

                  {/* Message Input */}
                  <form className="chat-input-area" onSubmit={handleSend}>
                        <input
                              type="text"
                              className="chat-input"
                              placeholder="Type a message..."
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              maxLength={2000}
                              autoFocus
                        />
                        <button
                              type="submit"
                              className="chat-send-btn"
                              disabled={!newMessage.trim() || sending}
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
            </div>
      );
};

export default Chat;
