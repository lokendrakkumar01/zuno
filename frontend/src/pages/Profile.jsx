import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import ContentCard from '../components/Content/ContentCard';

const INTERESTS = [
      'learning', 'technology', 'creativity', 'health',
      'business', 'science', 'arts', 'lifestyle',
      'problem-solving', 'mentoring'
];

const FEED_MODES = [
      { id: 'learning', label: '📚 Learning' },
      { id: 'calm', label: '🧘 Calm' },
      { id: 'video', label: '🎬 Video' },
      { id: 'reading', label: '📖 Reading' },
      { id: 'problem-solving', label: '💡 Problem Solving' }
];

const Profile = () => {
      const { username } = useParams();
      const { user, token, isAuthenticated, updateProfile, logout } = useAuth();
      const navigate = useNavigate();
      const fileInputRef = useRef(null);

      const [profileUser, setProfileUser] = useState(null);
      const [userPosts, setUserPosts] = useState([]);
      const [loading, setLoading] = useState(true);
      const [editing, setEditing] = useState(false);
      const [editData, setEditData] = useState({});
      const [message, setMessage] = useState('');
      const [uploadingPhoto, setUploadingPhoto] = useState(false);
      const [activeTab, setActiveTab] = useState('profile');
      const [isFollowing, setIsFollowing] = useState(false);
      const [followLoading, setFollowLoading] = useState(false);

      const isOwnProfile = !username || (user && user.username === username);

      // Refresh profile when page becomes visible (for dynamic updates)
      useEffect(() => {
            const handleVisibilityChange = () => {
                  if (document.visibilityState === 'visible') {
                        refreshProfile();
                  }
            };
            document.addEventListener('visibilitychange', handleVisibilityChange);
            return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
      }, [username, user]);

      const refreshProfile = async () => {
            if (isOwnProfile && user) {
                  setProfileUser(user);
                  fetchUserPosts(user.username);
            } else if (username) {
                  try {
                        const res = await fetch(`${API_URL}/users/${username}`);
                        const data = await res.json();
                        if (data.success) {
                              setProfileUser(data.data.user);
                              fetchUserPosts(username);
                        }
                  } catch (error) {
                        console.error('Failed to refresh profile:', error);
                  }
            }
      };

      useEffect(() => {
            const fetchProfile = async () => {
                  setLoading(true);
                  if (isOwnProfile && user) {
                        setProfileUser(user);
                        setEditData({
                              displayName: user.displayName || '',
                              bio: user.bio || '',
                              avatar: user.avatar || '',
                              interests: user.interests || [],
                              preferredFeedMode: user.preferredFeedMode || 'learning',
                              focusModeEnabled: user.focusModeEnabled || false,
                              dailyUsageLimit: user.dailyUsageLimit || 0
                        });
                        fetchUserPosts(user.username);
                  } else if (username) {
                        try {
                              const res = await fetch(`${API_URL}/users/${username}`);
                              const data = await res.json();
                              if (data.success) {
                                    setProfileUser(data.data.user);
                                    fetchUserPosts(username);
                              }
                        } catch (error) {
                              console.error('Failed to fetch profile:', error);
                        }
                  }
                  setLoading(false);
            };
            fetchProfile();
      }, [username, user, isOwnProfile]);

      const fetchUserPosts = async (uname) => {
            try {
                  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
                  const res = await fetch(`${API_URL}/feed/creator/${uname}`, { headers });
                  const data = await res.json();
                  if (data.success) {
                        setUserPosts(data.data);
                  }
            } catch (error) {
                  console.error('Failed to fetch user posts:', error);
            }
      };

      // Check if current user follows this profile
      useEffect(() => {
            if (!isOwnProfile && profileUser && user) {
                  // Check if current user's following list contains this profile's ID
                  const following = user.following || [];
                  setIsFollowing(following.includes(profileUser._id));
            }
      }, [profileUser, user, isOwnProfile]);

      const handleFollow = async () => {
            if (!token || !profileUser) return;
            setFollowLoading(true);
            try {
                  const endpoint = isFollowing ? 'unfollow' : 'follow';
                  const res = await fetch(`${API_URL}/users/${profileUser._id}/${endpoint}`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setIsFollowing(!isFollowing);
                        // Update follower count locally
                        setProfileUser(prev => ({
                              ...prev,
                              followersCount: isFollowing
                                    ? (prev.followersCount || 1) - 1
                                    : (prev.followersCount || 0) + 1
                        }));
                        setMessage(data.message);
                        setTimeout(() => setMessage(''), 3000);
                  }
            } catch (error) {
                  console.error('Failed to toggle follow:', error);
            }
            setFollowLoading(false);
      };

      const handlePhotoClick = () => {
            if (isOwnProfile && fileInputRef.current) {
                  fileInputRef.current.click();
            }
      };

      const handlePhotoChange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                  setMessage('⚠️ Please select an image file');
                  return;
            }
            if (file.size > 5 * 1024 * 1024) {
                  setMessage('⚠️ Image must be less than 5MB');
                  return;
            }

            setUploadingPhoto(true);
            setMessage('');

            try {
                  const formData = new FormData();
                  formData.append('avatar', file);

                  const reader = new FileReader();
                  reader.onloadend = async () => {
                        const avatarUrl = reader.result;
                        const result = await updateProfile({ avatar: avatarUrl });
                        if (result.success) {
                              setEditData(prev => ({ ...prev, avatar: avatarUrl }));
                              setProfileUser(prev => ({ ...prev, avatar: avatarUrl }));
                              setMessage('✅ Profile photo updated!');
                        } else {
                              setMessage('⚠️ Failed to update photo');
                        }
                        setUploadingPhoto(false);
                  };
                  reader.readAsDataURL(file);
            } catch (error) {
                  setMessage('⚠️ Failed to upload photo');
                  setUploadingPhoto(false);
            }
      };

      const handleSaveProfile = async () => {
            setMessage('');
            const result = await updateProfile(editData);
            if (result.success) {
                  setMessage('✅ Profile updated successfully!');
                  setProfileUser(prev => ({ ...prev, ...editData }));
                  setEditing(false);
            } else {
                  setMessage('⚠️ ' + result.message);
            }
      };

      const handleInterestToggle = (interest) => {
            setEditData(prev => ({
                  ...prev,
                  interests: prev.interests.includes(interest)
                        ? prev.interests.filter(i => i !== interest)
                        : [...prev.interests, interest]
            }));
      };

      const handleLogout = () => {
            logout();
            navigate('/');
      };

      if (!isAuthenticated && isOwnProfile) {
            return (
                  <div className="container" style={{ paddingTop: 'var(--space-2xl)' }}>
                        <div className="empty-state animate-fadeIn">
                              <div className="empty-state-icon">🔒</div>
                              <h2 className="text-xl font-semibold mb-md">Login to view your profile</h2>
                              <button onClick={() => navigate('/login')} className="btn btn-primary">
                                    Login
                              </button>
                        </div>
                  </div>
            );
      }

      if (loading && !profileUser) {
            return (
                  <div className="container" style={{ paddingTop: 'var(--space-2xl)' }}>
                        <div className="empty-state">
                              <div className="spinner" style={{ margin: '0 auto' }}></div>
                        </div>
                  </div>
            );
      }

      if (!profileUser) {
            return (
                  <div className="container" style={{ paddingTop: 'var(--space-2xl)' }}>
                        <div className="empty-state animate-fadeIn">
                              <div className="empty-state-icon">🔍</div>
                              <h2 className="text-xl font-semibold mb-md">User not found</h2>
                        </div>
                  </div>
            );
      }

      return (
            <div className="container" style={{ paddingTop: 'var(--space-xl)', paddingBottom: 'var(--space-2xl)' }}>
                  <div className="profile-page animate-fadeIn">

                        {/* Profile Header Card */}
                        <div className="card mb-xl" style={{
                              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
                              borderColor: 'rgba(99, 102, 241, 0.2)'
                        }}>
                              <div className="flex items-center gap-xl flex-wrap">

                                    {/* Avatar with Upload */}
                                    <div style={{ position: 'relative' }}>
                                          <div
                                                className="avatar avatar-xl"
                                                onClick={handlePhotoClick}
                                                style={{
                                                      cursor: isOwnProfile ? 'pointer' : 'default',
                                                      transition: 'all 0.3s ease',
                                                      border: '3px solid rgba(99, 102, 241, 0.5)'
                                                }}
                                                onMouseOver={(e) => isOwnProfile && (e.currentTarget.style.transform = 'scale(1.05)')}
                                                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                          >
                                                {uploadingPhoto ? (
                                                      <div className="spinner"></div>
                                                ) : profileUser.avatar ? (
                                                      <img src={profileUser.avatar} alt={profileUser.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                      <span style={{ fontSize: '2.5rem' }}>
                                                            {profileUser.displayName?.charAt(0).toUpperCase() || profileUser.username?.charAt(0).toUpperCase() || 'Z'}
                                                      </span>
                                                )}
                                          </div>

                                          {isOwnProfile && (
                                                <div
                                                      onClick={handlePhotoClick}
                                                      style={{
                                                            position: 'absolute',
                                                            bottom: '0',
                                                            right: '0',
                                                            width: '32px',
                                                            height: '32px',
                                                            background: 'var(--gradient-primary)',
                                                            borderRadius: '50%',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            boxShadow: 'var(--shadow-md)',
                                                            fontSize: '1rem'
                                                      }}
                                                >
                                                      📷
                                                </div>
                                          )}
                                          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                                    </div>

                                    {/* User Info */}
                                    <div className="flex-1">
                                          <h1 className="text-3xl font-bold mb-xs">
                                                {profileUser.displayName || profileUser.username}
                                          </h1>
                                          <p className="text-muted text-lg mb-md">@{profileUser.username}</p>

                                          {/* Stats: Followers/Following */}
                                          <div className="flex gap-lg mb-md text-sm">
                                                <div className="flex items-center gap-xs">
                                                      <span className="font-bold text-gray-900 text-lg">{profileUser.followersCount || 0}</span>
                                                      <span className="text-gray-500">Followers</span>
                                                </div>
                                                <div className="flex items-center gap-xs">
                                                      <span className="font-bold text-gray-900 text-lg">{profileUser.followingCount || 0}</span>
                                                      <span className="text-gray-500">Following</span>
                                                </div>
                                                <div className="flex items-center gap-xs">
                                                      <span className="font-bold text-gray-900 text-lg">{userPosts.length || 0}</span>
                                                      <span className="text-gray-500">Posts</span>
                                                </div>
                                          </div>

                                          {profileUser.bio && (
                                                <p className="text-secondary mt-sm" style={{ maxWidth: '500px' }}>{profileUser.bio}</p>
                                          )}

                                          <div className="flex gap-sm mt-lg flex-wrap">
                                                <span className="tag tag-primary" style={{ fontSize: 'var(--font-size-sm)' }}>
                                                      {profileUser.role === 'admin' ? '👑 Admin' :
                                                            profileUser.role === 'creator' ? '✨ Creator' :
                                                                  profileUser.role === 'mentor' ? '🎓 Mentor' : '👤 User'}
                                                </span>
                                                {profileUser.isVerified && (
                                                      <span className="tag tag-success">✅ Verified</span>
                                                )}
                                          </div>
                                    </div>

                                    {/* Action Buttons */}
                                    {isOwnProfile ? (
                                          <div className="flex gap-md">
                                                <button
                                                      onClick={() => setEditing(!editing)}
                                                      className={`btn ${editing ? 'btn-ghost' : 'btn-secondary'}`}
                                                >
                                                      {editing ? '❌ Cancel' : '✏️ Edit Profile'}
                                                </button>
                                          </div>
                                    ) : isAuthenticated && (
                                          <div className="flex gap-md">
                                                <button
                                                      onClick={handleFollow}
                                                      disabled={followLoading}
                                                      className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                                                      style={{ minWidth: '120px' }}
                                                >
                                                      {followLoading ? (
                                                            <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                                                      ) : isFollowing ? (
                                                            '✓ Following'
                                                      ) : (
                                                            '+ Follow'
                                                      )}
                                                </button>
                                          </div>
                                    )}
                              </div>
                        </div>

                        {message && (
                              <div className="card p-md mb-lg animate-fadeIn" style={{
                                    background: message.includes('✅') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    borderColor: message.includes('✅') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                              }}>
                                    <p>{message}</p>
                              </div>
                        )}

                        {isOwnProfile && (
                              <div className="mode-pills mb-xl" style={{ maxWidth: '500px' }}>
                                    <button className={`mode-pill ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>👤 Profile</button>
                                    <button className={`mode-pill ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>⚙️ Settings</button>
                                    <button className={`mode-pill ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>📊 Stats</button>
                              </div>
                        )}

                        {editing && isOwnProfile && (
                              <div className="card mb-xl animate-fadeInUp">
                                    <h2 className="text-xl font-semibold mb-lg flex items-center gap-sm">✏️ Edit Profile</h2>
                                    <div className="grid grid-cols-2 gap-lg">
                                          <div className="input-group">
                                                <label className="input-label">Display Name</label>
                                                <input type="text" className="input" value={editData.displayName} onChange={(e) => setEditData(prev => ({ ...prev, displayName: e.target.value }))} placeholder="Your display name" />
                                          </div>
                                          <div className="input-group">
                                                <label className="input-label">Preferred Feed Mode</label>
                                                <select className="input select" value={editData.preferredFeedMode} onChange={(e) => setEditData(prev => ({ ...prev, preferredFeedMode: e.target.value }))}>
                                                      {FEED_MODES.map(mode => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
                                                </select>
                                          </div>
                                    </div>
                                    <div className="input-group mt-lg">
                                          <label className="input-label">Bio</label>
                                          <textarea className="input" rows={3} value={editData.bio} onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))} placeholder="Tell us about yourself..." maxLength={200} />
                                          <p className="text-xs text-muted mt-xs">{editData.bio?.length || 0}/200</p>
                                    </div>
                                    <div className="input-group mt-lg">
                                          <label className="input-label">Interests (affects your feed)</label>
                                          <div className="flex gap-sm flex-wrap">
                                                {INTERESTS.map(interest => (
                                                      <button key={interest} type="button" className={`tag ${editData.interests?.includes(interest) ? 'tag-primary' : ''}`} onClick={() => handleInterestToggle(interest)} style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}>{interest}</button>
                                                ))}
                                          </div>
                                    </div>
                                    <div className="flex gap-md mt-xl">
                                          <button onClick={handleSaveProfile} className="btn btn-primary">💾 Save Changes</button>
                                          <button onClick={() => setEditing(false)} className="btn btn-ghost">Cancel</button>
                                    </div>
                              </div>
                        )}

                        {activeTab === 'profile' && !editing && (
                              <>
                                    {profileUser.interests && profileUser.interests.length > 0 && (
                                          <div className="card mb-lg animate-fadeInUp">
                                                <h3 className="font-semibold mb-md flex items-center gap-sm">🎯 Interests</h3>
                                                <div className="flex gap-sm flex-wrap">
                                                      {profileUser.interests.map(interest => (
                                                            <span key={interest} className="tag tag-primary">{interest}</span>
                                                      ))}
                                                </div>
                                          </div>
                                    )}

                                    {/* User Posts */}
                                    <h3 className="text-xl font-bold mb-md mt-xl">Posts</h3>
                                    <div className="posts-grid">
                                          {userPosts.length > 0 ? (
                                                userPosts.map(post => (
                                                      <ContentCard key={post._id} content={post} />
                                                ))
                                          ) : (
                                                <div className="text-center text-gray-500 py-xl">No posts yet.</div>
                                          )}
                                    </div>

                                    {isOwnProfile && (
                                          <div className="grid grid-cols-3 gap-md mb-lg mt-xl">
                                                <button onClick={() => navigate('/upload')} className="feature-card animate-fadeInUp stagger-1" style={{ padding: 'var(--space-lg)' }}>
                                                      <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📤</div>
                                                      <div className="font-semibold">Upload</div>
                                                </button>
                                                <button onClick={() => setEditing(true)} className="feature-card animate-fadeInUp stagger-2" style={{ padding: 'var(--space-lg)' }}>
                                                      <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>✏️</div>
                                                      <div className="font-semibold">Edit Profile</div>
                                                </button>
                                                <button onClick={handlePhotoClick} className="feature-card animate-fadeInUp stagger-3" style={{ padding: 'var(--space-lg)' }}>
                                                      <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📷</div>
                                                      <div className="font-semibold">Change Photo</div>
                                                </button>
                                          </div>
                                    )}
                              </>
                        )}

                        {activeTab === 'settings' && isOwnProfile && (
                              <div className="card animate-fadeInUp">
                                    <h3 className="text-lg font-semibold mb-lg">🧘 Wellness Settings</h3>
                                    <div className="flex items-center gap-lg p-md mb-md" style={{ background: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-lg)' }}>
                                          <input type="checkbox" id="focusMode" checked={editData.focusModeEnabled} onChange={(e) => { setEditData(prev => ({ ...prev, focusModeEnabled: e.target.checked })); updateProfile({ focusModeEnabled: e.target.checked }); }} style={{ width: '24px', height: '24px', accentColor: 'var(--color-accent-primary)' }} />
                                          <label htmlFor="focusMode" style={{ cursor: 'pointer', flex: 1 }}><div className="font-semibold">🧘 Focus Mode</div><p className="text-sm text-muted">Hide all counts and metrics for peaceful browsing</p></label>
                                    </div>
                                    <div className="input-group mt-lg">
                                          <label className="input-label">⏰ Daily Usage Limit (minutes)</label>
                                          <input type="number" className="input" min="0" max="480" value={editData.dailyUsageLimit} onChange={(e) => { const value = parseInt(e.target.value) || 0; setEditData(prev => ({ ...prev, dailyUsageLimit: value })); }} placeholder="0 = unlimited" />
                                          <p className="text-xs text-muted mt-xs">Set 0 for unlimited.</p>
                                    </div>
                                    <button onClick={handleSaveProfile} className="btn btn-primary mt-lg">💾 Save Settings</button>
                                    <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 'var(--space-xl) 0' }} />
                                    <button onClick={handleLogout} className="btn btn-ghost" style={{ color: '#ef4444' }}>🚪 Logout</button>
                              </div>
                        )}

                        {activeTab === 'stats' && isOwnProfile && user?.stats && (
                              <div className="animate-fadeInUp">
                                    <div className="grid grid-cols-3 gap-lg mb-lg">
                                          <div className="stat-card"><div className="stat-value">{user.stats.contentCount || 0}</div><div className="stat-label">📝 Content Created</div></div>
                                          <div className="stat-card"><div className="stat-value">{user.stats.helpfulReceived || 0}</div><div className="stat-label">👍 Helpful Received</div></div>
                                          <div className="stat-card"><div className="stat-value">{user.stats.helpfulGiven || 0}</div><div className="stat-label">💚 Helpful Given</div></div>
                                    </div>
                                    <div className="card p-md" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)' }}><p className="text-sm" style={{ color: '#22c55e' }}>🔒 Your stats are private and only visible to you</p></div>
                              </div>
                        )}
                  </div>
            </div>
      );
};

export default Profile;
