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

      useEffect(() => {
            fetchMessages();

            // Poll for new messages every 5 seconds
            pollRef.current = setInterval(fetchMessages, 5000);

            return () => {
                  if (pollRef.current) clearInterval(pollRef.current);
            };
      }, [userId]);

      useEffect(() => {
            scrollToBottom();
      }, [messages]);

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
                                                      <div className={`chat-bubble ${isMine ? 'sent' : 'received'}`}>
                                                            <p className="chat-bubble-text">{msg.text}</p>
                                                            <div className="chat-bubble-meta">
                                                                  <span className="chat-bubble-time">{formatTime(msg.createdAt)}</span>
                                                                  {isMine && (
                                                                        <span className="chat-bubble-status">
                                                                              {msg.read ? '✓✓' : '✓'}
                                                                        </span>
                                                                  )}
                                                            </div>
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
