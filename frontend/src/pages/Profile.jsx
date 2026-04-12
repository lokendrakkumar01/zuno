import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import SpotifySearch from '../components/Music/SpotifySearch';
import { useMusic } from '../context/MusicContext';
import UserAvatar from '../components/User/UserAvatar';
import CricketGame from '../components/Games/CricketGame';
import { BlockIcon, CheckIcon, ClockIcon, EditIcon, MessageIcon, SettingsIcon, UserPlusIcon } from '../components/Icons/ActionIcons';
import { resolveAssetUrl } from '../utils/media';
import { readStoredAuthUser } from '../utils/session';

const INTERESTS = [
      'learning', 'technology', 'creativity', 'health',
      'business', 'science', 'arts', 'lifestyle',
      'problem-solving', 'mentoring'
];

const FEED_MODES = [
      { id: 'learning', label: 'Learning' },
      { id: 'calm', label: 'Calm' },
      { id: 'video', label: 'Video' },
      { id: 'reading', label: 'Reading' },
      { id: 'problem-solving', label: 'Problem Solving' }
];

const buildProfileCacheKey = (username = '') => `zuno_profile_cache_${username}`;
const buildPostsCacheKey = (username = '') => `zuno_posts_cache_${username}`;
const normalizeIdentity = (value = '') => (
      decodeURIComponent(String(value))
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
);

const readCachedValue = (key, fallback) => {
      if (!key) return fallback;

      try {
            const cached = localStorage.getItem(key);
            return cached ? JSON.parse(cached) : fallback;
      } catch {
            return fallback;
      }
};

const writeCachedValue = (key, value) => {
      if (!key) return;

      try {
            localStorage.setItem(key, JSON.stringify(value));
      } catch {
            // Cache writes are best-effort only.
      }
};

const getEditableProfile = (profile = {}) => ({
      displayName: profile.displayName || '',
      bio: profile.bio || '',
      avatar: profile.avatar || '',
      interests: Array.isArray(profile.interests) ? profile.interests : [],
      preferredFeedMode: profile.preferredFeedMode || 'learning',
      focusModeEnabled: Boolean(profile.focusModeEnabled),
      dailyUsageLimit: Number(profile.dailyUsageLimit || 0),
      profileSong: profile.profileSong || null
});

const getPostsViewCount = (posts = []) => (
      Array.isArray(posts)
            ? posts.reduce((sum, post) => sum + (post.metrics?.viewCount || 0), 0)
            : 0
);

