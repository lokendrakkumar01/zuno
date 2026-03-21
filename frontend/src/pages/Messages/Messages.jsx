import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import { API_URL } from '../../config';
import UserAvatar from '../../components/User/UserAvatar';

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
      const [silentRefreshing, setSilentRefreshing] = useState(false);
      
      const [showCreateGroup, setShowCreateGroup] = useState(false);
      const [newGroupName, setNewGroupName] = useState('');
      const [isChannel, setIsChannel] = useState(false);
      const [selectedUsers, setSelectedUsers] = useState([]);
      const [groupSearchQuery, setGroupSearchQuery] = useState('');
      const [groupSearchResults, setGroupSearchResults] = useState([]);

      // Notes State
      const [notes, setNotes] = useState([]);
      const [showNoteModal, setShowNoteModal] = useState(false);
      const [noteText, setNoteText] = useState('');
      const [viewingNote, setViewingNote] = useState(null);

      const { socket } = useSocketContext();

      // Debounced refetch — prevents excessive API calls on rapid socket events
      const refetchTimerRef = useRef(null);
      const debouncedRefetch = useCallback(() => {
            if (refetchTimerRef.current) return; // Already scheduled
            refetchTimerRef.current = setTimeout(() => {
                  refetchTimerRef.current = null;
                  fetchConversations();
            }, 2000); // Max once every 2 seconds
      }, [token, user?._id]);

      // Cleanup timer on unmount
      useEffect(() => {
            return () => {
                  if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
            };
      }, []);

      // Initial data fetch
      useEffect(() => {
            if (isAuthenticated) {
                  fetchConversations();
                  fetchNotes();
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
                  // On new message: debounced refetch to avoid excessive API calls
                  const handleNewMessage = (newMsg) => {
                        // Optimistic: move conversation to top immediately
                        setConversations(prev => {
                              const updated = [...prev];
                              const idx = updated.findIndex(c => {
                                    const senderId = newMsg.sender?._id || newMsg.sender;
                                    const receiverId = newMsg.receiver?._id || newMsg.receiver;
                                    return c.user?._id === senderId || c.user?._id === receiverId;
                              });
                              if (idx > 0) {
                                    const [conv] = updated.splice(idx, 1);
                                    conv.lastMessage = newMsg;
                                    if (conv.user?._id !== user?._id) {
                                          conv.unreadCount = (conv.unreadCount || 0) + 1;
                                    }
                                    updated.unshift(conv);
                              }
                              return updated;
                        });
                        // Still refetch in background to stay accurate (debounced)
                        debouncedRefetch();
                  };
                  
                  const handleNewGroupMessage = () => debouncedRefetch();
                  const handleRead = () => debouncedRefetch();

                  socket.on('newMessage', handleNewMessage);
                  socket.on('newGroupMessage', handleNewGroupMessage);
                  socket.on('messageRead', handleRead);
                  return () => {
                        socket.off('newMessage', handleNewMessage);
                        socket.off('newGroupMessage', handleNewGroupMessage);
                        socket.off('messageRead', handleRead);
                  };
            }
      }, [socket, user?._id, debouncedRefetch]);

      const fetchConversations = async () => {
            let hasCached = conversations.length > 0;
            if (!hasCached) setLoading(true);
            else setSilentRefreshing(true);

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
            } finally {
                  setLoading(false);
                  setSilentRefreshing(false);
            }
      };

      const fetchNotes = async () => {
            try {
                  const res = await fetch(`${API_URL}/notes`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setNotes(data.data.notes);
                  }
            } catch (err) {
                  console.error('Failed to fetch notes:', err);
            }
      };

      const handleAddNote = async () => {
            if (!noteText.trim()) return;
            try {
                  const res = await fetch(`${API_URL}/notes`, {
                        method: 'POST',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ text: noteText })
                  });
                  const data = await res.json();
                  if (data.success) {
                        setNoteText('');
                        setShowNoteModal(false);
                        fetchNotes();
                  }
            } catch (err) {
                  console.error('Failed to add note:', err);
            }
      };

      const handleDeleteNote = async (noteId) => {
            try {
                  const res = await fetch(`${API_URL}/notes/${noteId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  if (res.ok) {
                        setViewingNote(null);
                        fetchNotes();
                  }
            } catch (err) {
                  console.error('Failed to delete note', err);
            }
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

                        // 1. Search local conversations immediately
                        const lowerQuery = searchQuery.toLowerCase();
                        const localMatches = conversations
                              .filter(conv => conv.user && (
                                    (conv.user.displayName && conv.user.displayName.toLowerCase().includes(lowerQuery)) ||
                                    (conv.user.username && conv.user.username.toLowerCase().includes(lowerQuery))
                              ))
                              .map(conv => conv.user);

                        // Show local matches immediately so the user sees results right away
                        setSearchResults(localMatches);

                        try {
                              const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(searchQuery)}`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                              });
                              const data = await res.json();
                              if (data.success) {
                                    const globalUsers = data.data.users.filter(u => u._id !== user?._id);

                                    // 2. Merge local matches with global results, avoiding duplicates
                                    const localIds = new Set(localMatches.map(u => u._id));
                                    const newGlobalUsers = globalUsers.filter(u => !localIds.has(u._id));

                                    setSearchResults([...localMatches, ...newGlobalUsers]);
                              }
                        } catch (err) {
                              console.error('Search failed:', err);
                        }
                        setSearching(false);
                  };

                  performSearch();
            }, 200); // Instagram speed (200ms)

            return () => clearTimeout(timer);
      }, [searchQuery, token, user?._id, conversations]);

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

      const handleGroupSearch = async (query) => {
            setGroupSearchQuery(query);
            if (query.trim().length < 2) {
                  setGroupSearchResults([]);
                  return;
            }
            try {
                  const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setGroupSearchResults(data.data.users.filter(u => u._id !== user?._id));
                  }
            } catch (err) {
                  console.error(err);
            }
      };

      const handleCreateGroupSubmit = async () => {
            if (!newGroupName.trim() || selectedUsers.length === 0) return;
            try {
                  const res = await fetch(`${API_URL}/messages/group/create`, {
                        method: 'POST',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                              name: newGroupName,
                              participants: selectedUsers.map(u => u._id),
                              isChannel
                        })
                  });
                  const data = await res.json();
                  if (data.success) {
                        setShowCreateGroup(false);
                        setNewGroupName('');
                        setSelectedUsers([]);
                        setIsChannel(false);
                        fetchConversations();
                        navigate(`/messages/group/${data.data.conversation._id}`);
                  }
            } catch (err) {
                  console.error(err);
            }
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
            <div className="messages-page animate-fadeIn" style={{ paddingBottom: '80px' }}>
                  <div className="messages-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h1 className="text-2xl font-bold">💬 Messages</h1>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowCreateGroup(true)}>Create Group</button>
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
                                          <div className="search-result-item" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
                                                Searching...
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

                  {/* Notes Header Slider */}
                  {!searchQuery && (
                        <div className="notes-slider" style={{ display: 'flex', gap: '16px', padding: '16px', overflowX: 'auto', borderBottom: '1px solid var(--border-color)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                              <style>{`.notes-slider::-webkit-scrollbar { display: none; }`}</style>
                              
                              {/* Add Note / My Note */}
                              <div className="note-item" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', minWidth: '70px' }} onClick={() => setShowNoteModal(true)}>
                                    <div style={{ position: 'relative' }}>
                                          <UserAvatar user={user} size={64} />
                                          <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--color-bg-primary)', borderRadius: '50%', padding: '2px' }}>
                                                <div style={{ background: 'var(--color-primary)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>+</div>
                                          </div>
                                    </div>
                                    <span style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8, textAlign: 'center' }}>Your note</span>
                              </div>

                              {/* Friend Notes */}
                              {notes.map(note => (
                                    <div key={note._id} className="note-item" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', minWidth: '70px' }} onClick={() => setViewingNote(note)}>
                                          <div style={{ position: 'absolute', top: '-10px', background: 'var(--color-bg-secondary)', padding: '6px 10px', borderRadius: '16px', fontSize: '11px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)', whiteSpace: 'nowrap', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', border: '1px solid var(--border-color)', zIndex: 1 }}>
                                                {note.text}
                                                <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', width: '8px', height: '8px', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', rotate: '45deg' }}></div>
                                          </div>
                                          <UserAvatar user={note.user} size={64} style={{ marginTop: '16px' }} />
                                          <span style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8, textAlign: 'center', maxWidth: '70px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.user?.username}</span>
                                    </div>
                              ))}
                        </div>
                  )}

                  {/* Conversations List */}
                  <div className="conversations-list">
                        {loading ? (
                              <div className="empty-state">
                                    {/* Silent loading */}
                              </div>
                        ) : conversations.length > 0 ? (
                              conversations.map(conv => (
                                    <Link
                                          key={conv._id}
                                          to={conv.isGroup ? `/messages/group/${conv._id}` : `/messages/${conv.user?._id}`}
                                          className={`conversation-item ${conv.unreadCount > 0 ? 'unread' : ''}`}
                                    >
                                          <div className="msg-avatar" style={{ position: 'relative' }}>
                                                {conv.isGroup ? (
                                                      conv.groupAvatar ? (
                                                            <img src={conv.groupAvatar} alt={conv.groupName} style={{borderRadius: '50%', width: '44px', height: '44px'}} />
                                                      ) : (
                                                            <div style={{ width:'44px', height:'44px', borderRadius: '50%', background: 'var(--color-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold' }}>
                                                                  {conv.isChannel ? '📢' : '👥'}
                                                            </div>
                                                      )
                                                ) : (
                                                      <UserAvatar user={conv.user} size={44} />
                                                )}
                                                {!conv.isGroup && onlineUsers.some(id => id.toString() === conv.user?._id?.toString()) && (
                                                      <span style={{
                                                            position: 'absolute',
                                                            bottom: '0px',
                                                            right: '0px',
                                                            width: '12px',
                                                            height: '12px',
                                                            backgroundColor: '#10b981',
                                                            borderRadius: '50%',
                                                            border: '2px solid var(--color-bg-primary)'
                                                      }}></span>
                                                )}
                                          </div>
                                          <div className="conversation-info">
                                                <div className="conversation-top">
                                                      <span className="conversation-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            {conv.isGroup ? conv.groupName : (conv.user?.displayName || conv.user?.username || 'Unknown')}
                                                            {conv.isChannel && <span style={{ fontSize: '12px', background: 'var(--color-bg-hover)', padding: '2px 6px', borderRadius: '4px' }}>Channel</span>}
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

                  {/* Create Group Modal */}
                  {showCreateGroup && (
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ background: 'var(--color-bg-card)', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Create Group / Channel</h2>
                                    
                                    <input 
                                          type="text" 
                                          placeholder="Group Name" 
                                          value={newGroupName} 
                                          onChange={e => setNewGroupName(e.target.value)}
                                          className="input"
                                    />

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                          <input type="checkbox" checked={isChannel} onChange={e => setIsChannel(e.target.checked)} />
                                          <span>Is Channel (Only Admins can send)</span>
                                    </label>

                                    <div>
                                          <input 
                                                type="text" 
                                                placeholder="Search Users to add..." 
                                                className="input"
                                                value={groupSearchQuery}
                                                onChange={e => handleGroupSearch(e.target.value)}
                                          />
                                          {groupSearchResults.length > 0 && (
                                                <div style={{ background: 'var(--color-bg-secondary)', padding: '8px', borderRadius: '8px', marginTop: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                                                      {groupSearchResults.map(u => (
                                                            <div key={u._id} style={{ padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => {
                                                                  if (!selectedUsers.find(su => su._id === u._id)) {
                                                                        setSelectedUsers([...selectedUsers, u]);
                                                                  }
                                                                  setGroupSearchQuery('');
                                                                  setGroupSearchResults([]);
                                                            }}>
                                                                  <span style={{ fontWeight: 'bold' }}>{u.displayName || u.username}</span>
                                                            </div>
                                                      ))}
                                                </div>
                                          )}
                                    </div>

                                    {selectedUsers.length > 0 && (
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {selectedUsers.map(u => (
                                                      <span key={u._id} style={{ background: 'var(--color-bg-hover)', padding: '4px 8px', borderRadius: '16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            {u.username}
                                                            <span style={{ cursor: 'pointer', color: 'red' }} onClick={() => setSelectedUsers(selectedUsers.filter(su => su._id !== u._id))}>✕</span>
                                                      </span>
                                                ))}
                                          </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreateGroupSubmit}>Create</button>
                                          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowCreateGroup(false)}>Cancel</button>
                                    </div>
                              </div>
                        </div>
                  )}

                  {/* Add Note Modal */}
                  {showNoteModal && (
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setShowNoteModal(false)}>
                              <div style={{ background: 'var(--color-bg-card)', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '350px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}>Leave a note</h2>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>Notes are visible to your friends for 24 hours.</p>
                                    <input 
                                          type="text" 
                                          placeholder="Share a thought..." 
                                          value={noteText} 
                                          onChange={e => setNoteText(e.target.value.substring(0, 60))}
                                          className="input"
                                          style={{ background: 'var(--color-bg-secondary)', border: 'none', borderRadius: '12px', padding: '12px 16px', fontSize: '15px' }}
                                          autoFocus
                                    />
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>{noteText.length}/60</div>
                                    <button className="btn btn-primary" style={{ borderRadius: '12px', padding: '12px' }} onClick={handleAddNote}>Share Note</button>
                              </div>
                        </div>
                  )}

                  {/* View/Delete Note Modal */}
                  {viewingNote && (
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setViewingNote(null)}>
                              <div style={{ background: 'var(--color-bg-card)', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '350px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                                    <UserAvatar user={viewingNote.user} size={80} />
                                    <h2 style={{ fontSize: '16px', fontWeight: 'bold' }}>{viewingNote.user?.displayName || viewingNote.user?.username}</h2>
                                    <div style={{ background: 'var(--color-bg-secondary)', padding: '16px', borderRadius: '12px', width: '100%', textAlign: 'center', fontSize: '15px' }}>
                                          "{viewingNote.text}"
                                    </div>
                                    {viewingNote.user?._id === user?._id && (
                                          <button className="btn btn-outline" style={{ color: 'red', borderColor: 'rgba(255,0,0,0.3)', width: '100%' }} onClick={() => handleDeleteNote(viewingNote._id)}>Delete Note</button>
                                    )}
                                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => {
                                          setViewingNote(null);
                                          navigate(`/messages/${viewingNote.user?._id}`);
                                    }}>Reply in Message</button>
                              </div>
                        </div>
                  )}
            </div>
      );
};

export default Messages;
