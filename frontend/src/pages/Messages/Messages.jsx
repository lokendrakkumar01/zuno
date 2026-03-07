import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import { API_URL } from '../../config';

const Messages = () => {
      const { token, isAuthenticated, user } = useAuth();
      const { onlineUsers } = useSocketContext();
      const navigate = useNavigate();
      const [conversations, setConversations] = useState(() => {
            try {
                  const cached = localStorage.getItem(`zuno_conversations_cache_${user?._id}`);
                  return cached ? JSON.parse(cached) : [];
            } catch {
                  return [];
            }
      });
      // loading is false if we have a cache
      const [loading, setLoading] = useState(!localStorage.getItem(`zuno_conversations_cache_${user?._id}`));
      const [searchQuery, setSearchQuery] = useState('');
      const [searchResults, setSearchResults] = useState([]);
      const [searching, setSearching] = useState(false);

      const { socket } = useSocketContext();

      useEffect(() => {
            if (isAuthenticated) {
                  fetchConversations();
            }
      }, [isAuthenticated]);

      // Reset search when navigating back to this page
      useEffect(() => {
            setSearchQuery('');
            setSearchResults([]);
      }, []);

      // Socket listener for real-time updates
      useEffect(() => {
            if (socket) {
                  const handleUpdate = () => {
                        fetchConversations();
                  };
                  socket.on('newMessage', handleUpdate);
                  socket.on('messageRead', handleUpdate);
                  return () => {
                        socket.off('newMessage', handleUpdate);
                        socket.off('messageRead', handleUpdate);
                  };
            }
      }, [socket]);

      const fetchConversations = async () => {
            if (conversations.length === 0) setLoading(true);
            try {
                  const res = await fetch(`${API_URL}/messages/conversations`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setConversations(data.data.conversations);
                        try {
                              localStorage.setItem(`zuno_conversations_cache_${user?._id}`, JSON.stringify(data.data.conversations));
                        } catch (e) { }
                  }
            } catch (err) {
                  console.error('Failed to fetch conversations:', err);
            }
            setLoading(false);
      };

      const handleSearch = (query) => {
            setSearchQuery(query);
      };

      useEffect(() => {
            const timer = setTimeout(() => {
                  if (!searchQuery.trim() || searchQuery.trim().length < 2) {
                        setSearchResults([]);
                        setSearching(false);
                        return;
                  }

                  const performSearch = async () => {
                        setSearching(true);
                        try {
                              const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(searchQuery)}`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                              });
                              const data = await res.json();
                              if (data.success) {
                                    setSearchResults(data.data.users.filter(u => u._id !== user?._id));
                              }
                        } catch (err) {
                              console.error('Search failed:', err);
                        }
                        setSearching(false);
                  };

                  performSearch();
            }, 200); // Instagram speed (200ms)

            return () => clearTimeout(timer);
      }, [searchQuery, token, user?._id]);

      const formatTime = (dateStr) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            const now = new Date();
            const diff = now - date;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));

            if (days === 0) {
                  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (days === 1) {
                  return 'Yesterday';
            } else if (days < 7) {
                  return date.toLocaleDateString([], { weekday: 'short' });
            }
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      };

      if (!isAuthenticated) {
            return (
                  <div className="empty-state animate-fadeIn">
                        <div className="empty-state-icon">🔒</div>
                        <h2 className="text-xl font-semibold mb-md">Login to Message</h2>
                        <p className="text-muted mb-lg">You need to be logged in to send messages.</p>
                        <button onClick={() => navigate('/login')} className="btn btn-primary">
                              Login
                        </button>
                  </div>
            );
      }

      return (
            <div className="messages-page animate-fadeIn">
                  <div className="messages-header">
                        <h1 className="text-2xl font-bold">💬 Messages</h1>
                  </div>

                  {/* Search Users */}
                  <div className="messages-search">
                        <div className="input-group" style={{ marginBottom: 0 }}>
                              <input
                                    type="text"
                                    className="input"
                                    placeholder="🔍 Search users to message..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                              />
                        </div>

                        {/* Search Results */}
                        {searchQuery && (
                              <div className="search-results-dropdown">
                                    {searching && searchResults.length === 0 ? (
                                          <div className="search-result-item" style={{ justifyContent: 'center' }}>
                                                <span className="spinner" style={{ width: '20px', height: '20px' }}></span>
                                                <span style={{ marginLeft: '10px', color: 'var(--text-muted)' }}>Searching...</span>
                                          </div>
                                    ) : searchQuery.trim().length < 2 ? (
                                          <div className="search-result-item" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
                                                Type at least 2 characters to search...
                                          </div>
                                    ) : searchResults.length > 0 ? (
                                          <div style={{ opacity: searching ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
                                                {searchResults.map(u => (
                                                      <Link
                                                            key={u._id}
                                                            to={`/messages/${u._id}`}
                                                            className="search-result-item"
                                                            onClick={() => setSearchQuery('')}
                                                      >
                                                            <div className="msg-avatar">
                                                                  {u.avatar ? (
                                                                        <img src={u.avatar} alt={u.displayName} />
                                                                  ) : (
                                                                        <span>{u.displayName?.charAt(0) || u.username?.charAt(0) || 'U'}</span>
                                                                  )}
                                                            </div>
                                                            <div>
                                                                  <div className="font-semibold">{u.displayName || u.username}</div>
                                                                  <div className="text-sm text-muted">@{u.username}</div>
                                                            </div>
                                                      </Link>
                                                ))}
                                          </div>
                                    ) : (
                                          <div className="search-result-item" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
                                                No users found for "{searchQuery}"
                                          </div>
                                    )}
                              </div>
                        )}
                  </div>

                  {/* Conversations List */}
                  <div className="conversations-list">
                        {loading ? (
                              <div className="empty-state">
                                    <span className="spinner"></span>
                              </div>
                        ) : conversations.length > 0 ? (
                              conversations.map(conv => (
                                    <Link
                                          key={conv._id}
                                          to={`/messages/${conv.user?._id}`}
                                          className={`conversation-item ${conv.unreadCount > 0 ? 'unread' : ''}`}
                                    >
                                          <div className="msg-avatar" style={{ position: 'relative' }}>
                                                {conv.user?.avatar ? (
                                                      <img src={conv.user.avatar} alt={conv.user.displayName} />
                                                ) : (
                                                      <span>
                                                            {conv.user?.displayName?.charAt(0) || conv.user?.username?.charAt(0) || 'U'}
                                                      </span>
                                                )}
                                                {onlineUsers.some(id => id.toString() === conv.user?._id?.toString()) && (
                                                      <span style={{
                                                            position: 'absolute',
                                                            bottom: '0px',
                                                            right: '0px',
                                                            width: '12px',
                                                            height: '12px',
                                                            backgroundColor: '#10b981',
                                                            borderRadius: '50%',
                                                            border: '2px solid white'
                                                      }}></span>
                                                )}
                                          </div>
                                          <div className="conversation-info">
                                                <div className="conversation-top">
                                                      <span className="conversation-name">
                                                            {conv.user?.displayName || conv.user?.username || 'Unknown'}
                                                      </span>
                                                      <span className="conversation-time">
                                                            {formatTime(conv.lastMessage?.createdAt)}
                                                      </span>
                                                </div>
                                                <div className="conversation-bottom">
                                                      <span className="conversation-preview">
                                                            {(conv.lastMessage?.sender?._id || conv.lastMessage?.sender)?.toString() === user?._id
                                                                  ? `You: ${conv.lastMessage?.text || '📎 Media'}`
                                                                  : conv.lastMessage?.text || '📎 Media'
                                                            }
                                                      </span>
                                                      {conv.unreadCount > 0 && (
                                                            <span className="unread-badge">{conv.unreadCount}</span>
                                                      )}
                                                </div>
                                          </div>
                                    </Link>
                              ))
                        ) : (
                              <div className="empty-state">
                                    <div className="empty-state-icon">💬</div>
                                    <h3 className="text-lg font-semibold mb-sm">No messages yet</h3>
                                    <p className="text-muted">Search for users above to start a conversation!</p>
                              </div>
                        )}
                  </div>
            </div>
      );
};

export default Messages;
