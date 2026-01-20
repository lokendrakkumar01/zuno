import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

const Privacy = () => {
      const navigate = useNavigate();
      const { user, token } = useAuth();
      const [isPrivate, setIsPrivate] = useState(user?.isPrivate || false);
      const [profileVisibility, setProfileVisibility] = useState(user?.profileVisibility || 'public');
      const [message, setMessage] = useState('');
      const [loading, setLoading] = useState(false);

      const handleSave = async () => {
            setLoading(true);
            setMessage('');

            try {
                  const res = await fetch(`${API_URL}/users/profile`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ isPrivate, profileVisibility })
                  });
                  const data = await res.json();

                  if (data.success) {
                        setMessage('✅ Privacy settings updated!');
                        setTimeout(() => setMessage(''), 3000);
                  } else {
                        setMessage(`❌ ${data.message || 'Update failed'}`);
                  }
            } catch (error) {
                  setMessage('❌ Failed to update settings');
            }
            setLoading(false);
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
                        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>Account Privacy</h1>
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

                  <div style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        border: '1px solid var(--color-border)',
                        padding: '20px'
                  }}>
                        <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '16px',
                              marginBottom: '16px',
                              backgroundColor: 'var(--color-bg-secondary)',
                              borderRadius: '12px'
                        }}>
                              <div>
                                    <div style={{ fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                                          🔐 Private Account
                                    </div>
                                    <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                          Only approved followers can see your content
                                    </div>
                              </div>
                              <input
                                    type="checkbox"
                                    checked={isPrivate}
                                    onChange={(e) => setIsPrivate(e.target.checked)}
                                    style={{ transform: 'scale(1.5)', accentColor: 'var(--color-accent-primary)', cursor: 'pointer' }}
                              />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                              <label style={{ display: 'block', fontWeight: '600', marginBottom: '12px', color: 'var(--color-text-primary)' }}>
                                    👁️ Profile Visibility
                              </label>
                              <select
                                    value={profileVisibility}
                                    onChange={(e) => setProfileVisibility(e.target.value)}
                                    style={{
                                          width: '100%',
                                          padding: '12px',
                                          borderRadius: '8px',
                                          border: '1px solid var(--color-border)',
                                          backgroundColor: 'var(--color-bg-secondary)',
                                          color: 'var(--color-text-primary)',
                                          fontSize: '16px'
                                    }}
                              >
                                    <option value="public">🌍 Public - Anyone can view</option>
                                    <option value="friends">👥 Friends Only</option>
                                    <option value="private">🔒 Private - Only you</option>
                              </select>
                        </div>

                        <button
                              onClick={handleSave}
                              disabled={loading}
                              style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: loading ? 'var(--color-bg-secondary)' : 'var(--gradient-primary)',
                                    color: 'white',
                                    fontWeight: '600',
                                    fontSize: '16px',
                                    cursor: loading ? 'not-allowed' : 'pointer'
                              }}
                        >
                              {loading ? '⏳ Saving...' : '💾 Save Changes'}
                        </button>
                  </div>
            </div>
      );
};

export default Privacy;
