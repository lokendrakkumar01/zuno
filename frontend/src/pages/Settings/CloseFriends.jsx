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
      const [loading, setLoading] = useState(false);
      const [message, setMessage] = useState('');

      // Mock friends for now - replace with actual API call
      useEffect(() => {
            // TODO: Fetch close friends list from backend
            setFriends([]);
      }, []);

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
                        setSearchResults(data.data.users || []);
                  }
            } catch (error) {
                  console.error('Search failed:', error);
            }
      };

      const handleAddFriend = async (userId) => {
            setMessage('');
            try {
                  setMessage('✅ Added to Close Friends!');
                  setSearchQuery('');
                  setSearchResults([]);
                  setTimeout(() => setMessage(''), 2000);
            } catch (error) {
                  setMessage('❌ Failed to add friend');
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
                        {friends.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-secondary)' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                                    <h3 style={{ marginBottom: '8px', color: 'var(--color-text-primary)' }}>No Close Friends Yet</h3>
                                    <p>Search and add users to share exclusive content</p>
                              </div>
                        ) : (
                              friends.map(friend => (
                                    <div key={friend._id}>Friend: {friend.username}</div>
                              ))
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
