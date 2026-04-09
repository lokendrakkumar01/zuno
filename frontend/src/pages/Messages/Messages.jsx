import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import { API_URL } from '../../config';
import UserAvatar from '../../components/User/UserAvatar';

const Messages = () => {
      const { token, isAuthenticated, user } = useAuth();
      const { onlineUsers, socket } = useSocketContext();
      const navigate = useNavigate();

      const [conversations, setConversations] = useState(() => {
            try {
                  const cached = localStorage.getItem(`zuno_conversations_cache_${user?._id}`);
                  return cached ? JSON.parse(cached) : [];
            } catch {
                  return [];
            }
      });
      const [loading, setLoading] = useState(() => !localStorage.getItem(`zuno_conversations_cache_${user?._id}`));
      const [silentRefreshing, setSilentRefreshing] = useState(false);
      const [searchQuery, setSearchQuery] = useState('');
      const [searchResults, setSearchResults] = useState([]);
      const [searching, setSearching] = useState(false);

      const [notes, setNotes] = useState([]);
      const [showNoteModal, setShowNoteModal] = useState(false);
      const [noteText, setNoteText] = useState('');
      const [viewingNote, setViewingNote] = useState(null);

      const [showCreateGroup, setShowCreateGroup] = useState(false);
      const [newGroupName, setNewGroupName] = useState('');
      const [isChannel, setIsChannel] = useState(false);
      const [selectedUsers, setSelectedUsers] = useState([]);
      const [groupSearchQuery, setGroupSearchQuery] = useState('');
      const [groupSearchResults, setGroupSearchResults] = useState([]);

      const refetchTimerRef = useRef(null);
      const searchAbortRef = useRef(null);
      const groupSearchAbortRef = useRef(null);

      const fetchConversations = useCallback(async () => {
            const cacheKey = `zuno_conversations_cache_${user?._id}`;
            const hasCached = !!localStorage.getItem(cacheKey);

            if (!hasCached) setLoading(true);
            else setSilentRefreshing(true);

            try {
                  const res = await fetch(`${API_URL}/messages/conversations`, {
                        headers: { Authorization: `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setConversations(data.data.conversations || []);
                        try {
                              localStorage.setItem(cacheKey, JSON.stringify(data.data.conversations || []));
                        } catch {
                              // Cache writes are optional.
                        }
                  }
            } catch (err) {
                  console.error('Failed to fetch conversations:', err);
            } finally {
                  setLoading(false);
                  setSilentRefreshing(false);
            }
      }, [token, user?._id]);

      const fetchNotes = useCallback(async () => {
            try {
                  const res = await fetch(`${API_URL}/notes`, {
                        headers: { Authorization: `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setNotes(data.data.notes || []);
                  }
            } catch (err) {
                  console.error('Failed to fetch notes:', err);
            }
      }, [token]);

      const debouncedRefetch = useCallback(() => {
            if (refetchTimerRef.current) return;
            refetchTimerRef.current = setTimeout(() => {
                  refetchTimerRef.current = null;
                  fetchConversations();
            }, 1500);
      }, [fetchConversations]);

      useEffect(() => {
            if (!isAuthenticated) return;
            fetchConversations();
            fetchNotes();
      }, [fetchConversations, fetchNotes, isAuthenticated]);

      useEffect(() => {
            if (!socket) return;

            const handleRealtimeUpdate = () => debouncedRefetch();

            socket.on('newMessage', handleRealtimeUpdate);
            socket.on('newGroupMessage', handleRealtimeUpdate);
            socket.on('messageRead', handleRealtimeUpdate);

            return () => {
                  socket.off('newMessage', handleRealtimeUpdate);
                  socket.off('newGroupMessage', handleRealtimeUpdate);
                  socket.off('messageRead', handleRealtimeUpdate);
            };
      }, [debouncedRefetch, socket]);

      useEffect(() => () => {
            if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
            if (searchAbortRef.current) searchAbortRef.current.abort();
            if (groupSearchAbortRef.current) groupSearchAbortRef.current.abort();
      }, []);

      useEffect(() => {
            const timer = setTimeout(async () => {
                  if (!searchQuery.trim() || searchQuery.trim().length < 2) {
                        if (searchAbortRef.current) searchAbortRef.current.abort();
                        setSearchResults([]);
                        setSearching(false);
                        return;
                  }

                  const lowerQuery = searchQuery.toLowerCase();
                  const localMatches = conversations
                        .filter((conversation) => conversation.user && (
                              conversation.user.displayName?.toLowerCase().includes(lowerQuery) ||
                              conversation.user.username?.toLowerCase().includes(lowerQuery)
                        ))
                        .map((conversation) => conversation.user);

                  setSearchResults(localMatches);
                  setSearching(true);

                  try {
                        if (searchAbortRef.current) searchAbortRef.current.abort();
                        const controller = new AbortController();
                        searchAbortRef.current = controller;

                        const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(searchQuery)}`, {
                              headers: { Authorization: `Bearer ${token}` },
                              signal: controller.signal
                        });
                        const data = await res.json();

                        if (data.success) {
                              const localIds = new Set(localMatches.map((match) => match._id));
                              const remoteMatches = (data.data.users || [])
                                    .filter((candidate) => candidate._id !== user?._id && !localIds.has(candidate._id));

                              setSearchResults([...localMatches, ...remoteMatches]);
                        }
                  } catch (err) {
                        if (err.name !== 'AbortError') {
                              console.error('Search failed:', err);
                        }
                  } finally {
                        setSearching(false);
                  }
            }, 220);

            return () => clearTimeout(timer);
      }, [conversations, searchQuery, token, user?._id]);

      const handleGroupSearch = async (query) => {
            setGroupSearchQuery(query);

            if (query.trim().length < 2) {
                  if (groupSearchAbortRef.current) groupSearchAbortRef.current.abort();
                  setGroupSearchResults([]);
                  return;
            }

            try {
                  if (groupSearchAbortRef.current) groupSearchAbortRef.current.abort();
                  const controller = new AbortController();
                  groupSearchAbortRef.current = controller;

                  const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
                        headers: { Authorization: `Bearer ${token}` },
                        signal: controller.signal
                  });
                  const data = await res.json();
                  if (data.success) {
                        setGroupSearchResults((data.data.users || []).filter((candidate) => candidate._id !== user?._id));
                  }
            } catch (err) {
                  if (err.name !== 'AbortError') {
                        console.error(err);
                  }
            }
      };

      const handleAddNote = async () => {
            if (!noteText.trim()) return;

            try {
                  const res = await fetch(`${API_URL}/notes`, {
                        method: 'POST',
                        headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({ text: noteText.trim() })
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
                        headers: { Authorization: `Bearer ${token}` }
                  });

                  if (res.ok) {
                        setViewingNote(null);
                        fetchNotes();
                  }
            } catch (err) {
                  console.error('Failed to delete note', err);
            }
      };

      const handleCreateGroupSubmit = async () => {
            if (!newGroupName.trim() || selectedUsers.length === 0) return;

            try {
                  const res = await fetch(`${API_URL}/messages/group/create`, {
                        method: 'POST',
                        headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({
                              name: newGroupName.trim(),
                              participants: selectedUsers.map((member) => member._id),
                              isChannel
                        })
                  });
                  const data = await res.json();

                  if (data.success) {
                        setShowCreateGroup(false);
                        setNewGroupName('');
                        setSelectedUsers([]);
                        setIsChannel(false);
                        setGroupSearchQuery('');
                        setGroupSearchResults([]);
                        fetchConversations();
                        navigate(`/messages/group/${data.data.conversation._id}`);
                  }
            } catch (err) {
                  console.error(err);
            }
      };

      const formatTime = (dateStr) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            const now = new Date();
            const diff = now - date;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));

            if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (days === 1) return 'Yesterday';
            if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      };

      if (!isAuthenticated) {
            return (
                  <div className="empty-state animate-fadeIn">
                        <div className="empty-state-icon">🔒</div>
                        <h2 className="text-xl font-semibold mb-md">Login to Message</h2>
                        <p className="text-muted mb-lg">You need to be logged in to open your inbox.</p>
                        <button onClick={() => navigate('/login')} className="btn btn-primary">Login</button>
                  </div>
            );
      }

      const onlineConversationCount = conversations.filter((conversation) =>
            !conversation.isGroup && onlineUsers.some((id) => id?.toString() === conversation.user?._id?.toString())
      ).length;

      return (
            <div className="messages-shell animate-fadeIn">
                  <section className="messages-hero-card">
                        <div>
                              <span className="home-kicker">Realtime inbox</span>
                              <h1>Messages</h1>
                              <p>Fast inbox loading, quieter layout, and stable access to chats, notes, groups and channels.</p>
                        </div>

                        <div className="messages-hero-stats">
                              <div className="messages-mini-stat">
                                    <span>Chats</span>
                                    <strong>{conversations.length}</strong>
                              </div>
                              <div className="messages-mini-stat">
                                    <span>Online</span>
                                    <strong>{onlineConversationCount}</strong>
                              </div>
                              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreateGroup(true)}>
                                    Create Group
                              </button>
                        </div>
                  </section>

                  <div className="messages-page" style={{ paddingBottom: '96px' }}>
                        <div className="messages-search">
                              <div className="input-group" style={{ marginBottom: 0 }}>
                                    <input
                                          type="text"
                                          className="input"
                                          placeholder="Search people and open a conversation..."
                                          value={searchQuery}
                                          onChange={(event) => setSearchQuery(event.target.value)}
                                    />
                              </div>

                              {searchQuery && (
                                    <div className="search-results-dropdown">
                                          {searching && searchResults.length === 0 ? (
                                                <div className="search-result-item" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
                                                      Searching...
                                                </div>
                                          ) : searchQuery.trim().length < 2 ? (
                                                <div className="search-result-item" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
                                                      Type at least 2 characters to search.
                                                </div>
                                          ) : searchResults.length > 0 ? (
                                                searchResults.map((person) => (
                                                      <Link
                                                            key={person._id}
                                                            to={`/messages/${person._id}`}
                                                            className="search-result-item"
                                                            onClick={() => setSearchQuery('')}
                                                      >
                                                            <UserAvatar user={person} size={40} />
                                                            <div>
                                                                  <div className="font-semibold">{person.displayName || person.username}</div>
                                                                  <div className="text-sm text-muted">@{person.username}</div>
                                                            </div>
                                                      </Link>
                                                ))
                                          ) : (
                                                <div className="search-result-item" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
                                                      No users found for "{searchQuery}".
                                                </div>
                                          )}
                                    </div>
                              )}
                        </div>

                        {!searchQuery && (
                              <div className="messages-notes-strip">
                                    <button type="button" className="messages-note-card messages-note-card--create" onClick={() => setShowNoteModal(true)}>
                                          <UserAvatar user={user} size={56} />
                                          <strong>Your note</strong>
                                          <span>Add a quick update</span>
                                    </button>

                                    {notes.map((note) => (
                                          <button key={note._id} type="button" className="messages-note-card" onClick={() => setViewingNote(note)}>
                                                <UserAvatar user={note.user} size={56} />
                                                <strong>{note.user?.displayName || note.user?.username}</strong>
                                                <span>{note.text}</span>
                                          </button>
                                    ))}
                              </div>
                        )}

                        <div className="messages-list-head">
                              <strong>Conversations</strong>
                              <span>{silentRefreshing ? 'Refreshing...' : 'Stable realtime updates'}</span>
                        </div>

                        <div className="conversations-list">
                              {loading ? (
                                    <div className="empty-state">
                                          <div className="loader mb-md" />
                                          <p className="text-muted">Loading your inbox...</p>
                                    </div>
                              ) : conversations.length > 0 ? (
                                    conversations.map((conversation) => (
                                          <Link
                                                key={conversation._id}
                                                to={conversation.isGroup ? `/messages/group/${conversation._id}` : `/messages/${conversation.user?._id}`}
                                                className={`conversation-item ${conversation.unreadCount > 0 ? 'unread' : ''}`}
                                          >
                                                <div className="msg-avatar" style={{ position: 'relative' }}>
                                                      {conversation.isGroup ? (
                                                            conversation.groupAvatar ? (
                                                                  <img src={conversation.groupAvatar} alt={conversation.groupName} style={{ borderRadius: '50%', width: '48px', height: '48px', objectFit: 'cover' }} />
                                                            ) : (
                                                                  <div className="messages-group-fallback">{conversation.isChannel ? '📢' : '👥'}</div>
                                                            )
                                                      ) : (
                                                            <UserAvatar user={conversation.user} size={48} />
                                                      )}

                                                      {!conversation.isGroup && onlineUsers.some((id) => id?.toString() === conversation.user?._id?.toString()) && (
                                                            <span className="messages-online-dot" />
                                                      )}
                                                </div>

                                                <div className="conversation-info">
                                                      <div className="conversation-top">
                                                            <span className="conversation-name">
                                                                  {conversation.isGroup ? conversation.groupName : (conversation.user?.displayName || conversation.user?.username || 'Unknown')}
                                                            </span>
                                                            <span className="conversation-time">{formatTime(conversation.lastMessage?.createdAt)}</span>
                                                      </div>

                                                      <div className="conversation-bottom">
                                                            <span className="conversation-preview">
                                                                  {conversation.isChannel ? 'Channel' : ''}
                                                                  {conversation.isChannel && conversation.lastMessage?.text ? ' • ' : ''}
                                                                  {conversation.lastMessage?.text || 'Media shared'}
                                                            </span>
                                                            {conversation.unreadCount > 0 && <span className="unread-badge">{conversation.unreadCount}</span>}
                                                      </div>
                                                </div>
                                          </Link>
                                    ))
                              ) : (
                                    <div className="empty-state">
                                          <div className="empty-state-icon">💬</div>
                                          <h3 className="text-lg font-semibold mb-sm">No conversations yet</h3>
                                          <p className="text-muted">Search for someone above to start a chat.</p>
                                    </div>
                              )}
                        </div>
                  </div>

                  {showCreateGroup && (
                        <div className="modal-overlay" onClick={() => setShowCreateGroup(false)}>
                              <div className="card modal-content messages-modal-card" onClick={(event) => event.stopPropagation()}>
                                    <div className="messages-modal-head">
                                          <h2>Create Group or Channel</h2>
                                          <button type="button" className="shell-icon-btn" onClick={() => setShowCreateGroup(false)}>×</button>
                                    </div>

                                    <input
                                          type="text"
                                          className="input"
                                          placeholder="Group name"
                                          value={newGroupName}
                                          onChange={(event) => setNewGroupName(event.target.value)}
                                    />

                                    <label className="messages-check-row">
                                          <input type="checkbox" checked={isChannel} onChange={(event) => setIsChannel(event.target.checked)} />
                                          <span>Create as a channel</span>
                                    </label>

                                    <input
                                          type="text"
                                          className="input"
                                          placeholder="Search people to add..."
                                          value={groupSearchQuery}
                                          onChange={(event) => handleGroupSearch(event.target.value)}
                                    />

                                    {groupSearchResults.length > 0 && (
                                          <div className="messages-member-results">
                                                {groupSearchResults.map((candidate) => (
                                                      <button
                                                            type="button"
                                                            key={candidate._id}
                                                            className="messages-member-result"
                                                            onClick={() => {
                                                                  if (!selectedUsers.find((member) => member._id === candidate._id)) {
                                                                        setSelectedUsers((prev) => [...prev, candidate]);
                                                                  }
                                                                  setGroupSearchQuery('');
                                                                  setGroupSearchResults([]);
                                                            }}
                                                      >
                                                            <UserAvatar user={candidate} size={36} />
                                                            <span>{candidate.displayName || candidate.username}</span>
                                                      </button>
                                                ))}
                                          </div>
                                    )}

                                    {selectedUsers.length > 0 && (
                                          <div className="messages-selected-members">
                                                {selectedUsers.map((member) => (
                                                      <span key={member._id} className="messages-selected-pill">
                                                            {member.username}
                                                            <button
                                                                  type="button"
                                                                  onClick={() => setSelectedUsers((prev) => prev.filter((entry) => entry._id !== member._id))}
                                                            >
                                                                  ×
                                                            </button>
                                                      </span>
                                                ))}
                                          </div>
                                    )}

                                    <div className="messages-modal-actions">
                                          <button type="button" className="btn btn-primary" onClick={handleCreateGroupSubmit}>Create</button>
                                          <button type="button" className="btn btn-secondary" onClick={() => setShowCreateGroup(false)}>Cancel</button>
                                    </div>
                              </div>
                        </div>
                  )}

                  {showNoteModal && (
                        <div className="modal-overlay" onClick={() => setShowNoteModal(false)}>
                              <div className="card modal-content messages-modal-card" onClick={(event) => event.stopPropagation()}>
                                    <div className="messages-modal-head">
                                          <h2>Leave a note</h2>
                                          <button type="button" className="shell-icon-btn" onClick={() => setShowNoteModal(false)}>×</button>
                                    </div>
                                    <p className="text-muted">Notes stay visible to friends for 24 hours.</p>
                                    <input
                                          type="text"
                                          className="input"
                                          placeholder="Share a thought..."
                                          value={noteText}
                                          onChange={(event) => setNoteText(event.target.value.slice(0, 60))}
                                          autoFocus
                                    />
                                    <div className="messages-note-counter">{noteText.length}/60</div>
                                    <button type="button" className="btn btn-primary" onClick={handleAddNote}>Share Note</button>
                              </div>
                        </div>
                  )}

                  {viewingNote && (
                        <div className="modal-overlay" onClick={() => setViewingNote(null)}>
                              <div className="card modal-content messages-modal-card" onClick={(event) => event.stopPropagation()}>
                                    <UserAvatar user={viewingNote.user} size={72} />
                                    <h2>{viewingNote.user?.displayName || viewingNote.user?.username}</h2>
                                    <p className="messages-note-preview">"{viewingNote.text}"</p>
                                    {viewingNote.user?._id === user?._id && (
                                          <button type="button" className="btn btn-secondary" onClick={() => handleDeleteNote(viewingNote._id)}>
                                                Delete Note
                                          </button>
                                    )}
                                    <button
                                          type="button"
                                          className="btn btn-primary"
                                          onClick={() => {
                                                setViewingNote(null);
                                                navigate(`/messages/${viewingNote.user?._id}`);
                                          }}
                                    >
                                          Reply in Chat
                                    </button>
                              </div>
                        </div>
                  )}
            </div>
      );
};

export default Messages;
