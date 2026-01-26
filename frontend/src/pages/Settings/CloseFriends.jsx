import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

const CloseFriends = () => {
      const navigate = useNavigate();
      const { token } = useAuth();
      const [friends, setFriends] = useState([]);
      const [searchQuery, setSearchQuery] = useState('');
      const [searchResults, setSearchResults] = useState([]);
      const [loading, setLoading] = useState(true);
      const [message, setMessage] = useState('');

      // Fetch close friends list from backend
      useEffect(() => {
            fetchCloseFriends();
      }, []);

      const fetchCloseFriends = async () => {
            try {
                  setLoading(true);
                  const res = await fetch(`${API_URL}/users/close-friends/list`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setFriends(data.data.closeFriends || []);
                  }
            } catch (error) {
                  console.error('Failed to fetch close friends:', error);
            } finally {
                  setLoading(false);
            }
      };

      const handleSearch = async (query) => {
            setSearchQuery(query);
            if (query.length < 2) {
                  setSearchResults([]);
                  return;
            }

            try {
                  const res = await fetch(`${API_URL}/users/search?q=${query}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        // Filter out users who are already close friends
                        const friendIds = friends.map(f => f._id);
                        const filtered = (data.data.users || []).filter(u => !friendIds.includes(u._id));
                        setSearchResults(filtered);
                  }
            } catch (error) {
                  console.error('Search failed:', error);
            }
      };

      const handleAddFriend = async (userId) => {
            setMessage('');
            try {
                  const res = await fetch(`${API_URL}/users/close-friends/${userId}`, {
                        method: 'POST',
                        headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json'
                        }
                  });
                  const data = await res.json();

                  if (data.success) {
                        setMessage('✅ Added to Close Friends!');
                        // Refresh the close friends list
                        fetchCloseFriends();
                        setSearchQuery('');
                        setSearchResults([]);
                  } else {
                        setMessage(`❌ ${data.message || 'Failed to add friend'}`);
                  }
                  setTimeout(() => setMessage(''), 3000);
            } catch (error) {
                  setMessage('❌ Failed to add friend');
                  setTimeout(() => setMessage(''), 3000);
            }
      };

      const handleRemoveFriend = async (userId) => {
            setMessage('');
            try {
                  const res = await fetch(`${API_URL}/users/close-friends/${userId}`, {
                        method: 'DELETE',
                        headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json'
                        }
                  });
                  const data = await res.json();

                  if (data.success) {
                        setMessage('✅ Removed from Close Friends');
                        // Refresh the close friends list
                        fetchCloseFriends();
                  } else {
                        setMessage(`❌ ${data.message || 'Failed to remove friend'}`);
                  }
                  setTimeout(() => setMessage(''), 3000);
            } catch (error) {
                  setMessage('❌ Failed to remove friend');
                  setTimeout(() => setMessage(''), 3000);
            }
      };

      return (
            <div className="container" style={{ paddingTop: '20px', paddingBottom: '100px', maxWidth: '600px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', padding: '0 16px' }}>
                        <button onClick={() => navigate('/settings')} style={{
                              background: 'none',
                              border: 'none',
                              fontSize: '24px',
                              cursor: 'pointer',
                              color: 'var(--color-text-primary)',
                              padding: 0
                        }}>
                              ‹
                        </button>
                        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>👥 Close Friends</h1>
                  </div>

                  {message && (
                        <div style={{
                              margin: '0 16px 16px 16px',
                              padding: '12px 16px',
                              borderRadius: '12px',
                              backgroundColor: message.includes('✅') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              border: `1px solid ${message.includes('✅') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                              color: 'var(--color-text-primary)'
                        }}>
                              {message}
                        </div>
                  )}

                  <div style={{ padding: '0 16px', marginBottom: '16px' }}>
                        <input
                              type="text"
                              placeholder="Search users to add..."
                              value={searchQuery}
                              onChange={(e) => handleSearch(e.target.value)}
                              style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--color-border)',
                                    backgroundColor: 'var(--color-bg-secondary)',
                                    color: 'var(--color-text-primary)',
                                    fontSize: '16px'
                              }}
                        />
                  </div>

                  {searchResults.length > 0 && (
                        <div style={{
                              backgroundColor: 'var(--color-bg-card)',
                              borderRadius: '16px',
                              border: '1px solid var(--color-border)',
                              margin: '0 16px 16px 16px',
                              overflow: 'hidden'
                        }}>
                              {searchResults.map(user => (
                                    <div key={user._id} style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '12px 16px',
                                          borderBottom: '1px solid var(--color-border)'
                                    }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div className="avatar avatar-sm">
                                                      {user.avatar ? <img src={user.avatar} alt={user.username} /> : user.username[0].toUpperCase()}
                                                </div>
                                                <div>
                                                      <div style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>
                                                            {user.displayName || user.username}
                                                      </div>
                                                      <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                                            @{user.username}
                                                      </div>
                                                </div>
                                          </div>
                                          <button
                                                onClick={() => handleAddFriend(user._id)}
                                                style={{
                                                      padding: '8px 16px',
                                                      borderRadius: '8px',
                                                      border: 'none',
                                                      background: 'var(--gradient-primary)',
                                                      color: 'white',
                                                      fontWeight: '600',
                                                      fontSize: '14px',
                                                      cursor: 'pointer'
                                                }}
                                          >
                                                Add
                                          </button>
                                    </div>
                              ))}
                        </div>
                  )}

                  <div style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: '16px',
                        border: '1px solid var(--color-border)',
                        padding: '20px',
                        margin: '0 16px'
                  }}>
                        <h3 style={{ marginBottom: '16px', color: 'var(--color-text-primary)', fontSize: '16px' }}>
                              Your Close Friends ({friends.length})
                        </h3>
                        {loading ? (
                              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>
                                    Loading...
                              </div>
                        ) : friends.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-secondary)' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                                    <h3 style={{ marginBottom: '8px', color: 'var(--color-text-primary)' }}>No Close Friends Yet</h3>
                                    <p>Search and add users to share exclusive content</p>
                              </div>
                        ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {friends.map(friend => (
                                          <div key={friend._id} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '12px',
                                                backgroundColor: 'var(--color-bg-secondary)',
                                                borderRadius: '12px'
                                          }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                      <div className="avatar avatar-sm" style={{
                                                            border: '2px solid #22c55e' // Green ring for close friends
                                                      }}>
                                                            {friend.avatar ? <img src={friend.avatar} alt={friend.username} /> : friend.username[0].toUpperCase()}
                                                      </div>
                                                      <div>
                                                            <div style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>
                                                                  {friend.displayName || friend.username}
                                                            </div>
                                                            <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                                                  @{friend.username}
                                                            </div>
                                                      </div>
                                                </div>
                                                <button
                                                      onClick={() => handleRemoveFriend(friend._id)}
                                                      style={{
                                                            padding: '8px 16px',
                                                            borderRadius: '8px',
                                                            border: '1px solid var(--color-border)',
                                                            background: 'transparent',
                                                            color: 'var(--color-text-secondary)',
                                                            fontWeight: '500',
                                                            fontSize: '14px',
                                                            cursor: 'pointer'
                                                      }}
                                                >
                                                      Remove
                                                </button>
                                          </div>
                                    ))}
                              </div>
                        )}
                  </div>

                  <div style={{
                        padding: '16px',
                        margin: '16px',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '12px',
                        color: 'var(--color-text-secondary)',
                        fontSize: '14px'
                  }}>
                        💡 Close Friends can see exclusive content you share only with them. They'll have a green ring around your profile.
                  </div>
            </div>
      );
};

export default CloseFriends;
