import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import ContentCard from '../components/Content/ContentCard';
import SpotifySearch from '../components/Music/SpotifySearch';
import { useMusic } from '../context/MusicContext';
import UserAvatar from '../components/User/UserAvatar';
import CricketGame from '../components/Games/CricketGame';
import { CheckIcon, MessageIcon, UserPlusIcon } from '../components/Icons/ActionIcons';

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
      const { user, token, isAuthenticated, updateProfile, logout, blockUser, unblockUser, updateFollowState } = useAuth();
      const navigate = useNavigate();
      const fileInputRef = useRef(null);
      const { playTrack, stopTrack, currentTrack, isPlaying: isMusicPlayingGlobal } = useMusic();

      const [profileUser, setProfileUser] = useState(() => {
            const targetUsername = username || user?.username;
            if (user && targetUsername === user.username) return user;
            try {
                  const cached = localStorage.getItem(`zuno_profile_cache_${targetUsername}`);
                  if (cached) return JSON.parse(cached);
            } catch (e) { }
            return null;
      });
      const [userPosts, setUserPosts] = useState(() => {
            const targetUsername = username || user?.username;
            if (!targetUsername) return [];
            try {
                  const cached = localStorage.getItem(`zuno_posts_cache_${targetUsername}`);
                  if (cached) return JSON.parse(cached);
            } catch (e) { }
            return [];
      });
      const [loading, setLoading] = useState(() => {
            const targetUsername = username || user?.username;
            // Never show loading if we have cached data OR if it's own profile (already in context)
            if (user && targetUsername === user.username) return false;
            try {
                  if (localStorage.getItem(`zuno_profile_cache_${targetUsername}`)) return false;
            } catch (e) { }
            return true; // Only show loading if NO cache at all
      });
      const [editing, setEditing] = useState(false);
      const [editData, setEditData] = useState({});
      const [message, setMessage] = useState('');
      const [uploadingPhoto, setUploadingPhoto] = useState(false);
      const [activeTab, setActiveTab] = useState('profile');
      const [isFollowing, setIsFollowing] = useState(false);
      const [followRequested, setFollowRequested] = useState(false);
      const [isBlocked, setIsBlocked] = useState(false);
      const [followLoading, setFollowLoading] = useState(false);
      const [blockLoading, setBlockLoading] = useState(false);
      const [showPhotoModal, setShowPhotoModal] = useState(false);
      const [openPostIdx, setOpenPostIdx] = useState(null);
      const [verificationReqMsg, setVerificationReqMsg] = useState('');
      const [verificationReqLoading, setVerificationReqLoading] = useState(false);
      const [quickChatText, setQuickChatText] = useState('');
      const [sendingQuickChat, setSendingQuickChat] = useState(false);


      // Followers/Following modal states
      const [showFollowersModal, setShowFollowersModal] = useState(false);
      const [showFollowingModal, setShowFollowingModal] = useState(false);
      const [followersList, setFollowersList] = useState([]);
      const [followingList, setFollowingList] = useState([]);
      const [modalLoading, setModalLoading] = useState(false);

      // Total views for content
      const [totalViews, setTotalViews] = useState(0);

      const isOwnProfile = !username || (user && user.username === username);

      // Refresh profile when page becomes visible (for dynamic updates)
      useEffect(() => {
            const handleVisibilityChange = () => {
                  if (document.visibilityState === 'visible') {
                        const tUsername = username || user?.username;
                        if (tUsername) refreshProfile(tUsername);
                  }
            };
            document.addEventListener('visibilitychange', handleVisibilityChange);
            return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
            // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [username, user?.username]);

      const refreshProfile = async (targetUsername) => {
            const tUser = targetUsername || username || user?.username;
            if (!tUser) return;
            // Run both in parallel for speed
            Promise.all([
                  fetch(`${API_URL}/users/${encodeURIComponent(tUser)}`)
                        .then(r => r.json())
                        .then(data => { if (data.success) setProfileUser(data.data.user); })
                        .catch(e => console.error('Failed to refresh profile:', e)),
                  fetchUserPosts(tUser)
            ]);
      };

      useEffect(() => {
            const targetUsername = username || user?.username;
            if (!targetUsername) return;

            // If we already have cached data, DON'T show loading at all
            setLoading(!profileUser);

            // Run profile fetch and posts fetch IN PARALLEL for speed
            const fetchProfileData = async () => {
                  try {
                        const encodedUsername = encodeURIComponent(targetUsername);
                        const res = await fetch(`${API_URL}/users/${encodedUsername}`);
                        const data = await res.json();
                        if (data.success) {
                              if (username && data.data.user?.username && data.data.user.username !== username) {
                                    navigate(`/u/${data.data.user.username}`, { replace: true });
                              }
                              setProfileUser(data.data.user);
                              try {
                                    localStorage.setItem(`zuno_profile_cache_${targetUsername}`, JSON.stringify(data.data.user));
                              } catch (e) { }
                              if (isOwnProfile) {
                                    setEditData({
                                          displayName: data.data.user.displayName || '',
                                          bio: data.data.user.bio || '',
                                          avatar: data.data.user.avatar || '',
                                          interests: data.data.user.interests || [],
                                          preferredFeedMode: data.data.user.preferredFeedMode || 'learning',
                                          focusModeEnabled: data.data.user.focusModeEnabled || false,
                                          dailyUsageLimit: data.data.user.dailyUsageLimit || 0,
                                          profileSong: data.data.user.profileSong || null
                                    });
                              }
                        }
                  } catch (error) {
                        console.error('Failed to fetch profile:', error);
                  } finally {
                        setLoading(false);
                  }
            };

            // Both run at the same time - no need to wait for profile before loading posts
            Promise.all([fetchProfileData(), fetchUserPosts(targetUsername)]);
            // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [username, user]);

      // Auto-play removed per user request

      // Global cleanup: Stop the track when completely leaving the profile page
      useEffect(() => {
            return () => {
                  stopTrack();
            };
      }, [stopTrack]);

      const [postsError, setPostsError] = useState('');

      const fetchUserPosts = async (uname) => {
            setPostsError('');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout for mobile

            try {
                  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
                  const encodedUname = encodeURIComponent(uname);
                  const res = await fetch(`${API_URL}/feed/creator/${encodedUname}`, {
                        headers,
                        signal: controller.signal
                  });
                  clearTimeout(timeoutId);
                  const data = await res.json();

                  if (data.success) {
                        let posts = [];
                        if (data.data?.contents) {
                              posts = data.data.contents;
                        } else if (Array.isArray(data.data)) {
                              posts = data.data;
                        } else if (data.contents) {
                              posts = data.contents;
                        }

                        if (!Array.isArray(posts)) posts = [];

                        setUserPosts(posts);

                        try {
                              localStorage.setItem(`zuno_posts_cache_${uname}`, JSON.stringify(posts));
                        } catch (e) { }

                        const views = posts.reduce((sum, post) => sum + (post.metrics?.viewCount || 0), 0);
                        setTotalViews(views);
                  } else {
                        setPostsError('Failed to load posts.');
                  }
            } catch (error) {
                  clearTimeout(timeoutId);
                  if (error.name !== 'AbortError') console.error('Failed to fetch user posts:', error);
                  if (error.name === 'AbortError') {
                        setPostsError('Server slow. Showing cached content.');
                  }
                  // Restore from cache silently
                  try {
                        const cached = localStorage.getItem(`zuno_posts_cache_${uname}`);
                        if (cached) setUserPosts(JSON.parse(cached));
                  } catch (e) { }
            }
      };

      // Fetch followers list
      const fetchFollowers = async () => {
            const targetUsername = profileUser?.username || user?.username;
            if (!targetUsername) return;

            setShowFollowersModal(true);
            setModalLoading(true);
            setFollowersList([]);

            try {
                  const encodedUsername = encodeURIComponent(targetUsername);
                  const res = await fetch(`${API_URL}/users/${encodedUsername}/followers`);
                  const data = await res.json();

                  if (data.success) {
                        setFollowersList(data.data.followers || []);
                        console.log('Followers loaded:', data.data.followers?.length || 0);
                  } else {
                        console.error('Failed to fetch followers:', data.message);
                        setMessage('⚠️ Failed to load followers');
                        setTimeout(() => setMessage(''), 3000);
                  }
            } catch (error) {
                  console.error('Error fetching followers:', error);
                  setMessage('⚠️ Could not connect to server');
                  setTimeout(() => setMessage(''), 3000);
            } finally {
                  setModalLoading(false);
            }
      };

      // Fetch following list
      const fetchFollowing = async () => {
            const targetUsername = profileUser?.username || user?.username;
            if (!targetUsername) return;

            setShowFollowingModal(true);
            setModalLoading(true);
            setFollowingList([]);

            try {
                  const encodedUsername = encodeURIComponent(targetUsername);
                  const res = await fetch(`${API_URL}/users/${encodedUsername}/following`);
                  const data = await res.json();

                  if (data.success) {
                        setFollowingList(data.data.following || []);
                        console.log('Following loaded:', data.data.following?.length || 0);
                  } else {
                        console.error('Failed to fetch following:', data.message);
                        setMessage('⚠️ Failed to load following list');
                        setTimeout(() => setMessage(''), 3000);
                  }
            } catch (error) {
                  console.error('Error fetching following:', error);
                  setMessage('⚠️ Could not connect to server');
                  setTimeout(() => setMessage(''), 3000);
            } finally {
                  setModalLoading(false);
            }
      };

      // Handle delete content from profile
      const handleDeleteContent = (contentId) => {
            setUserPosts(prev => prev.filter(post => post._id !== contentId));
      };

      // Check if current user follows or blocks this profile
      useEffect(() => {
            if (!isOwnProfile && profileUser && user) {
                  // Check following
                  const following = user.following || [];
                  setIsFollowing(following.some(id => id?.toString() === profileUser._id?.toString()));
                  setFollowRequested(false);

                  // Check blocked
                  const blocked = user.blockedUsers || [];
                  setIsBlocked(blocked.some(id => id?.toString() === profileUser._id?.toString()));
            }
      }, [profileUser, user, isOwnProfile]);

      const handleFollow = async () => {
            if (!token || !profileUser) return;
            if (isBlocked) {
                  setMessage('⚠️ Please unblock this user first');
                  setTimeout(() => setMessage(''), 3000);
                  return;
            }
            setFollowLoading(true);
            try {
                  const endpoint = (isFollowing || followRequested) ? 'unfollow' : 'follow';
                  const res = await fetch(`${API_URL}/users/${profileUser._id}/${endpoint}`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        const nextIsFollowing = data.status === 'following' || data.data?.isFollowing === true;
                        const nextIsRequested = data.status === 'requested' || data.data?.isRequested === true;

                        setIsFollowing(nextIsFollowing);
                        setFollowRequested(nextIsRequested);
                        updateFollowState(profileUser._id, nextIsFollowing);
                        setProfileUser(prev => ({
                              ...prev,
                              followersCount: data.data?.followersCount ?? prev.followersCount ?? 0
                        }));
                        setMessage(data.message);
                        setTimeout(() => setMessage(''), 3000);
                  }
            } catch (error) {
                  console.error('Failed to toggle follow:', error);
            }
            setFollowLoading(false);
      };

      const handleQuickSend = async (e) => {
            if (e) e.preventDefault();
            if (!quickChatText.trim() || !token || !profileUser) return;

            setSendingQuickChat(true);
            try {
                  const res = await fetch(`${API_URL}/messages/${profileUser._id}`, {
                        method: 'POST',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ text: quickChatText.trim() })
                  });
                  const data = await res.json();
                  if (data.success) {
                        setQuickChatText('');
                        setMessage('✅ Message sent successfully!');
                        setTimeout(() => setMessage(''), 3000);
                  } else {
                        setMessage('⚠️ ' + data.message);
                  }
            } catch (err) {
                  setMessage('⚠️ Failed to send message');
            } finally {
                  setSendingQuickChat(false);
            }
      };

      const handleBlockToggle = async () => {
            if (!token || !profileUser) return;
            if (!isBlocked && !window.confirm(`Are you sure you want to block ${profileUser.displayName || profileUser.username}? They will no longer be able to message you or see your profile.`)) return;

            setBlockLoading(true);
            try {
                  const res = isBlocked
                        ? await unblockUser(profileUser._id)
                        : await blockUser(profileUser._id);

                  if (res.success) {
                        setIsBlocked(!isBlocked);
                        if (!isBlocked) {
                              setIsFollowing(false);
                              setFollowRequested(false);
                              updateFollowState(profileUser._id, false);
                              // Update followers count as blocking auto-unfollows
                              setProfileUser(prev => ({
                                    ...prev,
                                    followersCount: Math.max(0, (prev.followersCount || 0) - (isFollowing ? 1 : 0))
                              }));
                        }
                        setMessage(res.message);
                        setTimeout(() => setMessage(''), 3000);
                  } else {
                        setMessage('⚠️ ' + res.message);
                        setTimeout(() => setMessage(''), 3000);
                  }
            } catch (error) {
                  console.error('Block toggle failed:', error);
            } finally {
                  setBlockLoading(false);
            }
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
            // Ensure profileSong mapping retains necessary fields from editData
            const dataToSave = { ...editData };
            const result = await updateProfile(dataToSave);
            
            if (result.success) {
                  setMessage('✅ Profile updated successfully!');
                  
                  // Clear strict caches immediately to ensure refreshing displays the new song
                  const targetUsername = user?.username;
                  if (targetUsername) {
                        try {
                              localStorage.removeItem(`zuno_profile_cache_${targetUsername}`);
                        } catch (e) {}
                  }
                  
                  // Hard update state with latest context data from result
                  if (result.data?.user) {
                        setProfileUser(result.data.user);
                  } else {
                        setProfileUser(prev => ({ ...prev, ...dataToSave }));
                  }
                  
                  setEditing(false);
                  
                  // Fetch freshly to be 100% sure the profileSong populates properly in the UI
                  refreshProfile(user?.username);
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

      const handleRequestVerification = async () => {
            if (!token) return;
            setVerificationReqLoading(true);
            setVerificationReqMsg('');
            try {
                  const res = await fetch(`${API_URL}/users/request-verification`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ reason: 'Public figure / notable account' })
                  });
                  const data = await res.json();
                  setVerificationReqMsg(data.message || (data.success ? '✅ Request submitted!' : '⚠️ Failed'));
                  setTimeout(() => setVerificationReqMsg(''), 5000);
            } catch {
                  setVerificationReqMsg('⚠️ Network error. Please try again.');
            } finally {
                  setVerificationReqLoading(false);
            }
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
                              {/* Silent loading */}
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
            <>
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
                                                      onClick={() => profileUser.avatar ? setShowPhotoModal(true) : null}
                                                      style={{
                                                            cursor: profileUser.avatar ? 'pointer' : 'default',
                                                            transition: 'all 0.3s ease',
                                                            border: '3px solid rgba(99, 102, 241, 0.5)',
                                                            position: 'relative',
                                                            overflow: 'hidden',
                                                            borderRadius: '50%',
                                                            width: '100px',
                                                            height: '100px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                      }}
                                                      onMouseOver={(e) => isOwnProfile && (e.currentTarget.style.transform = 'scale(1.05)')}
                                                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                >
                                                      {uploadingPhoto ? (
                                                            <span style={{ fontSize: '1.5rem' }}>⏳</span>
                                                      ) : (
                                                            <UserAvatar
                                                                  user={profileUser}
                                                                  size={94}
                                                                  style={{ border: 'none' }}
                                                            />
                                                      )}

                                                      {/* Play button on Avatar */}
                                                      {profileUser.profileSong && profileUser.profileSong.previewUrl && (
                                                            <button
                                                                  onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId) {
                                                                              stopTrack();
                                                                        } else {
                                                                              playTrack(profileUser.profileSong);
                                                                        }
                                                                  }}
                                                                  style={{
                                                                        position: 'absolute',
                                                                        inset: 0,
                                                                        background: (isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId) ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.25)',
                                                                        border: 'none',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        color: 'white',
                                                                        fontSize: '24px',
                                                                        borderRadius: '50%',
                                                                        opacity: (isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId) ? 1 : 0,
                                                                        transition: 'opacity 0.2s',
                                                                        cursor: 'pointer'
                                                                  }}
                                                                  className="avatar-play-btn"
                                                                  onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                                                                  onMouseLeave={(e) => {
                                                                        if (!(isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId)) {
                                                                              e.currentTarget.style.opacity = 0;
                                                                        }
                                                                  }}
                                                            >
                                                                  {(isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId) ? (
                                                                        <div className="flex gap-[3px] items-center h-5">
                                                                              <div className="w-[4px] bg-white h-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                                                                              <div className="w-[4px] bg-white h-2/3 animate-pulse" style={{ animationDelay: '150ms' }}></div>
                                                                              <div className="w-[4px] bg-white h-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                                                                        </div>
                                                                  ) : '▶️'}
                                                            </button>
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
                                                                  fontSize: '1rem',
                                                                  zIndex: 10
                                                            }}
                                                      >
                                                            📷
                                                      </div>
                                                )}

                                                {/* Smaller music indicator badge */}
                                                {profileUser.profileSong && (
                                                      <div
                                                            style={{
                                                                  position: 'absolute',
                                                                  top: '0',
                                                                  right: '0',
                                                                  width: '28px',
                                                                  height: '28px',
                                                                  background: '#1DB954', // Spotify green
                                                                  borderRadius: '50%',
                                                                  display: 'flex',
                                                                  alignItems: 'center',
                                                                  justifyContent: 'center',
                                                                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                                                  fontSize: '14px',
                                                                  zIndex: 5,
                                                                  border: '2px solid white'
                                                            }}
                                                      >
                                                            🎶
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
                                                      <div
                                                            className="flex items-center gap-xs cursor-pointer hover:opacity-80 transition-opacity"
                                                            onClick={fetchFollowers}
                                                            style={{ cursor: 'pointer' }}
                                                      >
                                                            <span className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{profileUser.followersCount || 0}</span>
                                                            <span style={{ color: 'var(--color-text-secondary)' }}>Followers</span>
                                                      </div>
                                                      <div
                                                            className="flex items-center gap-xs cursor-pointer hover:opacity-80 transition-opacity"
                                                            onClick={fetchFollowing}
                                                            style={{ cursor: 'pointer' }}
                                                      >
                                                            <span className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{profileUser.followingCount || 0}</span>
                                                            <span style={{ color: 'var(--color-text-secondary)' }}>Following</span>
                                                      </div>
                                                      <div
                                                            className="flex items-center gap-xs cursor-pointer hover:opacity-80 transition-opacity"
                                                            onClick={() => {
                                                                  const postsSection = document.getElementById('posts-section');
                                                                  if (postsSection) {
                                                                        postsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                                  }
                                                            }}
                                                            style={{ cursor: 'pointer' }}
                                                      >
                                                            <span className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{userPosts.length || 0}</span>
                                                            <span style={{ color: 'var(--color-text-secondary)' }}>Posts</span>
                                                      </div>
                                                      {isOwnProfile && totalViews > 0 && (
                                                            <div className="flex items-center gap-xs">
                                                                  <span className="font-bold text-gray-900 text-lg">{totalViews}</span>
                                                                  <span className="text-gray-500">👁 Views</span>
                                                            </div>
                                                      )}
                                                </div>

                                                {profileUser.bio && (
                                                      <p className="text-secondary mt-sm" style={{ maxWidth: '500px' }}>{profileUser.bio}</p>
                                                )}

                                                <div className="flex gap-sm mt-lg flex-wrap" style={{ alignItems: 'center' }}>
                                                      <span className="tag tag-primary" style={{ fontSize: 'var(--font-size-sm)' }}>
                                                            {profileUser.role === 'admin' ? '👑 Admin' :
                                                                  profileUser.role === 'creator' ? '✨ Creator' :
                                                                        profileUser.role === 'mentor' ? '🎓 Mentor' : '👤 User'}
                                                      </span>
                                                      {profileUser.isVerified && (
                                                            <span style={{
                                                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                                  background: 'linear-gradient(135deg,rgba(59,130,246,.15),rgba(99,102,241,.15))',
                                                                  border: '1px solid rgba(59,130,246,.4)', borderRadius: '99px',
                                                                  padding: '3px 12px', fontSize: '.82rem', fontWeight: 800,
                                                                  color: '#3b82f6', boxShadow: '0 0 14px rgba(59,130,246,.25)'
                                                            }}>
                                                                  ✓ Verified
                                                            </span>
                                                      )}
                                                      {isOwnProfile && !profileUser.isVerified && profileUser.verificationRequest?.status === 'pending' && (
                                                            <span style={{ background:'rgba(245,158,11,.12)', border:'1px solid rgba(245,158,11,.3)', borderRadius:'99px', padding:'3px 10px', fontSize:'.75rem', color:'#f59e0b', fontWeight:700 }}>
                                                                  ⏳ Verification Pending
                                                            </span>
                                                      )}
                                                      {isOwnProfile && !profileUser.isVerified && profileUser.verificationRequest?.status === 'rejected' && (
                                                            <span style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)', borderRadius:'99px', padding:'3px 10px', fontSize:'.75rem', color:'#ef4444', fontWeight:700 }}>
                                                                  ✗ Verification Rejected
                                                            </span>
                                                      )}
                                                </div>


                                                {/* Profile Song Display (Magic Bar Style) */}
                                                <style>{`
                                                      @keyframes magicRecordSpin { 100% { transform: rotate(360deg); } }
                                                      @keyframes magicMusicBar { 0% { height: 30%; } 50% { height: 100%; } 100% { height: 30%; } }
                                                `}</style>
                                                {profileUser.profileSong && profileUser.profileSong.name ? (
                                                      <div
                                                            className="mt-lg animate-fadeInUp magic-music-bar"
                                                            style={{
                                                                  position: 'relative',
                                                                  background: (isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId) 
                                                                        ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))' 
                                                                        : 'rgba(255, 255, 255, 0.4)',
                                                                  backdropFilter: 'blur(12px)',
                                                                  border: (isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId)
                                                                        ? '1px solid rgba(168,85,247,0.4)'
                                                                        : '1px solid rgba(255, 255, 255, 0.3)',
                                                                  borderRadius: '99px',
                                                                  padding: '8px 16px 8px 8px',
                                                                  display: 'inline-flex',
                                                                  alignItems: 'center',
                                                                  gap: '12px',
                                                                  boxShadow: (isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId)
                                                                        ? '0 0 20px rgba(168,85,247,0.2), 0 4px 15px rgba(0,0,0,0.05)'
                                                                        : '0 4px 15px rgba(0, 0, 0, 0.05)',
                                                                  maxWidth: '100%',
                                                                  cursor: 'pointer',
                                                                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                  transform: (isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId) ? 'scale(1.02)' : 'scale(1)'
                                                            }}
                                                            onClick={(e) => {
                                                                  if (isOwnProfile) {
                                                                        setEditing(true);
                                                                        setTimeout(() => {
                                                                              const searchSection = document.getElementById('spotify-search-input');
                                                                              if (searchSection) searchSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                        }, 100);
                                                                  } else if (profileUser.profileSong.previewUrl) {
                                                                        e.stopPropagation();
                                                                        if (isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId) {
                                                                              stopTrack();
                                                                        } else {
                                                                              playTrack(profileUser.profileSong);
                                                                        }
                                                                  }
                                                            }}
                                                            onMouseOver={(e) => { if (!isMusicPlayingGlobal) e.currentTarget.style.transform = 'scale(1.02)' }}
                                                            onMouseOut={(e) => { if (!(isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId)) e.currentTarget.style.transform = 'scale(1)' }}
                                                      >
                                                            {/* Spinning Vinyl Record Effect */}
                                                            <div 
                                                                  style={{ 
                                                                        position: 'relative', 
                                                                        width: '44px', 
                                                                        height: '44px', 
                                                                        flexShrink: 0,
                                                                        borderRadius: '50%',
                                                                        overflow: 'hidden',
                                                                        background: '#000',
                                                                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                                                        cursor: 'pointer'
                                                                  }}
                                                                  onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId) stopTrack();
                                                                        else if (profileUser.profileSong.previewUrl) playTrack(profileUser.profileSong);
                                                                  }}
                                                            >
                                                                  <div style={{
                                                                        position: 'absolute', inset: 0,
                                                                        animation: (isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId)
                                                                              ? 'magicRecordSpin 3s linear infinite' : 'none',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                  }}>
                                                                        <img
                                                                              src={profileUser.profileSong.albumArt || 'https://images.unsplash.com/photo-1514525253361-bee21394f6c1?w=100&h=100&fit=crop&q=80'}
                                                                              alt=""
                                                                              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                                                                        />
                                                                        <div style={{ position: 'absolute', width: '12px', height: '12px', background: '#fff', borderRadius: '50%', border: '2px solid #111' }} />
                                                                  </div>
                                                                  
                                                                  {/* Play / Pause Overlay Icon */}
                                                                  <div style={{ 
                                                                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        background: 'rgba(0,0,0,0.3)', opacity: 0, transition: 'opacity 0.2s'
                                                                  }}
                                                                  onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                                                                  onMouseOut={(e) => e.currentTarget.style.opacity = 0}
                                                                  >
                                                                        {(isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId) ? '⏸️' : '▶️'}
                                                                  </div>
                                                            </div>

                                                            <div className="flex-1 min-w-0" style={{ textAlign: 'left' }}>
                                                                  <div className="font-bold text-sm truncate" style={{
                                                                        background: (isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId)
                                                                              ? 'linear-gradient(to right, #6366f1, #a855f7)'
                                                                              : 'var(--text-primary)',
                                                                        WebkitBackgroundClip: (isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId) ? 'text' : 'inherit',
                                                                        WebkitTextFillColor: (isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId) ? 'transparent' : 'inherit',
                                                                  }}>{profileUser.profileSong.name}</div>
                                                                  <div className="text-xs text-muted truncate">{profileUser.profileSong.artist}</div>
                                                            </div>
                                                            
                                                            {/* Animated Music Bars */}
                                                            {(isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId) ? (
                                                                  <div className="flex gap-[3px] items-center h-4 ml-2 mr-1">
                                                                        <div className="w-[3px] rounded-full bg-indigo-500" style={{ animation: 'magicMusicBar 0.8s ease-in-out infinite alternate', animationDelay: '0ms' }}></div>
                                                                        <div className="w-[3px] rounded-full bg-purple-500" style={{ animation: 'magicMusicBar 0.8s ease-in-out infinite alternate', animationDelay: '200ms' }}></div>
                                                                        <div className="w-[3px] rounded-full bg-pink-500" style={{ animation: 'magicMusicBar 0.8s ease-in-out infinite alternate', animationDelay: '400ms' }}></div>
                                                                  </div>
                                                            ) : isOwnProfile && (
                                                                  <div className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full ml-2 shadow-sm border border-indigo-100">EDIT</div>
                                                            )}
                                                      </div>
                                                ) : isOwnProfile && (
                                                      <div
                                                            className="mt-lg animate-fadeInUp"
                                                            style={{
                                                                  display: 'inline-flex',
                                                                  alignItems: 'center',
                                                                  gap: '8px',
                                                                  padding: '8px 16px',
                                                                  background: 'var(--gradient-primary)',
                                                                  color: 'white',
                                                                  borderRadius: '20px',
                                                                  fontSize: '0.85rem',
                                                                  fontWeight: '600',
                                                                  cursor: 'pointer',
                                                                  boxShadow: 'var(--shadow-md)',
                                                                  transition: 'all 0.2s ease'
                                                            }}
                                                            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                                            onClick={() => {
                                                                  setEditing(true);
                                                                  setTimeout(() => {
                                                                        const searchDiv = document.getElementById('spotify-search-wrapper');
                                                                        if (searchDiv) searchDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                  }, 100);
                                                            }}
                                                      >
                                                            <span>🎵 Add Music to Profile</span>
                                                      </div>
                                                )}
                                          </div>
                                    </div>

                                    {/* Action Buttons */}
                                    {isOwnProfile ? (
                                          <div className="flex gap-md flex-wrap w-full mt-sm">
                                                <button
                                                      onClick={() => setEditing(!editing)}
                                                      className={`btn ${editing ? 'btn-ghost' : 'btn-secondary'} flex-1 min-w-[120px]`}
                                                >
                                                      {editing ? '❌ Cancel' : '✏️ Edit Profile'}
                                                </button>
                                                <button
                                                      onClick={() => navigate('/messages')}
                                                      className="btn btn-secondary flex-1 min-w-[120px]"
                                                      style={{ position: 'relative' }}
                                                >
                                                      💬 Messages
                                                </button>
                                                <button
                                                      onClick={() => navigate('/settings')}
                                                      className="btn btn-secondary flex-1 min-w-[120px]"
                                                >
                                                      ⚙️ Settings
                                                </button>
                                                {profileUser?.role === 'admin' && (
                                                      <button
                                                            onClick={() => navigate('/admin')}
                                                            className="btn btn-primary flex-1 min-w-[140px]"
                                                      >
                                                            Admin Panel
                                                      </button>
                                                )}
                                                {/* Request Blue Tick — only shown if not already verified and not pending */}
                                                {!profileUser?.isVerified && profileUser?.verificationRequest?.status !== 'pending' && (
                                                      <button
                                                            onClick={handleRequestVerification}
                                                            disabled={verificationReqLoading}
                                                            className="btn btn-ghost flex-1 min-w-[140px]"
                                                            style={{
                                                                  background: 'linear-gradient(135deg,rgba(59,130,246,.1),rgba(99,102,241,.1))',
                                                                  border: '1px solid rgba(59,130,246,.3)',
                                                                  color: '#3b82f6', fontWeight: 700,
                                                                  transition: 'all .2s'
                                                            }}
                                                      >
                                                            {verificationReqLoading ? '⏳ Sending...' : '✓ Request Verification'}
                                                      </button>
                                                )}
                                          </div>
                                    ) : isAuthenticated && (
                                          <>
                                                <div className="flex gap-md flex-wrap w-full mt-sm">
                                                <button
                                                      onClick={handleFollow}
                                                      disabled={followLoading}
                                                      className={`btn ${(isFollowing || followRequested) ? 'btn-secondary' : 'btn-primary'} flex-1 min-w-[120px]`}
                                                >
                                                      {followLoading ? (
                                                            <span>Loading...</span>
                                                      ) : followRequested ? (
                                                            <span className="flex items-center justify-center gap-sm">
                                                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <circle cx="12" cy="12" r="9" />
                                                                        <path d="M12 7v5l3 2" />
                                                                  </svg>
                                                                  Requested
                                                            </span>
                                                      ) : isFollowing ? (
                                                            <span className="flex items-center justify-center gap-sm">
                                                                  <CheckIcon size={16} />
                                                                  Following
                                                            </span>
                                                      ) : (
                                                            <span className="flex items-center justify-center gap-sm">
                                                                  <UserPlusIcon size={16} />
                                                                  Follow
                                                            </span>
                                                      )}
                                                </button>
                                                <button
                                                      onClick={() => {
                                                            setActiveTab('chat');
                                                            setTimeout(() => {
                                                                  const chatSection = document.getElementById('chat-tab-section');
                                                                  if (chatSection) chatSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            }, 50);
                                                      }}
                                                      className={`btn ${activeTab === 'chat' ? 'btn-primary' : 'btn-secondary'} flex-1 min-w-[120px]`}
                                                >
                                                      <span className="flex items-center justify-center gap-sm">
                                                            <MessageIcon size={16} />
                                                            Message
                                                      </span>
                                                </button>
                                                <button
                                                      onClick={handleBlockToggle}
                                                      disabled={blockLoading}
                                                      className="btn btn-ghost text-red-500 hover:bg-red-50 flex-1 min-w-[120px]"
                                                      style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                                >
                                                      {blockLoading ? (
                                                            'Loading...'
                                                      ) : (
                                                            <span className="flex items-center justify-center gap-sm">
                                                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <circle cx="12" cy="12" r="9" />
                                                                        <path d="M8.5 8.5l7 7" />
                                                                  </svg>
                                                                  {isBlocked ? 'Unblock' : 'Block'}
                                                            </span>
                                                      )}
                                                </button>
                                                </div>

                                                <div className="flex gap-md flex-wrap w-full mt-sm" style={{ display: 'none' }}>
                                                <button
                                                      onClick={handleFollow}
                                                      disabled={followLoading}
                                                      className={`btn ${(isFollowing || followRequested) ? 'btn-secondary' : 'btn-primary'} flex-1 min-w-[120px]`}
                                                >
                                                      {followLoading ? (
                                                            <span style={{ fontSize: '16px' }}>⏳</span>
                                                      ) : followRequested ? (
                                                            'Requested'
                                                      ) : isFollowing ? (
                                                            '✓ Following'
                                                      ) : (
                                                            '+ Follow'
                                                      )}
                                                </button>
                                                <button
                                                      onClick={() => {
                                                            setActiveTab('chat');
                                                            setTimeout(() => {
                                                                  const chatSection = document.getElementById('chat-tab-section');
                                                                  if (chatSection) chatSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            }, 50);
                                                      }}
                                                      className={`btn ${activeTab === 'chat' ? 'btn-primary' : 'btn-secondary'} flex-1 min-w-[120px]`}
                                                >
                                                      💬 Message
                                                </button>
                                                <button
                                                      onClick={handleBlockToggle}
                                                      disabled={blockLoading}
                                                      className="btn btn-ghost text-red-500 hover:bg-red-50 flex-1 min-w-[120px]"
                                                      style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                                >
                                                      {blockLoading ? '⏳' : isBlocked ? '🔓 Unblock' : '🚫 Block'}
                                                </button>
                                                </div>
                                          </>
                                    )}
                              </div>
                        </div>

                        {/* Middle Tabs - now includes Chat for visitors */}
                        <div className="mode-pills mb-xl animate-fadeIn" style={{ maxWidth: '600px' }}>
                              {!isOwnProfile && <button className={`mode-pill ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>💬 Chat</button>}
                              <button className={`mode-pill ${activeTab === 'posts' || activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab(isOwnProfile ? 'profile' : 'posts')}>📝 Posts</button>
                              {isOwnProfile && (
                                    <>
                                          <button className={`mode-pill ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>⚙️ Settings</button>
                                          <button className={`mode-pill ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>📊 Stats</button>
                                          <button className={`mode-pill ${activeTab === 'games' ? 'active' : ''}`} onClick={() => setActiveTab('games')}>🏏 Games</button>
                                    </>
                              )}
                        </div>

                        {/* Verification request feedback */}
                        {verificationReqMsg && (
                              <div className="card p-md mb-lg animate-fadeIn" style={{
                                    background: verificationReqMsg.includes('✅') ? 'rgba(59,130,246,.1)' : 'rgba(245,158,11,.1)',
                                    borderColor: verificationReqMsg.includes('✅') ? 'rgba(59,130,246,.3)' : 'rgba(245,158,11,.3)'
                              }}>
                                    <p>{verificationReqMsg}</p>
                              </div>
                        )}

                        {message && (
                              <div className="card p-md mb-lg animate-fadeIn" style={{
                                    background: message.includes('✅') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    borderColor: message.includes('✅') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                              }}>
                                    <p>{message}</p>
                              </div>
                        )}


                        {false && isOwnProfile && (
                              <div className="mode-pills mb-xl" style={{ maxWidth: '500px' }}>
                                    <button className={`mode-pill ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>👤 Profile</button>
                                    <button className={`mode-pill ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>⚙️ Settings</button>
                                    <button className={`mode-pill ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>📊 Stats</button>
                                    <button className={`mode-pill ${activeTab === 'games' ? 'active' : ''}`} onClick={() => setActiveTab('games')}>🏏 Games</button>
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
                                    <div className="input-group mt-lg" id="spotify-search-wrapper">
                                          <SpotifySearch
                                                selectedTrack={editData.profileSong}
                                                onSelect={(track) => setEditData(prev => ({ ...prev, profileSong: track }))}
                                                inputId="spotify-search-input"
                                          />
                                    </div>
                                    <div className="flex gap-md mt-xl">
                                          <button onClick={handleSaveProfile} className="btn btn-primary">💾 Save Changes</button>
                                          <button onClick={() => setEditing(false)} className="btn btn-ghost">Cancel</button>
                                    </div>
                              </div>
                        )}

                        {activeTab === 'chat' && !isOwnProfile && (
                              <div id="chat-tab-section" className="card animate-fadeInUp mb-xl" style={{ border: '2px solid rgba(99, 102, 241, 0.3)', padding: '24px' }}>
                                    <div className="flex items-center gap-sm mb-lg">
                                          <div style={{ fontSize: '1.8rem' }}>💬</div>
                                          <h2 className="text-2xl font-bold">Quick Message to {profileUser.displayName || profileUser.username}</h2>
                                    </div>
                                    <p className="text-muted mb-lg" style={{ fontSize: '1.05rem' }}>Send a professional direct message instantly. It will appear immediately in their inbox.</p>
                                    <form onSubmit={handleQuickSend} className="flex flex-col gap-md">
                                          <textarea 
                                                className="input" 
                                                rows={5} 
                                                value={quickChatText} 
                                                onChange={(e) => setQuickChatText(e.target.value)} 
                                                placeholder={`Write your message to ${profileUser.username}...`}
                                                style={{ resize: 'none', fontSize: '1.1rem', padding: '18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99, 102, 241, 0.2)' }}
                                                onKeyDown={(e) => {
                                                      if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleQuickSend();
                                                      }
                                                }}
                                          />
                                          <button 
                                                type="submit" 
                                                disabled={sendingQuickChat || !quickChatText.trim()}
                                                className="btn btn-primary w-full"
                                                style={{ padding: '16px', fontSize: '1.2rem', fontWeight: 700, boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)' }}
                                          >
                                                {sendingQuickChat ? '⏳ Sending...' : '✈️ Send Message Now'}
                                          </button>
                                    </form>
                                    <div className="mt-xl p-lg bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-md text-sm text-indigo-700">
                                          <span style={{ fontSize: '1.4rem' }}>💡</span>
                                          <div>
                                                <p style={{ fontWeight: 700, marginBottom: '4px' }}>Engagement Tip</p>
                                                <p>For high-quality collaboration, voice/video calls, or sharing files, please visit the <strong>Full Messages</strong> section in the main menu.</p>
                                          </div>
                                    </div>
                              </div>
                        )}

                        {(activeTab === 'profile' || activeTab === 'posts') && !editing && (
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

                                    {/* User Posts - Instagram Grid */}
                                    <div id="posts-section" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '2px' }}>
                                          {postsError && (
                                                <div className="card p-md mb-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', margin: '16px' }}>
                                                      <p className="text-center text-red-500">{postsError}</p>
                                                      <button onClick={() => fetchUserPosts(profileUser.username)} className="btn btn-primary mt-sm mx-auto flex">🔄 Retry</button>
                                                </div>
                                          )}

                                          {!postsError && userPosts.length === 0 && (
                                                <div className="text-center text-gray-500 py-xl">No posts yet.</div>
                                          )}

                                          {!postsError && userPosts.length > 0 && (() => {
                                                const GRADIENTS = [
                                                      'linear-gradient(135deg, #667eea, #764ba2)',
                                                      'linear-gradient(135deg, #f093fb, #f5576c)',
                                                      'linear-gradient(135deg, #4facfe, #00f2fe)',
                                                      'linear-gradient(135deg, #43e97b, #38f9d7)',
                                                      'linear-gradient(135deg, #fa709a, #fee140)',
                                                      'linear-gradient(135deg, #a18cd1, #fbc2eb)',
                                                      'linear-gradient(135deg, #fd746c, #ff9068)',
                                                      'linear-gradient(135deg, #0ba360, #3cba92)',
                                                ];
                                                const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:5000' : '';

                                                return (
                                                      <>
                                                            <div className="profile-posts-grid">
                                                                  {userPosts.map((post, idx) => {
                                                                        const rawMediaType = post.media?.[0]?.type;
                                                                        const rawMediaUrl = post.media?.[0]?.url || (typeof post.media?.[0] === 'string' ? post.media[0] : '');
                                                                        const isVid = post.type === 'short-video' || post.type === 'long-video' ||
                                                                              post.contentType === 'video' || rawMediaType === 'video' ||
                                                                              /\.(mp4|webm|mov|avi|mkv|flv)/i.test(rawMediaUrl);

                                                                        const hasMedia = post.media && post.media.length > 0;
                                                                        const rawUrl = hasMedia ? (post.media[0]?.url || post.media[0]) : null;
                                                                        const thumbnailRaw = hasMedia ? post.media[0]?.thumbnail : null;
                                                                        
                                                                        const resolved = rawUrl && typeof rawUrl === 'string' ? (rawUrl.startsWith('http') ? rawUrl : API_BASE + rawUrl) : null;
                                                                        const resolvedThumb = thumbnailRaw && typeof thumbnailRaw === 'string' ? (thumbnailRaw.startsWith('http') ? thumbnailRaw : API_BASE + thumbnailRaw) : null;
                                                                        const gradient = GRADIENTS[idx % GRADIENTS.length];

                                                                        return (
                                                                              <div key={post._id} className="profile-post-thumb" onClick={() => setOpenPostIdx(idx)}>
                                                                                    {hasMedia ? (
                                                                                          isVid ? (
                                                                                                resolvedThumb ? (
                                                                                                      <img src={resolvedThumb} alt={post.title || 'Video thumbnail'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                                                                                                ) : (
                                                                                                      <video src={resolved ? (resolved + (resolved.includes('#t=') ? '' : '#t=0.1')) : undefined} muted playsInline preload="metadata" style={{ pointerEvents: 'none', width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                                                                )
                                                                                          ) : (
                                                                                                <img src={resolved} alt={post.title || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                                                          )
                                                                                    ) : (
                                                                                          <div style={{ width: '100%', height: '100%', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
                                                                                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'center', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
                                                                                                      {post.title || post.body || '📝'}
                                                                                                </span>
                                                                                          </div>
                                                                                    )}
                                                                                    <div className="profile-post-thumb-overlay">
                                                                                          <span style={{ fontSize: '22px', color: 'white', textShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>{isVid ? '▶️' : '🔍'}</span>
                                                                                    </div>
                                                                                    <div className="profile-post-type-badge">{isVid ? '🎬' : !hasMedia ? '📝' : ''}</div>
                                                                              </div>
                                                                        );
                                                                  })}
                                                            </div>

                                                            {/* ContentCard fullscreen modal for selected thumbnail */}
                                                            {openPostIdx !== null && (
                                                                  <div style={{ position: 'fixed', inset: 0, zIndex: 200000, pointerEvents: 'auto' }}>
                                                                        <ContentCard
                                                                              key={userPosts[openPostIdx]._id}
                                                                              content={userPosts[openPostIdx]}
                                                                              onDelete={handleDeleteContent}
                                                                              autoOpenFullscreen={true}
                                                                              onCloseFullscreen={() => setOpenPostIdx(null)}
                                                                        />
                                                                  </div>
                                                            )}
                                                      </>
                                                );
                                          })()}
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

                        {activeTab === 'games' && isOwnProfile && (
                              <div className="card animate-fadeInUp mb-xl">
                                    <h3 className="text-lg font-semibold mb-lg text-center">🏆 Zuno Cricket</h3>
                                    <CricketGame />
                              </div>
                        )}

                        {/* Photo Modal */}
                        {
                              showPhotoModal && profileUser?.avatar && (
                                    <div
                                          className="modal-overlay"
                                          style={{
                                                position: 'fixed',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background: 'rgba(0,0,0,0.8)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                zIndex: 2000,
                                                backdropFilter: 'blur(4px)'
                                          }}
                                          onClick={() => setShowPhotoModal(false)}
                                    >
                                          <div
                                                style={{
                                                      position: 'relative',
                                                      maxWidth: '90%',
                                                      maxHeight: '90vh'
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                          >
                                                <button
                                                      onClick={() => setShowPhotoModal(false)}
                                                      className="btn btn-ghost"
                                                      style={{
                                                            position: 'absolute',
                                                            top: '-40px',
                                                            right: '0',
                                                            color: 'white',
                                                            background: 'rgba(0,0,0,0.5)',
                                                            borderRadius: '50%',
                                                            width: '40px',
                                                            height: '40px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            padding: '0'
                                                      }}
                                                >✕</button>
                                                <img
                                                      src={profileUser.avatar}
                                                      alt="Profile"
                                                      style={{
                                                            maxWidth: '100%',
                                                            maxHeight: '90vh',
                                                            objectFit: 'contain',
                                                            borderRadius: 'var(--radius-lg)'
                                                      }}
                                                />
                                          </div>
                                    </div>
                              )
                        }

                        {/* Followers Modal */}
                        {
                              showFollowersModal && (
                                    <div
                                          className="modal-overlay"
                                          style={{
                                                position: 'fixed',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background: 'rgba(0,0,0,0.6)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                zIndex: 1000,
                                                backdropFilter: 'blur(4px)'
                                          }}
                                          onClick={() => setShowFollowersModal(false)}
                                    >
                                          <div
                                                className="modal-content card animate-fadeIn"
                                                style={{
                                                      maxWidth: '400px',
                                                      width: '90%',
                                                      maxHeight: '70vh',
                                                      overflow: 'auto'
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                          >
                                                <div className="flex items-center justify-between mb-lg">
                                                      <h3 className="text-lg font-bold">👥 Followers</h3>
                                                      <button
                                                            onClick={() => setShowFollowersModal(false)}
                                                            className="btn btn-ghost btn-sm"
                                                            style={{ padding: '4px 8px' }}
                                                      >✕</button>
                                                </div>
                                                {modalLoading ? (
                                                      <div className="text-center py-lg">
                                                            <span style={{ fontSize: '1.5rem' }}>⏳</span>
                                                      </div>
                                                ) : followersList.length > 0 ? (
                                                      <div className="flex flex-col gap-md">
                                                            {followersList.map(follower => (
                                                                  <div
                                                                        key={follower._id}
                                                                        className="flex items-center gap-md p-sm"
                                                                        style={{
                                                                              background: 'rgba(99, 102, 241, 0.05)',
                                                                              borderRadius: 'var(--radius-md)',
                                                                              cursor: 'pointer'
                                                                        }}
                                                                        onClick={() => {
                                                                              setShowFollowersModal(false);
                                                                              navigate(`/u/${follower.username}`);
                                                                        }}
                                                                  >
                                                                        <div className="avatar avatar-md" style={{ overflow: 'hidden' }}>
                                                                              {follower.avatar ? (
                                                                                    <img src={follower.avatar} alt={follower.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                              ) : (
                                                                                    <span>{follower.displayName?.charAt(0) || follower.username?.charAt(0) || 'U'}</span>
                                                                              )}
                                                                        </div>
                                                                        <div className="flex-1">
                                                                              <div className="font-semibold text-sm">{follower.displayName || follower.username}</div>
                                                                              <div className="text-xs text-gray-500">@{follower.username}</div>
                                                                              {follower.bio && (
                                                                                    <div className="text-xs text-gray-400 mt-xs" style={{
                                                                                          overflow: 'hidden',
                                                                                          textOverflow: 'ellipsis',
                                                                                          whiteSpace: 'nowrap',
                                                                                          maxWidth: '200px'
                                                                                    }}>
                                                                                          {follower.bio}
                                                                                    </div>
                                                                              )}
                                                                        </div>
                                                                        {follower.isVerified && <span className="text-blue-500">✓</span>}
                                                                  </div>
                                                            ))}
                                                      </div>
                                                ) : (
                                                      <div className="text-center text-gray-500 py-lg">No followers yet</div>
                                                )}
                                          </div>
                                    </div>
                              )
                        }

                        {/* Following Modal */}
                        {
                              showFollowingModal && (
                                    <div
                                          className="modal-overlay"
                                          style={{
                                                position: 'fixed',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background: 'rgba(0,0,0,0.6)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                zIndex: 1000,
                                                backdropFilter: 'blur(4px)'
                                          }}
                                          onClick={() => setShowFollowingModal(false)}
                                    >
                                          <div
                                                className="modal-content card animate-fadeIn"
                                                style={{
                                                      maxWidth: '400px',
                                                      width: '90%',
                                                      maxHeight: '70vh',
                                                      overflow: 'auto'
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                          >
                                                <div className="flex items-center justify-between mb-lg">
                                                      <h3 className="text-lg font-bold">👤 Following</h3>
                                                      <button
                                                            onClick={() => setShowFollowingModal(false)}
                                                            className="btn btn-ghost btn-sm"
                                                            style={{ padding: '4px 8px' }}
                                                      >✕</button>
                                                </div>
                                                {modalLoading ? (
                                                      <div className="text-center py-lg">
                                                            <span style={{ fontSize: '1.5rem' }}>⏳</span>
                                                      </div>
                                                ) : followingList.length > 0 ? (
                                                      <div className="flex flex-col gap-md">
                                                            {followingList.map(following => (
                                                                  <div
                                                                        key={following._id}
                                                                        className="flex items-center gap-md p-sm"
                                                                        style={{
                                                                              background: 'rgba(99, 102, 241, 0.05)',
                                                                              borderRadius: 'var(--radius-md)',
                                                                              cursor: 'pointer'
                                                                        }}
                                                                        onClick={() => {
                                                                              setShowFollowingModal(false);
                                                                              navigate(`/u/${following.username}`);
                                                                        }}
                                                                  >
                                                                        <div className="avatar avatar-md" style={{ overflow: 'hidden' }}>
                                                                              {following.avatar ? (
                                                                                    <img src={following.avatar} alt={following.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                              ) : (
                                                                                    <span>{following.displayName?.charAt(0) || following.username?.charAt(0) || 'U'}</span>
                                                                              )}
                                                                        </div>
                                                                        <div className="flex-1">
                                                                              <div className="font-semibold text-sm">{following.displayName || following.username}</div>
                                                                              <div className="text-xs text-gray-500">@{following.username}</div>
                                                                              {following.bio && (
                                                                                    <div className="text-xs text-gray-400 mt-xs" style={{
                                                                                          overflow: 'hidden',
                                                                                          textOverflow: 'ellipsis',
                                                                                          whiteSpace: 'nowrap',
                                                                                          maxWidth: '200px'
                                                                                    }}>
                                                                                          {following.bio}
                                                                                    </div>
                                                                              )}
                                                                        </div>
                                                                        {following.isVerified && <span className="text-blue-500">✓</span>}
                                                                  </div>
                                                            ))}
                                                      </div>
                                                ) : (
                                                      <div className="text-center text-gray-500 py-lg">Not following anyone yet</div>
                                                )}
                                          </div>
                                    </div>
                              )
                        }
                  </div>
            </>
      );
};

export default Profile;
