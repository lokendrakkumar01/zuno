import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL, API_BASE_URL } from '../../config';
import CommentSection from './CommentSection';

const ContentCard = ({ content, onDelete }) => {
      const { user: currentUser, token } = useAuth();
      const [isHelpful, setIsHelpful] = useState(content.interactions?.some(i => i.user === currentUser?._id && i.type === 'helpful') || false);
      const [isSaved, setIsSaved] = useState(content.interactions?.some(i => i.user === currentUser?._id && i.type === 'save') || false);
      const [shareCount, setShareCount] = useState(content.metrics?.shareCount || 0);
      const [showComments, setShowComments] = useState(false);
      const [showMenu, setShowMenu] = useState(false);

      const [animateHelpful, setAnimateHelpful] = useState(false);
      const [animateSave, setAnimateSave] = useState(false);
      const [animateShare, setAnimateShare] = useState(false);
      const [animateDislike, setAnimateDislike] = useState(false);
      const [animateComment, setAnimateComment] = useState(false);
      const [isDisliked, setIsDisliked] = useState(content.interactions?.some(i => i.user === currentUser?._id && i.type === 'not-useful') || false);
      const [likeCount, setLikeCount] = useState(content.metrics?.helpfulCount || 0);
      const [dislikeCount, setDislikeCount] = useState(content.metrics?.notUsefulCount || 0);
      const [commentCount, setCommentCount] = useState(content.metrics?.commentCount || 0);
      const [imageLoaded, setImageLoaded] = useState(false);

      // Media status tracking for polling
      // Default to 'ready' if status is undefined or empty - the backend sets status after save
      const initialMediaStatus = content.media?.[0]?.status;
      const [mediaStatus, setMediaStatus] = useState(
            initialMediaStatus && initialMediaStatus !== '' ? initialMediaStatus : 'ready'
      );
      const [pollCount, setPollCount] = useState(0);
      const [mediaUrl, setMediaUrl] = useState(content.media?.[0]?.url || '');

      // Update media status and URL when content prop changes (for fresh content)
      useEffect(() => {
            if (content.media?.[0]) {
                  const newStatus = content.media[0].status;
                  const newUrl = content.media[0].url;

                  // Only update if we have a valid status, otherwise default to ready
                  if (newStatus && newStatus !== 'uploading') {
                        setMediaStatus(newStatus);
                  } else if (!newStatus || newStatus === '') {
                        setMediaStatus('ready');
                  }

                  if (newUrl && newUrl !== mediaUrl) {
                        setMediaUrl(newUrl);
                        // Reset image states when URL changes
                        setImageLoaded(false);
                        setImageError(false);
                        setImageRetryCount(0);
                  }
            }
      }, [content.media]);

      // Assuming useFollow is a custom hook you have
      // const { isFollowing: initialFollowing } = useFollow(content.creator?._id);
      const [isFollowing, setIsFollowing] = useState(false); // Placeholder for now

      useEffect(() => {
            // setIsFollowing(initialFollowing); // Uncomment when useFollow is implemented
      }, []); // [initialFollowing]

      // Poll for media status updates when uploading
      useEffect(() => {
            if (mediaStatus === 'uploading' && pollCount < 10) {
                  const interval = setInterval(async () => {
                        try {
                              const res = await fetch(`${API_URL}/content/${content._id}`);
                              const data = await res.json();

                              if (data.success && data.data.content.media?.[0]) {
                                    const newMediaStatus = data.data.content.media[0].status;
                                    const newMediaUrl = data.data.content.media[0].url;

                                    if (newMediaStatus !== 'uploading') {
                                          setMediaStatus(newMediaStatus);
                                          setMediaUrl(newMediaUrl);
                                          clearInterval(interval);
                                    }
                              }
                              setPollCount(c => c + 1);
                        } catch (error) {
                              console.error('Error polling media status:', error);
                              setPollCount(c => c + 1);
                        }
                  }, 2000); // Poll every 2 seconds

                  return () => clearInterval(interval);
            }
      }, [mediaStatus, pollCount, content._id]);

      // Close menu when clicking outside
      useEffect(() => {
            const closeMenu = () => setShowMenu(false);
            if (showMenu) {
                  window.addEventListener('click', closeMenu);
            }
            return () => window.removeEventListener('click', closeMenu);
      }, [showMenu]);

      const handleHelpful = async () => {
            if (!token) return;

            setAnimateHelpful(true);
            setTimeout(() => setAnimateHelpful(false), 300);

            try {
                  await fetch(`${API_URL}/content/${content._id}/helpful`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const newIsHelpful = !isHelpful;
                  setIsHelpful(newIsHelpful);
                  setLikeCount(prev => newIsHelpful ? prev + 1 : prev - 1);
                  // If liking, remove dislike
                  if (newIsHelpful && isDisliked) {
                        setIsDisliked(false);
                        setDislikeCount(prev => prev - 1);
                  }
            } catch (error) {
                  console.error('Failed to like:', error);
            }
      };

      const handleDislike = async () => {
            if (!token) return;

            setAnimateDislike(true);
            setTimeout(() => setAnimateDislike(false), 300);

            try {
                  await fetch(`${API_URL}/content/${content._id}/dislike`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const newIsDisliked = !isDisliked;
                  setIsDisliked(newIsDisliked);
                  setDislikeCount(prev => newIsDisliked ? prev + 1 : prev - 1);
                  // If disliking, remove like
                  if (newIsDisliked && isHelpful) {
                        setIsHelpful(false);
                        setLikeCount(prev => prev - 1);
                  }
            } catch (error) {
                  console.error('Failed to dislike:', error);
            }
      };

      const handleSave = async () => {
            if (!token) return;

            setAnimateSave(true);
            setTimeout(() => setAnimateSave(false), 300);

            try {
                  await fetch(`${API_URL}/content/${content._id}/save`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  setIsSaved(!isSaved);
            } catch (error) {
                  console.error('Failed to save:', error);
            }
      };

      const handleShare = async () => {
            setAnimateShare(true);
            setTimeout(() => setAnimateShare(false), 300);

            try {
                  const shareUrl = `${window.location.origin}/content/${content._id}`;
                  const shareData = {
                        title: content.title || 'Check this out on ZUNO',
                        text: content.body ? content.body.substring(0, 100) : 'Interesting content on ZUNO',
                        url: shareUrl
                  };

                  if (navigator.share) {
                        await navigator.share(shareData);
                  } else {
                        await navigator.clipboard.writeText(shareUrl);
                        alert('Link copied to clipboard!');
                  }

                  // Track share in backend
                  await fetch(`${API_URL}/content/${content._id}/share`, { method: 'POST' });
                  setShareCount(shareCount + 1);
            } catch (error) {
                  console.error('Failed to share:', error);
            }
      };



      const handleDelete = async () => {
            if (!window.confirm('Are you sure you want to delete this content?')) {
                  setShowMenu(false);
                  return;
            }

            try {
                  const res = await fetch(`${API_URL}/content/${content._id}`, {
                        method: 'DELETE',
                        headers: {
                              'Authorization': `Bearer ${token}`
                        }
                  });

                  if (res.ok) {
                        if (onDelete) {
                              onDelete(content._id);
                        } else {
                              window.location.reload();
                        }
                  } else {
                        alert('Failed to delete content');
                  }
            } catch (error) {
                  console.error('Failed to delete content', error);
                  alert('Error deleting content');
            }
            setShowMenu(false);
      };

      // Check if following on mount
      useEffect(() => {
            if (currentUser && currentUser.following && content.creator) {
                  setIsFollowing(currentUser.following.includes(content.creator._id));
            }
      }, [currentUser, content.creator]);


      const handleFollow = async () => {
            if (!token) return;
            try {
                  const endpoint = isFollowing ? 'unfollow' : 'follow';
                  await fetch(`${API_URL}/users/${content.creator._id}/${endpoint}`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });

                  // Optimistic update
                  setIsFollowing(!isFollowing);

                  // Note: In a real app, you might want to update the global user context here 
                  // to keep currentUser.following in sync, but for this card UI, local state is sufficient for immediate feedback.
            } catch (error) {
                  console.error('Failed to toggle follow:', error);
            }
      };

      const getPurposeEmoji = (purpose) => {
            const emojis = {
                  'idea': '💡',
                  'skill': '🛠️',
                  'explain': '📖',
                  'story': '📝',
                  'question': '❓',
                  'discussion': '💬',
                  'learning': '📚',
                  'inspiration': '✨',
                  'solution': '✅'
            };
            return emojis[purpose] || '📌';
      };

      const getTypeGradient = (type) => {
            const gradients = {
                  'photo': 'linear-gradient(135deg, #ec4899, #f97316)',
                  'post': 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  'short-video': 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  'long-video': 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                  'live': 'linear-gradient(135deg, #ef4444, #ec4899)'
            };
            return gradients[type] || 'var(--gradient-primary)';
      };

      // Enhanced Icon Mapping Functions
      const getContentTypeIcon = (type) => {
            const icons = {
                  'photo': '📷',
                  'post': '📝',
                  'short-video': '🎥',
                  'long-video': '🎬',
                  'live': '🔴',
                  'story': '⏳'
            };
            return icons[type] || '📄';
      };

      const getTopicIcon = (topic) => {
            const icons = {
                  'learning': '🎓',
                  'technology': '💻',
                  'creativity': '🎨',
                  'health': '🏥',
                  'business': '💼',
                  'science': '🔬',
                  'arts': '🎭',
                  'lifestyle': '🌿',
                  'problem-solving': '🧩',
                  'mentoring': '👨‍🏫'
            };
            return icons[topic] || '📌';
      };

      const getLanguageIcon = (lang) => {
            const icons = { 'en': '🇺🇸', 'hi': '🇮🇳', 'other': '🌐' };
            return icons[lang] || '🌐';
      };

      const formatDuration = (seconds) => {
            if (!seconds) return null;
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
      };

      // Video player enhanced states
      const videoRef = useRef(null);
      const [isPlaying, setIsPlaying] = useState(false);
      const [isMuted, setIsMuted] = useState(false);
      const [showVideoControls, setShowVideoControls] = useState(true);
      const [videoProgress, setVideoProgress] = useState(0);
      const [videoDuration, setVideoDuration] = useState(0);

      const [imageError, setImageError] = useState(false);
      const [imageRetryCount, setImageRetryCount] = useState(0);

      const getMediaUrl = (url) => {
            if (!url) {
                  console.warn('getMediaUrl: Empty URL provided');
                  return '';
            }

            // If it's already a full URL, return as-is
            if (url.startsWith('http://') || url.startsWith('https://')) {
                  console.log('getMediaUrl: Full URL detected:', url);
                  return url;
            }

            // If it's a data URL, return as-is  
            if (url.startsWith('data:')) {
                  console.log('getMediaUrl: Data URL detected');
                  return url;
            }

            // Otherwise, prepend the API base URL
            // Ensure no double slashes
            const cleanUrl = url.startsWith('/') ? url : `/${url}`;
            const fullUrl = `${API_BASE_URL}${cleanUrl}`;
            console.log('getMediaUrl: Constructed URL:', fullUrl, '(from:', url, ')');
            return fullUrl;
      };

      const placeholderImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image Available%3C/text%3E%3C/svg%3E';

      // ... existing code ...

      return (
            <article className="content-card">
                  {/* Header */}
                  <div className="content-card-header flex items-center justify-between mb-sm">
                        <div className="flex items-center gap-sm">
                              <Link to={`/u/${content.creator?.username}`}>
                                    <img
                                          src={content.creator?.avatar || 'https://via.placeholder.com/40'}
                                          alt={content.creator?.displayName}
                                          className="avatar md rounded-full w-10 h-10 object-cover border border-gray-100"
                                    />
                              </Link>
                              <div className="flex flex-col">
                                    <h4 className="font-semibold text-sm leading-tight">
                                          <Link to={`/u/${content.creator?.username}`} className="hover:underline text-gray-900">
                                                {content.creator?.displayName || 'Anonymous'}
                                          </Link>
                                    </h4>
                                    <span className="text-xs text-gray-500 mt-0.5" style={{ display: 'block' }}>
                                          {content.purpose} • {new Date(content.createdAt).toLocaleDateString()}
                                    </span>
                              </div>
                        </div>

                        {currentUser?._id !== content.creator?._id && (
                              <button
                                    onClick={handleFollow}
                                    className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors ${isFollowing
                                          ? 'bg-gray-100 text-gray-600 border border-gray-200'
                                          : 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
                                          }`}
                              >
                                    {isFollowing ? (
                                          <>
                                                <span>✕</span>
                                                <span>Unfollow</span>
                                          </>
                                    ) : (
                                          <>
                                                <span>+</span>
                                                <span>Follow</span>
                                          </>
                                    )}
                              </button>
                        )}
                  </div>

                  {/* Media */}
                  {content.media && content.media.length > 0 && (
                        <div className="content-card-media relative bg-gray-100" style={{ minHeight: '200px' }}>
                              {/* Uploading State */}
                              {mediaStatus === 'uploading' && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                                          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                          <span className="text-sm">Processing media...</span>
                                    </div>
                              )}

                              {/* Error State */}
                              {mediaStatus === 'failed' && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500">
                                          <span className="text-2xl mb-2">⚠️</span>
                                          <span className="text-sm">Media failed to process</span>
                                    </div>
                              )}

                              {/* Ready State */}
                              {mediaStatus === 'ready' && (
                                    content.media[0].type === 'image' ? (
                                          <>
                                                {/* Loading Spinner for Image */}
                                                {!imageLoaded && !imageError && (
                                                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                                            <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                                                      </div>
                                                )}

                                                <img
                                                      src={imageError ? placeholderImage : getMediaUrl(mediaUrl)}
                                                      alt={content.title || 'Content image'}
                                                      loading="lazy"
                                                      onLoad={() => {
                                                            console.log('Image loaded successfully:', mediaUrl);
                                                            setImageLoaded(true);
                                                            setImageError(false);
                                                      }}
                                                      onError={(e) => {
                                                            console.error('Image failed to load:', {
                                                                  url: mediaUrl,
                                                                  constructedUrl: getMediaUrl(mediaUrl),
                                                                  error: e,
                                                                  retryCount: imageRetryCount
                                                            });

                                                            // Try to retry once
                                                            if (imageRetryCount < 1) {
                                                                  console.log('Retrying image load...');
                                                                  setImageRetryCount(imageRetryCount + 1);
                                                                  // Force reload by changing src slightly
                                                                  e.target.src = getMediaUrl(mediaUrl) + '?retry=' + Date.now();
                                                            } else {
                                                                  setImageError(true);
                                                            }
                                                      }}
                                                      className={`w-full h-auto object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                                                      style={{ minHeight: '200px', display: imageError ? 'none' : 'block' }}
                                                />

                                                {/* Fallback for Error */}
                                                {imageError && (
                                                      <div className="flex flex-col items-center justify-center h-full p-8 text-gray-400 bg-gray-100" style={{ minHeight: '200px' }}>
                                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
                                                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                                                  <circle cx="8.5" cy="8.5" r="1.5" />
                                                                  <polyline points="21 15 16 10 5 21" />
                                                            </svg>
                                                            <span className="text-sm">Image not available</span>
                                                            {import.meta.env.DEV && (
                                                                  <span className="text-xs mt-2 text-gray-500">URL: {mediaUrl}</span>
                                                            )}
                                                      </div>
                                                )}
                                          </>
                                    ) : (
                                          /* Enhanced Video Player */
                                          <div
                                                className="video-player-container"
                                                style={{ position: 'relative' }}
                                                onMouseEnter={() => setShowVideoControls(true)}
                                                onMouseLeave={() => !isPlaying && setShowVideoControls(true)}
                                          >
                                                <video
                                                      ref={videoRef}
                                                      key={mediaUrl}
                                                      src={getMediaUrl(mediaUrl)}
                                                      controls
                                                      controlsList="nodownload"
                                                      playsInline
                                                      preload="metadata"
                                                      poster={content.media[0].thumbnail}
                                                      className="w-full h-auto bg-black"
                                                      style={{ maxHeight: '600px' }}
                                                      muted={isMuted}
                                                      onPlay={() => setIsPlaying(true)}
                                                      onPause={() => setIsPlaying(false)}
                                                      onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
                                                      onTimeUpdate={(e) => setVideoProgress((e.target.currentTime / e.target.duration) * 100)}
                                                      onError={(e) => {
                                                            console.error('Video failed to load:', e);
                                                      }}
                                                />

                                                {/* Floating Badges Container - Top Left */}
                                                <div style={{
                                                      position: 'absolute',
                                                      top: '8px',
                                                      left: '8px',
                                                      display: 'flex',
                                                      flexDirection: 'column',
                                                      gap: '6px',
                                                      zIndex: 10
                                                }}>
                                                      {/* Purpose Badge */}
                                                      <div style={{
                                                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(139, 92, 246, 0.9))',
                                                            padding: '4px 10px',
                                                            borderRadius: '20px',
                                                            fontSize: '11px',
                                                            color: 'white',
                                                            fontWeight: '600',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            backdropFilter: 'blur(4px)',
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                                                      }}>
                                                            <span>{getPurposeEmoji(content.purpose)}</span>
                                                            <span style={{ textTransform: 'capitalize' }}>{content.purpose}</span>
                                                      </div>

                                                      {/* Topic Icons Row */}
                                                      {content.topics && content.topics.length > 0 && (
                                                            <div style={{
                                                                  display: 'flex',
                                                                  gap: '4px',
                                                                  flexWrap: 'wrap'
                                                            }}>
                                                                  {content.topics.slice(0, 3).map((topic, idx) => (
                                                                        <div key={idx} style={{
                                                                              background: 'rgba(0,0,0,0.7)',
                                                                              padding: '3px 8px',
                                                                              borderRadius: '12px',
                                                                              fontSize: '10px',
                                                                              color: 'white',
                                                                              display: 'flex',
                                                                              alignItems: 'center',
                                                                              gap: '3px',
                                                                              backdropFilter: 'blur(4px)'
                                                                        }}>
                                                                              <span>{getTopicIcon(topic)}</span>
                                                                              <span style={{ textTransform: 'capitalize' }}>{topic}</span>
                                                                        </div>
                                                                  ))}
                                                            </div>
                                                      )}
                                                </div>

                                                {/* Top Right Badges */}
                                                <div style={{
                                                      position: 'absolute',
                                                      top: '8px',
                                                      right: '8px',
                                                      display: 'flex',
                                                      flexDirection: 'column',
                                                      alignItems: 'flex-end',
                                                      gap: '6px',
                                                      zIndex: 10
                                                }}>
                                                      {/* Content Type Badge */}
                                                      <div style={{
                                                            background: content.contentType === 'live'
                                                                  ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                                                                  : 'rgba(0,0,0,0.75)',
                                                            padding: '4px 10px',
                                                            borderRadius: '20px',
                                                            fontSize: '11px',
                                                            color: 'white',
                                                            fontWeight: '600',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            backdropFilter: 'blur(4px)'
                                                      }}>
                                                            <span>{getContentTypeIcon(content.contentType)}</span>
                                                            <span>{content.contentType === 'short-video' ? 'Short' : content.contentType === 'long-video' ? 'Video' : content.contentType}</span>
                                                      </div>

                                                      {/* Duration Badge */}
                                                      {(videoDuration > 0 || content.media[0]?.duration) && (
                                                            <div style={{
                                                                  background: 'rgba(0,0,0,0.75)',
                                                                  padding: '3px 8px',
                                                                  borderRadius: '12px',
                                                                  fontSize: '10px',
                                                                  color: 'white',
                                                                  fontWeight: '500',
                                                                  display: 'flex',
                                                                  alignItems: 'center',
                                                                  gap: '3px'
                                                            }}>
                                                                  <span>⏱️</span>
                                                                  <span>{formatDuration(videoDuration || content.media[0]?.duration)}</span>
                                                            </div>
                                                      )}

                                                      {/* Language Badge */}
                                                      {content.language && (
                                                            <div style={{
                                                                  background: 'rgba(0,0,0,0.75)',
                                                                  padding: '3px 8px',
                                                                  borderRadius: '12px',
                                                                  fontSize: '10px',
                                                                  color: 'white'
                                                            }}>
                                                                  <span>{getLanguageIcon(content.language)}</span>
                                                            </div>
                                                      )}
                                                </div>

                                                {/* Bottom Right Quick Actions */}
                                                <div style={{
                                                      position: 'absolute',
                                                      bottom: '50px',
                                                      right: '8px',
                                                      display: 'flex',
                                                      flexDirection: 'column',
                                                      gap: '8px',
                                                      zIndex: 10
                                                }}>
                                                      {/* Mute/Unmute Button */}
                                                      <button
                                                            onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  setIsMuted(!isMuted);
                                                                  if (videoRef.current) {
                                                                        videoRef.current.muted = !isMuted;
                                                                  }
                                                            }}
                                                            style={{
                                                                  width: '36px',
                                                                  height: '36px',
                                                                  borderRadius: '50%',
                                                                  background: 'rgba(0,0,0,0.7)',
                                                                  border: 'none',
                                                                  color: 'white',
                                                                  cursor: 'pointer',
                                                                  display: 'flex',
                                                                  alignItems: 'center',
                                                                  justifyContent: 'center',
                                                                  fontSize: '14px',
                                                                  backdropFilter: 'blur(4px)',
                                                                  transition: 'all 0.2s ease'
                                                            }}
                                                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.8)'}
                                                            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                                                      >
                                                            {isMuted ? '🔇' : '🔊'}
                                                      </button>

                                                      {/* Fullscreen Button */}
                                                      <button
                                                            onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  if (videoRef.current) {
                                                                        if (document.fullscreenElement) {
                                                                              document.exitFullscreen();
                                                                        } else {
                                                                              videoRef.current.requestFullscreen();
                                                                        }
                                                                  }
                                                            }}
                                                            style={{
                                                                  width: '36px',
                                                                  height: '36px',
                                                                  borderRadius: '50%',
                                                                  background: 'rgba(0,0,0,0.7)',
                                                                  border: 'none',
                                                                  color: 'white',
                                                                  cursor: 'pointer',
                                                                  display: 'flex',
                                                                  alignItems: 'center',
                                                                  justifyContent: 'center',
                                                                  fontSize: '14px',
                                                                  backdropFilter: 'blur(4px)',
                                                                  transition: 'all 0.2s ease'
                                                            }}
                                                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.8)'}
                                                            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                                                      >
                                                            ⛶
                                                      </button>

                                                      {/* PiP Button */}
                                                      <button
                                                            onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  if (videoRef.current && document.pictureInPictureEnabled) {
                                                                        if (document.pictureInPictureElement) {
                                                                              document.exitPictureInPicture();
                                                                        } else {
                                                                              videoRef.current.requestPictureInPicture();
                                                                        }
                                                                  }
                                                            }}
                                                            style={{
                                                                  width: '36px',
                                                                  height: '36px',
                                                                  borderRadius: '50%',
                                                                  background: 'rgba(0,0,0,0.7)',
                                                                  border: 'none',
                                                                  color: 'white',
                                                                  cursor: 'pointer',
                                                                  display: 'flex',
                                                                  alignItems: 'center',
                                                                  justifyContent: 'center',
                                                                  fontSize: '14px',
                                                                  backdropFilter: 'blur(4px)',
                                                                  transition: 'all 0.2s ease'
                                                            }}
                                                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.8)'}
                                                            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                                                      >
                                                            📺
                                                      </button>
                                                </div>
                                          </div>
                                    )
                              )}

                              {/* Content Type Badge for Images */}
                              {content.media[0]?.type === 'image' && (
                                    <div style={{
                                          position: 'absolute',
                                          top: '8px',
                                          right: '8px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'flex-end',
                                          gap: '6px',
                                          zIndex: 10
                                    }}>
                                          {/* Purpose Badge */}
                                          <div style={{
                                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(139, 92, 246, 0.9))',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '11px',
                                                color: 'white',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                backdropFilter: 'blur(4px)',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                                          }}>
                                                <span>{getPurposeEmoji(content.purpose)}</span>
                                                <span style={{ textTransform: 'capitalize' }}>{content.purpose}</span>
                                          </div>

                                          {/* Language Badge */}
                                          {content.language && (
                                                <div style={{
                                                      background: 'rgba(0,0,0,0.75)',
                                                      padding: '3px 8px',
                                                      borderRadius: '12px',
                                                      fontSize: '10px',
                                                      color: 'white'
                                                }}>
                                                      <span>{getLanguageIcon(content.language)}</span>
                                                </div>
                                          )}
                                    </div>
                              )}

                              {/* Topic Icons for Images - Bottom Left */}
                              {content.media[0]?.type === 'image' && content.topics && content.topics.length > 0 && (
                                    <div style={{
                                          position: 'absolute',
                                          bottom: '8px',
                                          left: '8px',
                                          display: 'flex',
                                          gap: '4px',
                                          flexWrap: 'wrap',
                                          zIndex: 10
                                    }}>
                                          {content.topics.slice(0, 3).map((topic, idx) => (
                                                <div key={idx} style={{
                                                      background: 'rgba(0,0,0,0.7)',
                                                      padding: '3px 8px',
                                                      borderRadius: '12px',
                                                      fontSize: '10px',
                                                      color: 'white',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: '3px',
                                                      backdropFilter: 'blur(4px)'
                                                }}>
                                                      <span>{getTopicIcon(topic)}</span>
                                                      <span style={{ textTransform: 'capitalize' }}>{topic}</span>
                                                </div>
                                          ))}
                                    </div>
                              )}
                        </div>
                  )}

                  {/* Body */}
                  <div className="content-card-body">
                        {content.title && (
                              <h3 className="content-card-title">
                                    <Link to={`/content/${content._id}`}>{content.title}</Link>
                              </h3>
                        )}
                        {content.body && (
                              <p className="content-card-text">
                                    {content.body.length > 150
                                          ? `${content.body.substring(0, 150)}...`
                                          : content.body}
                              </p>
                        )}

                        {/* Topics */}
                        {content.topics && content.topics.length > 0 && (
                              <div className="flex gap-sm flex-wrap mt-md">
                                    {content.topics.slice(0, 3).map(topic => (
                                          <span key={topic} className="tag tag-primary" style={{ fontSize: '0.7rem' }}>
                                                {topic}
                                          </span>
                                    ))}
                                    {content.topics.length > 3 && (
                                          <span className="tag" style={{ fontSize: '0.7rem' }}>
                                                +{content.topics.length - 3}
                                          </span>
                                    )}
                              </div>
                        )}
                  </div>

                  {/* Footer - Social Actions */}
                  <div className="content-card-footer p-3">
                        {/* Caption/Body preview */}
                        <div className="px-1 text-sm mb-3">
                              <span className="font-bold mr-1">{content.creator?.username}</span>
                              {content.body && (
                                    <span>
                                          {content.body.slice(0, 100)}
                                          {content.body.length > 100 && '...'}
                                    </span>
                              )}
                        </div>

                        <div className="flex items-center justify-between mb-2" style={{ padding: '8px 0' }}>
                              {/* Left Side Actions - Like, Dislike, Comment, Share */}
                              <div className="flex items-center gap-1">
                                    {/* Like Button with Gradient */}
                                    <button
                                          className="action-btn flex flex-col items-center justify-center"
                                          onClick={handleHelpful}
                                          title="Like"
                                          style={{
                                                transform: animateHelpful ? 'scale(1.3)' : 'scale(1)',
                                                transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                                background: isHelpful ? 'linear-gradient(135deg, #ff6b6b, #ee5a5a)' : 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
                                                border: 'none',
                                                padding: '10px 14px',
                                                borderRadius: '16px',
                                                cursor: 'pointer',
                                                boxShadow: isHelpful ? '0 4px 15px rgba(239, 68, 68, 0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
                                                minWidth: '60px'
                                          }}
                                    >
                                          <svg width="22" height="22" viewBox="0 0 24 24" fill={isHelpful ? 'white' : 'none'} stroke={isHelpful ? 'white' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                                          </svg>
                                          <span style={{
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                marginTop: '2px',
                                                color: isHelpful ? 'white' : '#6b7280'
                                          }}>{likeCount > 0 ? likeCount : 'Like'}</span>
                                    </button>

                                    {/* Dislike Button */}
                                    <button
                                          className="action-btn flex flex-col items-center justify-center"
                                          onClick={handleDislike}
                                          title="Dislike"
                                          style={{
                                                transform: animateDislike ? 'scale(1.3)' : 'scale(1)',
                                                transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                                background: isDisliked ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
                                                border: 'none',
                                                padding: '10px 14px',
                                                borderRadius: '16px',
                                                cursor: 'pointer',
                                                boxShadow: isDisliked ? '0 4px 15px rgba(99, 102, 241, 0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
                                                minWidth: '60px'
                                          }}
                                    >
                                          <svg width="22" height="22" viewBox="0 0 24 24" fill={isDisliked ? 'white' : 'none'} stroke={isDisliked ? 'white' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}>
                                                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                                          </svg>
                                          <span style={{
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                marginTop: '2px',
                                                color: isDisliked ? 'white' : '#6b7280'
                                          }}>{dislikeCount > 0 ? dislikeCount : 'Dislike'}</span>
                                    </button>

                                    {/* Comment Button */}
                                    <button
                                          className="action-btn flex flex-col items-center justify-center"
                                          onClick={() => {
                                                setAnimateComment(true);
                                                setTimeout(() => setAnimateComment(false), 300);
                                                setShowComments(!showComments);
                                          }}
                                          title="Comments"
                                          style={{
                                                transform: animateComment ? 'scale(1.3)' : 'scale(1)',
                                                transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                                background: showComments ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
                                                border: 'none',
                                                padding: '10px 14px',
                                                borderRadius: '16px',
                                                cursor: 'pointer',
                                                boxShadow: showComments ? '0 4px 15px rgba(16, 185, 129, 0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
                                                minWidth: '60px'
                                          }}
                                    >
                                          <svg width="22" height="22" viewBox="0 0 24 24" fill={showComments ? 'white' : 'none'} stroke={showComments ? 'white' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                          </svg>
                                          <span style={{
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                marginTop: '2px',
                                                color: showComments ? 'white' : '#6b7280'
                                          }}>{commentCount > 0 ? commentCount : 'Comment'}</span>
                                    </button>

                                    {/* Share Button */}
                                    <button
                                          className="action-btn flex flex-col items-center justify-center"
                                          onClick={handleShare}
                                          title="Share"
                                          style={{
                                                transform: animateShare ? 'scale(1.3) rotate(10deg)' : 'scale(1)',
                                                transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                                background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
                                                border: 'none',
                                                padding: '10px 14px',
                                                borderRadius: '16px',
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                                minWidth: '60px'
                                          }}
                                    >
                                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="18" cy="5" r="3"></circle>
                                                <circle cx="6" cy="12" r="3"></circle>
                                                <circle cx="18" cy="19" r="3"></circle>
                                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                                          </svg>
                                          <span style={{
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                marginTop: '2px',
                                                color: '#6b7280'
                                          }}>{shareCount > 0 ? shareCount : 'Share'}</span>
                                    </button>
                              </div>

                              {/* Right Side Actions - Save, More */}
                              <div className="flex items-center gap-1 relative">
                                    {/* Save/Bookmark Button */}
                                    <button
                                          className="action-btn flex flex-col items-center justify-center"
                                          onClick={handleSave}
                                          title="Save for later"
                                          style={{
                                                transform: animateSave ? 'scale(1.3)' : 'scale(1)',
                                                transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                                background: isSaved ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
                                                border: 'none',
                                                padding: '10px 14px',
                                                borderRadius: '16px',
                                                cursor: 'pointer',
                                                boxShadow: isSaved ? '0 4px 15px rgba(245, 158, 11, 0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
                                                minWidth: '50px'
                                          }}
                                    >
                                          <svg width="22" height="22" viewBox="0 0 24 24" fill={isSaved ? 'white' : 'none'} stroke={isSaved ? 'white' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                          </svg>
                                          <span style={{
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                marginTop: '2px',
                                                color: isSaved ? 'white' : '#6b7280'
                                          }}>Save</span>
                                    </button>

                                    {/* More Options Button */}
                                    <button
                                          className="action-btn flex flex-col items-center justify-center"
                                          onClick={(e) => {
                                                e.stopPropagation();
                                                setShowMenu(!showMenu);
                                          }}
                                          title="More options"
                                          style={{
                                                transition: 'all 0.2s ease',
                                                background: showMenu ? 'linear-gradient(135deg, #374151, #1f2937)' : 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
                                                border: 'none',
                                                padding: '10px 12px',
                                                borderRadius: '16px',
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                          }}
                                    >
                                          <svg width="22" height="22" viewBox="0 0 24 24" fill={showMenu ? 'white' : '#6b7280'}>
                                                <circle cx="12" cy="5" r="2"></circle>
                                                <circle cx="12" cy="12" r="2"></circle>
                                                <circle cx="12" cy="19" r="2"></circle>
                                          </svg>
                                    </button>

                                    {/* More Menu Dropdown */}
                                    {showMenu && (
                                          <div
                                                className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-2xl border border-gray-100 p-2 min-w-[180px] z-50"
                                                onClick={(e) => e.stopPropagation()}
                                                style={{
                                                      animation: 'fadeInUp 0.2s ease-out',
                                                      backdropFilter: 'blur(10px)',
                                                      background: 'rgba(255,255,255,0.95)'
                                                }}
                                          >
                                                {/* Download Option */}
                                                {content.media && content.media.length > 0 && (
                                                      <button
                                                            onClick={async () => {
                                                                  try {
                                                                        const media = content.media[0];
                                                                        const url = getMediaUrl(media.url);
                                                                        const filename = `zuno-${content._id}.${media.type === 'video' ? 'mp4' : 'jpg'}`;

                                                                        const res = await fetch(url);
                                                                        const blob = await res.blob();
                                                                        const blobUrl = window.URL.createObjectURL(blob);

                                                                        const link = document.createElement('a');
                                                                        link.href = blobUrl;
                                                                        link.download = filename;
                                                                        document.body.appendChild(link);
                                                                        link.click();

                                                                        document.body.removeChild(link);
                                                                        window.URL.revokeObjectURL(blobUrl);
                                                                        setShowMenu(false);
                                                                  } catch (err) {
                                                                        console.error("Download failed", err);
                                                                        alert("Failed to download media");
                                                                  }
                                                            }}
                                                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 rounded-lg flex items-center gap-3 transition-all"
                                                      >
                                                            <div style={{
                                                                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                                                                  borderRadius: '8px',
                                                                  padding: '6px',
                                                                  display: 'flex',
                                                                  alignItems: 'center',
                                                                  justifyContent: 'center'
                                                            }}>
                                                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                        <polyline points="7 10 12 15 17 10"></polyline>
                                                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                  </svg>
                                                            </div>
                                                            <span style={{ fontWeight: '500' }}>Download</span>
                                                      </button>
                                                )}

                                                {/* Copy Link */}
                                                <button
                                                      onClick={() => {
                                                            navigator.clipboard.writeText(`${window.location.origin}/content/${content._id}`);
                                                            alert('Link copied!');
                                                            setShowMenu(false);
                                                      }}
                                                      className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 rounded-lg flex items-center gap-3 transition-all"
                                                >
                                                      <div style={{
                                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                                            borderRadius: '8px',
                                                            padding: '6px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                      }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                                                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                                                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                                            </svg>
                                                      </div>
                                                      <span style={{ fontWeight: '500' }}>Copy Link</span>
                                                </button>

                                                {/* Not Interested */}
                                                <button
                                                      onClick={() => {
                                                            alert('Noted! We will show less content like this.');
                                                            setShowMenu(false);
                                                      }}
                                                      className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-slate-50 rounded-lg flex items-center gap-3 transition-all"
                                                >
                                                      <div style={{
                                                            background: 'linear-gradient(135deg, #6b7280, #4b5563)',
                                                            borderRadius: '8px',
                                                            padding: '6px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                      }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                                                  <circle cx="12" cy="12" r="10"></circle>
                                                                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                                                            </svg>
                                                      </div>
                                                      <span style={{ fontWeight: '500' }}>Not Interested</span>
                                                </button>

                                                {currentUser?._id === content.creator?._id && (
                                                      <button
                                                            onClick={handleDelete}
                                                            className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-gradient-to-r hover:from-red-50 hover:to-rose-50 rounded-lg flex items-center gap-3 transition-all"
                                                      >
                                                            <div style={{
                                                                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                                                  borderRadius: '8px',
                                                                  padding: '6px',
                                                                  display: 'flex',
                                                                  alignItems: 'center',
                                                                  justifyContent: 'center'
                                                            }}>
                                                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                  </svg>
                                                            </div>
                                                            <span style={{ fontWeight: '500' }}>Delete</span>
                                                      </button>
                                                )}

                                                <button
                                                      onClick={() => {
                                                            alert('Report feature coming soon');
                                                            setShowMenu(false);
                                                      }}
                                                      className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 rounded-lg flex items-center gap-3 transition-all"
                                                >
                                                      <div style={{
                                                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                                            borderRadius: '8px',
                                                            padding: '6px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                      }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                                                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                                                                  <line x1="4" y1="22" x2="4" y2="15"></line>
                                                            </svg>
                                                      </div>
                                                      <span style={{ fontWeight: '500' }}>Report</span>
                                                </button>
                                          </div>
                                    )}
                              </div>
                        </div>

                        {/* Caption/Body preview */}


                        {/* Comment Section - shows when Comment button is clicked */}
                        {showComments && (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                    <CommentSection contentId={content._id} />
                              </div>
                        )}
                  </div>
            </article>
      );
};

export default ContentCard;