const Profile = () => {
      const { username } = useParams();
      const { user, token, isAuthenticated, updateProfile, uploadAvatar, logout, blockUser, unblockUser, updateFollowState } = useAuth();
      const navigate = useNavigate();
      const fileInputRef = useRef(null);
      const { playTrack, stopTrack, currentTrack, isPlaying: isMusicPlayingGlobal } = useMusic();
      const sessionUser = user || readStoredAuthUser();
      const routeIdentity = normalizeIdentity(username);
      const isCanonicalOwnRoute = Boolean(
            sessionUser && routeIdentity && [sessionUser.username, sessionUser.displayName].some((value) => normalizeIdentity(value) === routeIdentity)
      );
      const isOwnProfile = !username || isCanonicalOwnRoute;
      const targetUsername = isOwnProfile ? (sessionUser?.username || username || '') : (username || '');
      const profileCacheKey = targetUsername ? buildProfileCacheKey(targetUsername) : '';
      const postsCacheKey = targetUsername ? buildPostsCacheKey(targetUsername) : '';

      const [profileUser, setProfileUser] = useState(() => {
            if (sessionUser && targetUsername === sessionUser.username) return sessionUser;
            return readCachedValue(profileCacheKey, null);
      });
      const [userPosts, setUserPosts] = useState(() => {
            if (!targetUsername) return [];
            return readCachedValue(postsCacheKey, []);
      });
      const [loading, setLoading] = useState(() => {
            if (sessionUser && targetUsername === sessionUser.username) return false;
            if (isOwnProfile && !targetUsername) return Boolean(token);
            return !readCachedValue(profileCacheKey, null);
      });
      const [editing, setEditing] = useState(false);
      const [editData, setEditData] = useState(() => (isOwnProfile && sessionUser ? getEditableProfile(sessionUser) : {}));
      const [message, setMessage] = useState('');
      const [uploadingPhoto, setUploadingPhoto] = useState(false);
      const [activeTab, setActiveTab] = useState('profile');
      const [isFollowing, setIsFollowing] = useState(false);
      const [followRequested, setFollowRequested] = useState(false);
      const [isBlocked, setIsBlocked] = useState(false);
      const [followLoading, setFollowLoading] = useState(false);
      const [blockLoading, setBlockLoading] = useState(false);
      const [showPhotoModal, setShowPhotoModal] = useState(false);
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
      const [postsError, setPostsError] = useState('');

      // Total views for content
      const [totalViews, setTotalViews] = useState(0);

      const canAccessAdminPanel = isOwnProfile && profileUser?.role === 'admin';

      const fetchProfileRequest = useCallback(async (uname, signal) => {
            const encodedUsername = encodeURIComponent(uname);
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await fetch(`${API_URL}/users/${encodedUsername}`, {
                  headers,
                  signal
            });
            const data = await res.json();

            if (!data.success) {
                  throw new Error(data.message || 'Failed to load profile.');
            }

            return data.data.user;
      }, [token]);

      const fetchUserPosts = useCallback(async (uname, signal) => {
            setPostsError('');

            try {
                  const headers = token ? { Authorization: `Bearer ${token}` } : {};
                  const encodedUname = encodeURIComponent(uname);
                  const res = await fetch(`${API_URL}/feed/creator/${encodedUname}`, {
                        headers,
                        signal
                  });
                  const data = await res.json();

                  if (!data.success) {
                        setPostsError('Failed to load posts.');
                        return [];
                  }

                  let posts = [];
                  if (data.data?.contents) {
                        posts = data.data.contents;
                  } else if (Array.isArray(data.data)) {
                        posts = data.data;
                  } else if (data.contents) {
                        posts = data.contents;
                  }

                  const safePosts = Array.isArray(posts) ? posts : [];
                  setUserPosts(safePosts);
                  writeCachedValue(buildPostsCacheKey(uname), safePosts);
                  return safePosts;
            } catch (error) {
                  if (error.name !== 'AbortError') {
                        console.error('Failed to fetch user posts:', error);
                  } else {
                        setPostsError('Server slow. Showing cached content.');
                  }

                  const cachedPosts = readCachedValue(buildPostsCacheKey(uname), []);
                  setUserPosts(Array.isArray(cachedPosts) ? cachedPosts : []);
                  return Array.isArray(cachedPosts) ? cachedPosts : [];
            }
      }, [token]);

      const refreshProfile = useCallback(async (nextUsername = targetUsername) => {
            if (!nextUsername) return;

            const [profileResult] = await Promise.allSettled([
                  fetchProfileRequest(nextUsername),
                  fetchUserPosts(nextUsername)
            ]);

            if (profileResult.status === 'fulfilled') {
                  const nextProfile = profileResult.value;

                  if (username && nextProfile?.username && nextProfile.username !== username) {
                        navigate(`/u/${nextProfile.username}`, { replace: true });
                  }

                  setProfileUser(nextProfile);
                  writeCachedValue(buildProfileCacheKey(nextUsername), nextProfile);

                  if (isOwnProfile) {
                        setEditData(getEditableProfile(nextProfile));
                  }
            } else if (profileResult.reason?.name !== 'AbortError') {
                  console.error('Failed to refresh profile:', profileResult.reason);
            }
      }, [fetchProfileRequest, fetchUserPosts, isOwnProfile, navigate, targetUsername, username]);

      useEffect(() => {
            if (!targetUsername) return;

            const nextProfile = isOwnProfile && sessionUser
                  ? sessionUser
                  : readCachedValue(profileCacheKey, null);
            const nextPosts = readCachedValue(postsCacheKey, []);

            setProfileUser(nextProfile);
            setUserPosts(Array.isArray(nextPosts) ? nextPosts : []);
            setLoading(!nextProfile);
            setPostsError('');

            if (isOwnProfile && sessionUser) {
                  setEditData(getEditableProfile(sessionUser));
            }
      }, [isOwnProfile, postsCacheKey, profileCacheKey, sessionUser, targetUsername]);

      useEffect(() => {
            setTotalViews(getPostsViewCount(userPosts));
      }, [userPosts]);

      // Refresh profile when page becomes visible (for dynamic updates)
      useEffect(() => {
            if (!targetUsername) return undefined;

            const handleVisibilityChange = () => {
                  if (document.visibilityState === 'visible') {
                        refreshProfile(targetUsername);
                  }
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);
            return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
      }, [refreshProfile, targetUsername]);

      useEffect(() => {
            if (!targetUsername) return undefined;

            let ignore = false;
            const profileController = new AbortController();
            const postsController = new AbortController();
            const profileTimeoutId = window.setTimeout(() => profileController.abort(), 10000);
            const postsTimeoutId = window.setTimeout(() => postsController.abort(), 12000);

            const fetchProfileData = async () => {
                  try {
                        const nextProfile = await fetchProfileRequest(targetUsername, profileController.signal);
                        if (ignore) return;

                        if (username && nextProfile?.username && nextProfile.username !== username) {
                              navigate(`/u/${nextProfile.username}`, { replace: true });
                        }

                        setProfileUser(nextProfile);
                        writeCachedValue(profileCacheKey, nextProfile);

                        if (isOwnProfile) {
                              setEditData(getEditableProfile(nextProfile));
                        }
                  } catch (error) {
                        if (error.name !== 'AbortError') {
                              console.error('Failed to fetch profile:', error);
                        }
                  }
            };

            Promise.allSettled([
                  fetchProfileData(),
                  fetchUserPosts(targetUsername, postsController.signal)
            ]).finally(() => {
                  window.clearTimeout(profileTimeoutId);
                  window.clearTimeout(postsTimeoutId);

                  if (!ignore) {
                        setLoading(false);
                  }
            });

            return () => {
                  ignore = true;
                  window.clearTimeout(profileTimeoutId);
                  window.clearTimeout(postsTimeoutId);
                  profileController.abort();
                  postsController.abort();
            };
      }, [fetchProfileRequest, fetchUserPosts, isOwnProfile, navigate, profileCacheKey, targetUsername, username]);

      // Auto-play removed per user request

      // Global cleanup: Stop the track when completely leaving the profile page
      useEffect(() => {
            return () => {
                  stopTrack();
            };
      }, [stopTrack]);

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
                        setMessage('Failed to load followers.');
                        setTimeout(() => setMessage(''), 3000);
                  }
            } catch (error) {
                  console.error('Error fetching followers:', error);
                  setMessage('Could not connect to server.');
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
                        setMessage('Failed to load following list.');
                        setTimeout(() => setMessage(''), 3000);
                  }
            } catch (error) {
                  console.error('Error fetching following:', error);
                  setMessage('Could not connect to server.');
                  setTimeout(() => setMessage(''), 3000);
            } finally {
                  setModalLoading(false);
            }
      };

      const openProfileEditor = () => {
            setActiveTab('profile');
            setEditing(true);
            setTimeout(() => {
                  const editSection = document.getElementById('profile-edit-section');
                  if (editSection) {
                        editSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
            }, 120);
      };

      const openMusicEditor = () => {
            openProfileEditor();
            setTimeout(() => {
                  const musicSection = document.getElementById('spotify-search-wrapper');
                  if (musicSection) {
                        musicSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
            }, 220);
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
                  setMessage('Please unblock this user first.');
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
                        setMessage('Message sent successfully.');
                        setTimeout(() => setMessage(''), 3000);
                  } else {
                        setMessage('Error: ' + data.message);
                  }
            } catch (err) {
                  setMessage('Failed to send message.');
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
                        setMessage('Error: ' + res.message);
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
                  setMessage('Please select an image file.');
                  return;
            }
            if (file.size > 5 * 1024 * 1024) {
                  setMessage('Image must be less than 5MB.');
                  return;
            }

            setUploadingPhoto(true);
            setMessage('');

            try {
                  const result = await uploadAvatar(file);
                  const nextAvatar = result.data?.user?.avatar;

                  if (result.success && nextAvatar) {
                        setEditData(prev => ({ ...prev, avatar: nextAvatar }));
                        setProfileUser(prev => {
                              const nextProfile = { ...(prev || {}), avatar: nextAvatar };
                              writeCachedValue(buildProfileCacheKey(targetUsername), nextProfile);
                              return nextProfile;
                        });
                        setMessage('Profile photo updated.');
                  } else {
                        setMessage(result.message || 'Failed to update photo.');
                  }
            } catch (error) {
                  setMessage('Failed to upload photo.');
            } finally {
                  setUploadingPhoto(false);
                  if (e.target) e.target.value = '';
            }
      };

      const handleSaveProfile = async () => {
            setMessage('');
            const dataToSave = {
                  ...editData,
                  profileSong: editData.profileSong ? {
                        trackId: editData.profileSong.trackId,
                        name: editData.profileSong.name,
                        artist: editData.profileSong.artist,
                        albumArt: editData.profileSong.albumArt,
                        previewUrl: editData.profileSong.previewUrl
                  } : null
            };
            const result = await updateProfile(dataToSave);
            
            if (result.success) {
                  setMessage('Profile updated successfully.');

                  // Hard update state with latest context data from result
                  const nextProfile = result.data?.user
                        ? result.data.user
                        : { ...profileUser, ...dataToSave };

                  if (result.data?.user) {
                        setProfileUser(result.data.user);
                  } else {
                        setProfileUser(nextProfile);
                  }
                  writeCachedValue(buildProfileCacheKey(sessionUser?.username || targetUsername), nextProfile);

                  setEditing(false);

                  // Fetch freshly to be 100% sure the profileSong populates properly in the UI
                  refreshProfile(sessionUser?.username);
            } else {
                  setMessage('Error: ' + result.message);
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
                  setVerificationReqMsg(data.message || (data.success ? 'Request submitted.' : 'Request failed.'));
                  setTimeout(() => setVerificationReqMsg(''), 5000);
            } catch {
                  setVerificationReqMsg('Network error. Please try again.');
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
                              <div className="empty-state-icon">Auth</div>
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
                  <div className="container profile-page-shell profile-skeleton-shell" style={{ paddingTop: 'var(--space-xl)', paddingBottom: 'var(--space-2xl)' }}>
                        <div className="card profile-header-card animate-fadeInUp" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <div className="profile-skeleton-line profile-skeleton-avatar" />
                              <div className="profile-skeleton-stack">
                                    <div className="profile-skeleton-line profile-skeleton-title" />
                                    <div className="profile-skeleton-line profile-skeleton-subtitle" />
                                    <div className="profile-skeleton-stat-row">
                                          <div className="profile-skeleton-line profile-skeleton-stat" />
                                          <div className="profile-skeleton-line profile-skeleton-stat" />
                                          <div className="profile-skeleton-line profile-skeleton-stat" />
                                    </div>
                                    <div className="profile-skeleton-line profile-skeleton-bio" />
                              </div>
                        </div>

                        <div className="card animate-fadeInUp" style={{ animationDelay: '0.06s', minHeight: '220px' }}>
                              <div className="profile-skeleton-grid">
                                    {Array.from({ length: 6 }).map((_, index) => (
                                          <div key={index} className="profile-skeleton-line profile-skeleton-post" />
                                    ))}
                              </div>
                        </div>
                  </div>
            );
      }

      if (!profileUser && isOwnProfile && token) {
            return (
                  <div className="container" style={{ paddingTop: 'var(--space-2xl)' }}>
                        <div className="empty-state animate-fadeIn">
                              <div className="empty-state-icon">Profile</div>
                              <h2 className="text-xl font-semibold mb-md">Restoring your profile</h2>
                              <p className="text-secondary">Your session is open. We are syncing your profile in the background.</p>
                        </div>
                  </div>
            );
      }

      if (!profileUser) {
            return (
                  <div className="container" style={{ paddingTop: 'var(--space-2xl)' }}>
                        <div className="empty-state animate-fadeIn">
                              <div className="empty-state-icon">User</div>
                              <h2 className="text-xl font-semibold mb-md">User not found</h2>
                        </div>
                  </div>
            );
      }

      return (
            <>
                  <div className="container profile-page-shell" style={{ paddingTop: 'var(--space-xl)', paddingBottom: 'var(--space-2xl)' }}>
                        <div className="profile-page animate-fadeIn">

                              {/* Profile Header Card */}
                              <div className="card mb-xl profile-header-card" style={{
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
                                    borderColor: 'rgba(99, 102, 241, 0.2)'
                              }}>
                                    <div className="flex items-center gap-xl flex-wrap profile-header-layout">

                                          {/* Avatar with Upload */}
                                          <div className="profile-avatar-shell" style={{ position: 'relative' }}>
                                                <div
                                                      className="avatar avatar-xl profile-avatar-frame"
                                                      onClick={() => profileUser.avatar ? setShowPhotoModal(true) : null}
                                                      style={{
                                                            cursor: profileUser.avatar ? 'pointer' : 'default',
                                                            transition: 'all 0.3s ease',
                                                            border: '3px solid rgba(99, 102, 241, 0.5)',
                                                            position: 'relative',
                                                            overflow: 'hidden',
                                                            borderRadius: '50%',
                                                            width: 'var(--profile-avatar-size, 100px)',
                                                            height: 'var(--profile-avatar-size, 100px)',
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
                                                                  size="var(--profile-avatar-inner-size, 94px)"
                                                                  className="profile-avatar-image"
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
                                                                        fontSize: '20px',
                                                                        borderRadius: '50%',
                                                                        opacity: (isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId) ? 1 : 0,
                                                                        transition: 'opacity 0.2s',
                                                                        cursor: 'pointer'
                                                                  }}
                                                                  className="avatar-play-btn profile-avatar-play-btn"
                                                                  onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                                                                  onMouseLeave={(e) => {
                                                                        if (!(isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId)) {
                                                                              e.currentTarget.style.opacity = 0;
                                                                        }
                                                                  }}
                                                            >
                                                                  {(isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId) ? (
                                                                        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '20px' }}>
                                                                              <div style={{ width: '4px', height: '100%', background: '#fff', animation: 'pulse 1.2s ease-in-out infinite', animationDelay: '0ms' }} />
                                                                              <div style={{ width: '4px', height: '66%', background: '#fff', animation: 'pulse 1.2s ease-in-out infinite', animationDelay: '150ms' }} />
                                                                              <div style={{ width: '4px', height: '100%', background: '#fff', animation: 'pulse 1.2s ease-in-out infinite', animationDelay: '300ms' }} />
                                                                        </div>
                                                                  ) : 'Play'}
                                                            </button>
                                                      )}
                                                </div>

                                                {isOwnProfile && (
                                                      <div
                                                            onClick={handlePhotoClick}
                                                            className="profile-avatar-edit-trigger"
                                                            style={{
                                                                  position: 'absolute',
                                                                  bottom: '0',
                                                                  right: '0',
                                                                  width: '28px',
                                                                  height: '28px',
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
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                  <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2.1l1.1-1.6h4.6L15.4 6h2.1A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5Z" />
                                                                  <circle cx="12" cy="12.5" r="3.4" />
                                                            </svg>
                                                      </div>
                                                )}

                                                {/* Smaller music indicator badge */}
                                                {profileUser.profileSong && (
                                                      <div
                                                            className="profile-avatar-song-badge"
                                                            style={{
                                                                  position: 'absolute',
                                                                  top: '0',
                                                                  right: '0',
                                                                  width: '24px',
                                                                  height: '24px',
                                                                  background: '#1DB954', // Spotify green
                                                                  borderRadius: '50%',
                                                                  display: 'flex',
                                                                  alignItems: 'center',
                                                                  justifyContent: 'center',
                                                                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                                                  fontSize: '12px',
                                                                  zIndex: 5,
                                                                  border: '2px solid white'
                                                            }}
                                                      >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                                  <path d="M16 4v9.2A3.8 3.8 0 1 1 14 10V6.2l6-1.5v7.5a3.8 3.8 0 1 1-2-3.3V4Z" />
                                                            </svg>
                                                      </div>
                                                )}
                                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                                          </div>

                                          {/* User Info */}
                                          <div className="flex-1 profile-summary">
                                                <h1 className="text-3xl font-bold mb-xs profile-display-name">
                                                      {profileUser.displayName || profileUser.username}
                                                </h1>
                                                <p className="text-muted text-lg mb-md profile-username-copy">@{profileUser.username}</p>

                                                {/* Stats: Followers/Following */}
                                                <div className="profile-stat-row">
                                                      <button
                                                            type="button"
                                                            className="profile-stat-button"
                                                            onClick={fetchFollowers}
                                                      >
                                                            <span className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{profileUser.followersCount || 0}</span>
                                                            <span className="profile-stat-label">Followers</span>
                                                      </button>
                                                      <button
                                                            type="button"
                                                            className="profile-stat-button"
                                                            onClick={fetchFollowing}
                                                      >
                                                            <span className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{profileUser.followingCount || 0}</span>
                                                            <span className="profile-stat-label">Following</span>
                                                      </button>
                                                      <button
                                                            type="button"
                                                            className="profile-stat-button"
                                                            onClick={() => {
                                                                  const postsSection = document.getElementById('posts-section');
                                                                  if (postsSection) {
                                                                        postsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                                  }
                                                            }}
                                                      >
                                                            <span className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{userPosts.length || 0}</span>
                                                            <span className="profile-stat-label">Posts</span>
                                                      </button>
                                                      {isOwnProfile && totalViews > 0 && (
                                                            <div className="profile-stat-chip">
                                                                  <span className="profile-stat-value">{totalViews}</span>
                                                                  <span className="profile-stat-label">Views</span>
                                                            </div>
                                                      )}
                                                </div>

                                                {profileUser.bio && (
                                                      <p className="text-secondary mt-sm profile-bio-copy" style={{ maxWidth: '500px' }}>{profileUser.bio}</p>
                                                )}

                                                <div className="profile-badge-row mt-lg">
                                                      <span className="tag tag-primary" style={{ fontSize: 'var(--font-size-sm)' }}>
                                                            {profileUser.role === 'admin' ? 'Admin' :
                                                                  profileUser.role === 'creator' ? 'Creator' :
                                                                        profileUser.role === 'mentor' ? 'Mentor' : 'User'}
                                                      </span>
                                                      {profileUser.isVerified && (
                                                            <span className="profile-verified-badge">
                                                                  Verified
                                                            </span>
                                                      )}
                                                      {isOwnProfile && !profileUser.isVerified && profileUser.verificationRequest?.status === 'pending' && (
                                                            <span className="profile-status-badge pending">
                                                                  Verification Pending
                                                            </span>
                                                      )}
                                                      {isOwnProfile && !profileUser.isVerified && profileUser.verificationRequest?.status === 'rejected' && (
                                                            <span className="profile-status-badge rejected">
                                                                  Verification Rejected
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
                                                            className="mt-lg animate-fadeInUp magic-music-bar profile-music-bar"
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
                                                                        {(isMusicPlayingGlobal && currentTrack?.trackId === profileUser.profileSong.trackId) ? 'Pause' : 'Play'}
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
                                                                  <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '16px', marginLeft: '8px', marginRight: '4px' }}>
                                                                        <div style={{ width: '3px', borderRadius: '999px', background: '#6366f1', animation: 'magicMusicBar 0.8s ease-in-out infinite alternate', animationDelay: '0ms' }} />
                                                                        <div style={{ width: '3px', borderRadius: '999px', background: '#8b5cf6', animation: 'magicMusicBar 0.8s ease-in-out infinite alternate', animationDelay: '200ms' }} />
                                                                        <div style={{ width: '3px', borderRadius: '999px', background: '#ec4899', animation: 'magicMusicBar 0.8s ease-in-out infinite alternate', animationDelay: '400ms' }} />
                                                                  </div>
                                                            ) : isOwnProfile && (
                                                                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#4338ca', background: '#eef2ff', padding: '0.25rem 0.5rem', borderRadius: '999px', marginLeft: '8px', boxShadow: 'var(--shadow-sm)', border: '1px solid #c7d2fe' }}>EDIT</div>
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
                                                            <span>Add Music to Profile</span>
                                                      </div>
                                                )}
                                          </div>
                                    </div>

                                    {/* Action Buttons */}
                                    {isOwnProfile ? (
                                          <div className="profile-action-row">
                                                <button
                                                      onClick={() => editing ? setEditing(false) : openProfileEditor()}
                                                      className={`btn ${editing ? 'btn-ghost' : 'btn-secondary'}`}
                                                >
                                                      <span className="profile-action-label">
                                                            <EditIcon size={16} />
                                                            {editing ? 'Cancel' : 'Edit Profile'}
                                                      </span>
                                                </button>
                                                <button
                                                      onClick={() => navigate('/messages')}
                                                      className="btn btn-secondary"
                                                      style={{ position: 'relative' }}
                                                >
                                                      <span className="profile-action-label">
                                                            <MessageIcon size={16} />
                                                            Messages
                                                      </span>
                                                </button>
                                                <button
                                                      onClick={() => navigate('/settings')}
                                                      className="btn btn-secondary"
                                                >
                                                      <span className="profile-action-label">
                                                            <SettingsIcon size={16} />
                                                            Settings
                                                      </span>
                                                </button>
                                                {canAccessAdminPanel && (
                                                      <button
                                                            onClick={() => navigate('/admin')}
                                                            className="btn btn-primary"
                                                      >
                                                            Admin Panel
                                                      </button>
                                                )}
                                                {/* Request Blue Tick — only shown if not already verified and not pending */}
                                                {!profileUser?.isVerified && profileUser?.verificationRequest?.status !== 'pending' && (
                                                      <button
                                                            onClick={handleRequestVerification}
                                                            disabled={verificationReqLoading}
                                                            className="btn btn-ghost"
                                                            style={{
                                                                  background: 'linear-gradient(135deg,rgba(59,130,246,.1),rgba(99,102,241,.1))',
                                                                  border: '1px solid rgba(59,130,246,.3)',
                                                                  color: '#3b82f6', fontWeight: 700,
                                                                  transition: 'all .2s'
                                                            }}
                                                      >
                                                            {verificationReqLoading ? 'Sending...' : 'Request Verification'}
                                                      </button>
                                                )}
                                          </div>
                                    ) : isAuthenticated && (
                                          <>
                                                <div className="profile-action-row">
                                                <button
                                                      onClick={handleFollow}
                                                      disabled={followLoading}
                                                      className={`btn ${(isFollowing || followRequested) ? 'btn-secondary' : 'btn-primary'}`}
                                                >
                                                      {followLoading ? (
                                                            <span>Loading...</span>
                                                      ) : followRequested ? (
                                                            <span className="profile-action-label">
                                                                  <ClockIcon size={14} />
                                                                  Requested
                                                            </span>
                                                      ) : isFollowing ? (
                                                            <span className="profile-action-label">
                                                                  <CheckIcon size={14} />
                                                                  Following
                                                            </span>
                                                      ) : (
                                                            <span className="profile-action-label">
                                                                  <UserPlusIcon size={14} />
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
                                                      className={`btn ${activeTab === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
                                                >
                                                      <span className="profile-action-label">
                                                            <MessageIcon size={14} />
                                                            Message
                                                      </span>
                                                </button>
                                                <button
                                                      onClick={handleBlockToggle}
                                                      disabled={blockLoading}
                                                      className="btn btn-ghost text-red-500"
                                                      style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                                >
                                                      {blockLoading ? (
                                                            'Loading...'
                                                      ) : (
                                                            <span className="profile-action-label">
                                                                  <BlockIcon size={14} />
                                                                  {isBlocked ? 'Unblock' : 'Block'}
                                                            </span>
                                                      )}
                                                </button>
                                                </div>
                                          </>
                                    )}

                              </div>
                        </div>

                        {/* Middle Tabs - now includes Chat for visitors */}
                        <div className="mode-pills profile-tab-row mb-xl animate-fadeIn">
                              {!isOwnProfile && <button className={`mode-pill ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>Chat</button>}
                              <button className={`mode-pill ${activeTab === 'posts' || activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab(isOwnProfile ? 'profile' : 'posts')}>Posts</button>
                              {isOwnProfile && (
                                    <>
                                          <button className={`mode-pill ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>Settings</button>
                                          <button className={`mode-pill ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>Stats</button>
                                          <button className={`mode-pill ${activeTab === 'games' ? 'active' : ''}`} onClick={() => setActiveTab('games')}>Games</button>
                                    </>
                              )}
                        </div>

                        {/* Verification request feedback */}
                        {verificationReqMsg && (
                              <div className="card p-md mb-lg animate-fadeIn" style={{
                                    background: verificationReqMsg.toLowerCase().includes('submitted') ? 'rgba(59,130,246,.1)' : 'rgba(245,158,11,.1)',
                                    borderColor: verificationReqMsg.toLowerCase().includes('submitted') ? 'rgba(59,130,246,.3)' : 'rgba(245,158,11,.3)'
                              }}>
                                    <p>{verificationReqMsg}</p>
                              </div>
                        )}

                        {message && (
                              <div className="card p-md mb-lg animate-fadeIn" style={{
                                    background: message.toLowerCase().includes('success') || message.toLowerCase().includes('updated') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    borderColor: message.toLowerCase().includes('success') || message.toLowerCase().includes('updated') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                              }}>
                                    <p>{message}</p>
                              </div>
                        )}


                        {false && isOwnProfile && (
                              <div className="mode-pills mb-xl" style={{ maxWidth: '500px' }}>
                                    <button className={`mode-pill ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Profile</button>
                                    <button className={`mode-pill ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>Settings</button>
                                    <button className={`mode-pill ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>Stats</button>
                                    <button className={`mode-pill ${activeTab === 'games' ? 'active' : ''}`} onClick={() => setActiveTab('games')}>Games</button>
                              </div>
                        )}

                        {editing && isOwnProfile && (
                              <div id="profile-edit-section" className="card mb-xl animate-fadeInUp profile-edit-card">
                                    <h2 className="text-xl font-semibold mb-lg flex items-center gap-sm">Edit Profile</h2>
                                    <div className="grid grid-cols-2 gap-lg profile-edit-grid">
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
                                                title="Profile Music"
                                                helperText="Choose a track that appears on your profile and can be previewed from your avatar."
                                          />
                                    </div>
                                    <div className="flex gap-md mt-xl profile-edit-actions">
                                          <button onClick={handleSaveProfile} className="btn btn-primary">Save Changes</button>
                                          <button onClick={() => setEditing(false)} className="btn btn-ghost">Cancel</button>
                                    </div>
                              </div>
                        )}

                        {activeTab === 'chat' && !isOwnProfile && (
                              <div id="chat-tab-section" className="card animate-fadeInUp mb-xl profile-quick-chat-card" style={{ border: '2px solid rgba(99, 102, 241, 0.3)', padding: '24px' }}>
                                    <div className="flex items-center gap-sm mb-lg profile-quick-chat-head">
                                          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>DM</div>
                                          <h2 className="text-2xl font-bold">Quick Message to {profileUser.displayName || profileUser.username}</h2>
                                    </div>
                                    <p className="text-muted mb-lg profile-quick-chat-copy" style={{ fontSize: '1.05rem' }}>Send a professional direct message instantly. It will appear immediately in their inbox.</p>
                                    <form onSubmit={handleQuickSend} className="flex flex-col gap-md">
                                          <textarea 
                                                className="input profile-quick-chat-input" 
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
                                                className="btn btn-primary w-full profile-quick-chat-submit"
                                                style={{ padding: '16px', fontSize: '1.2rem', fontWeight: 700, boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)' }}
                                          >
                                                {sendingQuickChat ? 'Sending...' : 'Send Message Now'}
                                          </button>
                                          <button
                                                type="button"
                                                className="btn btn-secondary w-full"
                                                style={{ padding: '14px', fontSize: '1rem', fontWeight: 600 }}
                                                onClick={() => navigate(`/messages/${profileUser._id}`)}
                                          >
                                                Open Full Chat and Calling
                                          </button>
                                    </form>
                                    <div className="profile-tip-box">
                                          <span className="profile-tip-icon">Tip</span>
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
                                                <h3 className="font-semibold mb-md flex items-center gap-sm">Interests</h3>
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
                                                      <button onClick={() => fetchUserPosts(profileUser.username)} className="btn btn-primary mt-sm mx-auto flex">Retry</button>
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
                                                                              <div key={post._id} className="profile-post-thumb" onClick={() => navigate(`/content/${post._id}`)}>
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
                                                                                                      {post.title || post.body || 'Post'}
                                                                                                </span>
                                                                                          </div>
                                                                                    )}
                                                                                    <div className="profile-post-thumb-overlay">
                                                                                          <span style={{ fontSize: '14px', fontWeight: 700, color: 'white', textShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>{isVid ? 'PLAY' : 'OPEN'}</span>
                                                                                    </div>
                                                                                    <div className="profile-post-type-badge">{isVid ? 'VIDEO' : !hasMedia ? 'POST' : ''}</div>
                                                                              </div>
                                                                        );
                                                                  })}
                                                            </div>
                                                      </>
                                                );
                                          })()}
                                    </div>

                                    {isOwnProfile && (
                                          <div className="grid grid-cols-3 gap-md mb-lg mt-xl profile-shortcut-grid">
                                                <button onClick={() => navigate('/upload')} className="feature-card animate-fadeInUp stagger-1" style={{ padding: 'var(--space-lg)' }}>
                                                      <div style={{ fontSize: '1rem', marginBottom: 'var(--space-sm)', fontWeight: 700 }}>New</div>
                                                      <div className="font-semibold">Upload</div>
                                                </button>
                                                <button onClick={openProfileEditor} className="feature-card animate-fadeInUp stagger-2" style={{ padding: 'var(--space-lg)' }}>
                                                      <div style={{ fontSize: '1rem', marginBottom: 'var(--space-sm)', fontWeight: 700 }}>Edit</div>
                                                      <div className="font-semibold">Edit Profile</div>
                                                </button>
                                                <button onClick={openMusicEditor} className="feature-card animate-fadeInUp stagger-3" style={{ padding: 'var(--space-lg)' }}>
                                                      <div style={{ fontSize: '1rem', marginBottom: 'var(--space-sm)', fontWeight: 700 }}>Music</div>
                                                      <div className="font-semibold">{profileUser?.profileSong?.name ? 'Change Song' : 'Add Song'}</div>
                                                </button>
                                          </div>
                                    )}
                              </>
                        )}

                        {activeTab === 'settings' && isOwnProfile && (
                              <div className="card animate-fadeInUp">
                                    <h3 className="text-lg font-semibold mb-lg">Wellness Settings</h3>
                                    <div className="flex items-center gap-lg p-md mb-md" style={{ background: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-lg)' }}>
                                          <input type="checkbox" id="focusMode" checked={editData.focusModeEnabled} onChange={(e) => { setEditData(prev => ({ ...prev, focusModeEnabled: e.target.checked })); updateProfile({ focusModeEnabled: e.target.checked }); }} style={{ width: '24px', height: '24px', accentColor: 'var(--color-accent-primary)' }} />
                                          <label htmlFor="focusMode" style={{ cursor: 'pointer', flex: 1 }}><div className="font-semibold">Focus Mode</div><p className="text-sm text-muted">Hide all counts and metrics for peaceful browsing</p></label>
                                    </div>
                                    <div className="input-group mt-lg">
                                          <label className="input-label">Daily Usage Limit (minutes)</label>
                                          <input type="number" className="input" min="0" max="480" value={editData.dailyUsageLimit} onChange={(e) => { const value = parseInt(e.target.value) || 0; setEditData(prev => ({ ...prev, dailyUsageLimit: value })); }} placeholder="0 = unlimited" />
                                          <p className="text-xs text-muted mt-xs">Set 0 for unlimited.</p>
                                    </div>
                                    <div className="profile-inline-actions">
                                          <button type="button" onClick={() => navigate('/messages')} className="btn btn-secondary">Open Messages</button>
                                          <button type="button" onClick={() => navigate('/settings')} className="btn btn-secondary">Full Settings</button>
                                          {canAccessAdminPanel && (
                                                <button type="button" onClick={() => navigate('/admin')} className="btn btn-primary">Open Admin Panel</button>
                                          )}
                                    </div>
                                    <button onClick={handleSaveProfile} className="btn btn-primary mt-lg">Save Settings</button>
                                    <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 'var(--space-xl) 0' }} />
                                    <button onClick={handleLogout} className="btn btn-ghost" style={{ color: '#ef4444' }}>Logout</button>
                              </div>
                        )}

                        {activeTab === 'stats' && isOwnProfile && user?.stats && (
                              <div className="animate-fadeInUp">
                                    <div className="grid grid-cols-3 gap-lg mb-lg">
                                          <div className="stat-card"><div className="stat-value">{user.stats.contentCount || 0}</div><div className="stat-label">Content Created</div></div>
                                          <div className="stat-card"><div className="stat-value">{user.stats.helpfulReceived || 0}</div><div className="stat-label">Helpful Received</div></div>
                                          <div className="stat-card"><div className="stat-value">{user.stats.helpfulGiven || 0}</div><div className="stat-label">Helpful Given</div></div>
                                    </div>
                                    <div className="card p-md" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)' }}><p className="text-sm" style={{ color: '#22c55e' }}>Your stats are private and only visible to you.</p></div>
                              </div>
                        )}

                        {activeTab === 'games' && isOwnProfile && (
                              <div className="card animate-fadeInUp mb-xl">
                                    <h3 className="text-lg font-semibold mb-lg text-center">Zuno Cricket</h3>
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
                                                      className="btn btn-ghost profile-modal-close-btn"
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
                                                      src={resolveAssetUrl(profileUser.avatar)}
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
                                                className="modal-content card animate-fadeIn profile-modal-card"
                                                style={{
                                                      maxWidth: '400px',
                                                      width: '90%',
                                                      maxHeight: '70vh',
                                                      overflow: 'auto'
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                          >
                                                <div className="flex items-center justify-between mb-lg">
                                                      <h3 className="text-lg font-bold">Followers</h3>
                                                      <button
                                                            onClick={() => setShowFollowersModal(false)}
                                                            className="btn btn-ghost btn-sm profile-modal-close-btn"
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
                                                                        className="flex items-center gap-md p-sm profile-modal-user-row"
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
                                                                                    <img src={resolveAssetUrl(follower.avatar)} alt={follower.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                              ) : (
                                                                                    <span>{follower.displayName?.charAt(0) || follower.username?.charAt(0) || 'U'}</span>
                                                                              )}
                                                                        </div>
                                                                        <div className="flex-1">
                                                                              <div className="font-semibold text-sm">{follower.displayName || follower.username}</div>
                                                                              <div className="text-xs text-gray-500">@{follower.username}</div>
                                                                              {follower.bio && (
                                                                                    <div className="text-xs text-gray-400 mt-xs profile-modal-bio" style={{
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
                                                className="modal-content card animate-fadeIn profile-modal-card"
                                                style={{
                                                      maxWidth: '400px',
                                                      width: '90%',
                                                      maxHeight: '70vh',
                                                      overflow: 'auto'
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                          >
                                                <div className="flex items-center justify-between mb-lg">
                                                      <h3 className="text-lg font-bold">Following</h3>
                                                      <button
                                                            onClick={() => setShowFollowingModal(false)}
                                                            className="btn btn-ghost btn-sm profile-modal-close-btn"
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
                                                                        className="flex items-center gap-md p-sm profile-modal-user-row"
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
                                                                                    <img src={resolveAssetUrl(following.avatar)} alt={following.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                              ) : (
                                                                                    <span>{following.displayName?.charAt(0) || following.username?.charAt(0) || 'U'}</span>
                                                                              )}
                                                                        </div>
                                                                        <div className="flex-1">
                                                                              <div className="font-semibold text-sm">{following.displayName || following.username}</div>
                                                                              <div className="text-xs text-gray-500">@{following.username}</div>
                                                                              {following.bio && (
                                                                                    <div className="text-xs text-gray-400 mt-xs profile-modal-bio" style={{
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
