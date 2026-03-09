import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMusic } from '../../context/MusicContext';
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

      // Music Playback via Global Context
      const { playTrack, stopTrack, currentTrack, isPlaying: isMusicPlayingGlobal } = useMusic();
      const isThisPlaying = isMusicPlayingGlobal && currentTrack?.trackId === content.music?.trackId;

      const toggleMusic = (e) => {
            e.stopPropagation();
            if (isThisPlaying) {
                  stopTrack();
            } else {
                  playTrack(content.music);
            }
      };


      // Instagram Style Features
      const [showBigHeart, setShowBigHeart] = useState(false);
      const [isFullscreen, setIsFullscreen] = useState(false);

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

            if (content.music && content.music.previewUrl && !isThisPlaying) {
                  playTrack(content.music);
            }

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

      const handleDoubleTap = () => {
            // Trigger music if exists
            if (content.music && content.music.previewUrl && !isThisPlaying) {
                  playTrack(content.music);
            }

            // Show big heart animation
            setShowBigHeart(true);
            setTimeout(() => setShowBigHeart(false), 1000); // Hide after animation

            // Trigger like if not already liked
            if (!isHelpful) {
                  handleHelpful();
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

            // Normalize path by replacing backslashes with forward slashes
            const normalizedUrl = url.replace(/\\/g, '/');

            // If it's already a full URL, return as-is
            if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
                  console.log('getMediaUrl: Full URL detected:', normalizedUrl);
                  return normalizedUrl;
            }

            // If it's a data URL, return as-is  
            if (normalizedUrl.startsWith('data:')) {
                  console.log('getMediaUrl: Data URL detected');
                  return normalizedUrl;
            }

            // Otherwise, fix and prepend the API base URL
            let cleanUrl = normalizedUrl;
            if (cleanUrl.includes('uploads/') && !cleanUrl.startsWith('/uploads/')) {
                  cleanUrl = '/' + cleanUrl.substring(cleanUrl.indexOf('uploads/'));
            } else if (!cleanUrl.startsWith('/')) {
                  cleanUrl = `/${cleanUrl}`;
            }

            const fullUrl = `${API_BASE_URL}${cleanUrl}`;
            console.log('getMediaUrl: Constructed URL:', fullUrl, '(from:', url, ')');
            return fullUrl;
      };

      const placeholderImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image Available%3C/text%3E%3C/svg%3E';

      // ... existing code ...

      const isVideo = (content.media && content.media.length > 0 &&
            (content.media[0].type === 'video' ||
                  /\.(mp4|mov|wmv|avi|flv|mkv|webm)$/i.test(content.media[0].url))) ||
            (content.type && (content.type === 'short-video' || content.type === 'long-video')) ||
            (content.contentType && (content.contentType === 'short-video' || content.contentType === 'long-video'));

      return (
            <article className={`content-card ${isVideo ? 'reel-card' : 'standard-card'}`} style={{ position: 'relative' }}>
                  {/* Header - Only hide on videos (Reels style) */}
                  {!isVideo && (
                        <div className="content-card-header flex items-center justify-between mb-sm">
                              <div className="flex items-center gap-sm">
                                    <Link to={`/u/${content.creator?.username}`}>
                                          <img
                                                src={content.creator?.avatar || 'https://via.placeholder.com/40'}
                                                alt={content.creator?.displayName}
                                                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e5e7eb', flexShrink: 0 }}
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
                  )}

                  {/* Media */}
                  {content.media && content.media.length > 0 && (
                        <div
                              className={`content-card-media ${isVideo ? 'reel-video-container' : ''}`}
                              style={{
                                    position: 'relative',
                                    background: isVideo ? '#000' : 'var(--color-bg-tertiary)',
                                    minHeight: isVideo ? '400px' : '200px',
                                    width: '100%',
                                    overflow: 'hidden',
                                    zIndex: 1,
                                    cursor: 'pointer' // explicitly show pointer
                              }}
                              onClick={() => {
                                    // Single click = play music if exists, and open fullscreen
                                    if (content.music && content.music.previewUrl && !isPlayingMusic) {
                                          audioRef.current?.play();
                                          setIsPlayingMusic(true);
                                    }
                                    setIsFullscreen(true);
                              }}
                              onDoubleClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDoubleTap();
                              }}
                        >
                              {/* Big Heart Animation for Double Tap */}
                              {showBigHeart && (
                                    <div className="animate-heart-pop">
                                          <svg width="100" height="100" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                          </svg>
                                    </div>
                              )}

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
                                    !isVideo ? (
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
                                          /* Enhanced Video Player - Reel Style */
                                          <div style={{ width: '100%', height: '100%', minHeight: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                {/* Video Element fills parent which has position:relative + dark bg */}
                                                <video
                                                      ref={videoRef}
                                                      key={mediaUrl}
                                                      src={getMediaUrl(mediaUrl)}
                                                      playsInline
                                                      preload="metadata"
                                                      poster={content.media[0].thumbnail}
                                                      style={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            left: 0,
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover',
                                                            display: 'block',
                                                      }}
                                                      muted={isMuted}
                                                      loop
                                                      onClick={(e) => {
                                                            e.stopPropagation();
                                                            videoRef.current?.pause(); // ensure underlying video is paused
                                                            setIsFullscreen(true); // Open reel viewer
                                                      }}
                                                      onDoubleClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handleDoubleTap(); // Heart animation on video double tap
                                                      }}
                                                      onPlay={() => setIsPlaying(true)}
                                                      onPause={() => setIsPlaying(false)}
                                                      onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
                                                      onTimeUpdate={(e) => setVideoProgress((e.target.currentTime / e.target.duration) * 100)}
                                                      onError={(e) => console.error('Video failed to load:', e)}
                                                />

                                                {/* Play Overlay Icon (indicates it's a video/reel) */}
                                                {!isPlaying && (
                                                      <div
                                                            onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  // Play music too if it exists
                                                                  if (content.music && content.music.previewUrl && !isThisPlaying) {
                                                                        playTrack(content.music);
                                                                  }
                                                                  setIsFullscreen(true);
                                                            }}
                                                            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.55)', borderRadius: '50%', padding: '18px', zIndex: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                      >
                                                            <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
                                                                  <path d="M8 5v14l11-7z" />
                                                            </svg>
                                                      </div>
                                                )}

                                                {/* Gradient Overlay (Bottom) */}
                                                <div style={{
                                                      position: 'absolute', bottom: 0, left: 0, width: '100%', height: '55%',
                                                      background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 50%, transparent 100%)',
                                                      pointerEvents: 'none', zIndex: 5
                                                }} />

                                                {/* Bottom Left: Creator + Caption */}
                                                <div style={{ position: 'absolute', bottom: '16px', left: '14px', right: '72px', zIndex: 10, color: 'white' }}>
                                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                            <Link to={`/u/${content.creator?.username}`} onClick={(e) => e.stopPropagation()}>
                                                                  <img
                                                                        src={content.creator?.avatar || 'https://via.placeholder.com/36'}
                                                                        alt={content.creator?.displayName}
                                                                        style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid white', objectFit: 'cover', display: 'block' }}
                                                                  />
                                                            </Link>
                                                            <Link to={`/u/${content.creator?.username}`} onClick={(e) => e.stopPropagation()} style={{ color: 'white', fontWeight: '700', fontSize: '14px', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                                                                  {content.creator?.username}
                                                            </Link>
                                                            {currentUser?._id !== content.creator?._id && (
                                                                  <button
                                                                        onClick={(e) => { e.stopPropagation(); handleFollow(); }}
                                                                        style={{ background: 'transparent', border: '1.5px solid white', borderRadius: '6px', color: 'white', padding: '2px 10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                                                                  >
                                                                        {isFollowing ? 'Following' : 'Follow'}
                                                                  </button>
                                                            )}
                                                      </div>
                                                      {(content.title || content.body) && (
                                                            <div style={{ fontSize: '13px', textShadow: '0 1px 2px rgba(0,0,0,0.9)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.4' }}>
                                                                  {content.title && <span style={{ fontWeight: '700', marginRight: '4px' }}>{content.title}</span>}
                                                                  <span>{content.body}</span>
                                                            </div>
                                                      )}
                                                </div>

                                                {/* Right Side: Action Buttons (Instagram Reel Style) */}
                                                <div className="reel-actions" style={{ position: 'absolute', bottom: '16px', right: '12px', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
                                                      {/* Like */}
                                                      <button onClick={(e) => { e.stopPropagation(); handleHelpful(); }} style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', transform: animateHelpful ? 'scale(1.25)' : 'scale(1)', transition: 'transform 0.2s' }}>
                                                            <svg width="28" height="28" viewBox="0 0 24 24" fill={isHelpful ? '#ef4444' : 'none'} stroke={isHelpful ? '#ef4444' : 'white'} strokeWidth="2" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}>
                                                                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                                            </svg>
                                                            <span style={{ fontSize: '11px', fontWeight: '700', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{likeCount || ''}</span>
                                                      </button>

                                                      {/* Comment */}
                                                      <button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }} style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', transition: 'transform 0.2s' }}>
                                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))', transform: 'scaleX(-1)' }}>
                                                                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                                            </svg>
                                                            <span style={{ fontSize: '11px', fontWeight: '700', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{commentCount || ''}</span>
                                                      </button>

                                                      {/* Share */}
                                                      <button onClick={(e) => { e.stopPropagation(); handleShare(); }} style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', transform: animateShare ? 'scale(1.25)' : 'scale(1)', transition: 'transform 0.2s' }}>
                                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}>
                                                                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                                                            </svg>
                                                            <span style={{ fontSize: '11px', fontWeight: '700', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>Share</span>
                                                      </button>

                                                      {/* Save */}
                                                      <button onClick={(e) => { e.stopPropagation(); handleSave(); }} style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', transform: animateSave ? 'scale(1.25)' : 'scale(1)', transition: 'transform 0.2s' }}>
                                                            <svg width="28" height="28" viewBox="0 0 24 24" fill={isSaved ? 'white' : 'none'} stroke="white" strokeWidth="2" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}>
                                                                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                                            </svg>
                                                      </button>

                                                      {/* Mute Toggle */}
                                                      <button
                                                            onClick={(e) => { e.stopPropagation(); const newMuted = !isMuted; setIsMuted(newMuted); if (videoRef.current) videoRef.current.muted = newMuted; }}
                                                            style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)', padding: '7px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: '4px' }}
                                                      >
                                                            {isMuted
                                                                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                                                                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                                                            }
                                                      </button>

                                                      {/* More/Delete for owner */}
                                                      <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '50%', border: 'none', padding: '8px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
                                                      </button>
                                                </div>

                                                {/* Video Progress Bar */}
                                                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '3px', background: 'rgba(255,255,255,0.2)', zIndex: 10 }}>
                                                      <div style={{ height: '100%', width: `${videoProgress}%`, background: 'white', transition: 'width 0.1s linear' }} />
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

                                          {/* Music Tag for Images */}
                                          {content.music && content.music.previewUrl && (
                                                <div
                                                      onClick={toggleMusic}
                                                      style={{
                                                            background: 'rgba(0,0,0,0.7)',
                                                            padding: '4px 10px',
                                                            borderRadius: '20px',
                                                            fontSize: '10px',
                                                            color: 'white',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            backdropFilter: 'blur(8px)',
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                                            cursor: 'pointer'
                                                      }}>
                                                      {isThisPlaying ? (
                                                            <div className="flex gap-[2px] items-center h-3">
                                                                  <div className="w-[3px] bg-green-500 h-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                                                                  <div className="w-[3px] bg-green-500 h-2/3 animate-pulse" style={{ animationDelay: '150ms' }}></div>
                                                                  <div className="w-[3px] bg-green-500 h-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                                                            </div>
                                                      ) : (
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#1DB954">
                                                                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.498 17.306c-.215.353-.675.465-1.028.249-2.85-1.742-6.44-2.137-10.662-1.171-.403.092-.803-.16-.895-.562-.092-.403.16-.803.562-.895 4.618-1.055 8.575-.603 11.774 1.353.353.216.464.675.249 1.026zm1.468-3.26c-.27.441-.848.58-1.29.31-3.26-2.003-8.23-2.585-12.083-1.415-.497.151-1.025-.129-1.176-.626-.151-.498.129-1.026.626-1.176 4.41-1.338 9.889-.685 13.613 1.605.442.271.581.849.31 1.291zm.126-3.414c-3.914-2.325-10.364-2.542-14.123-1.399-.6.182-1.24-.158-1.422-.758-.182-.6.158-1.24.758-1.422 4.318-1.311 11.442-1.05 15.952 1.629.54.32.715 1.021.396 1.56-.319.54-1.019.716-1.563.39z" />
                                                            </svg>
                                                      )}
                                                      <span className="truncate max-w-[120px]">{content.music.name} • {content.music.artist}</span>
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

                  {/* Body & Standard Footer (Hidden for Videos since they use overlays) */}
                  {!isVideo && (
                        <>
                              <div className="content-card-body pb-2">
                                    {content.title && (
                                          <h3 className="font-bold text-sm mb-1">
                                                <Link to={`/content/${content._id}`}>{content.title}</Link>
                                          </h3>
                                    )}
                                    {content.body && (
                                          <p className="text-sm text-gray-800">
                                                <span className="font-bold mr-2">{content.creator?.username}</span>
                                                {content.body}
                                          </p>
                                    )}
                              </div>

                              {/* Footer - Social Actions Standard (Instagram Post Style) */}
                              <div className="content-card-footer" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                                          {/* Like Icon */}
                                          <button onClick={handleHelpful} title="Like" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', gap: '5px', borderRadius: '8px', transform: animateHelpful ? 'scale(1.25)' : 'scale(1)', transition: 'transform 0.2s' }}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill={isHelpful ? '#ef4444' : 'none'} stroke={isHelpful ? '#ef4444' : 'var(--color-text-primary)'} strokeWidth="2">
                                                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                                                {likeCount > 0 && <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-primary)' }}>{likeCount}</span>}
                                          </button>

                                          {/* Dislike Icon */}
                                          <button onClick={handleDislike} title="Dislike" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '8px', transform: animateDislike ? 'scale(1.25)' : 'scale(1)', transition: 'transform 0.2s' }}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill={isDisliked ? '#6366f1' : 'none'} stroke={isDisliked ? '#6366f1' : 'var(--color-text-primary)'} strokeWidth="2" style={{ transform: 'rotate(180deg) scaleX(-1)' }}>
                                                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                                          </button>

                                          {/* Comment Icon */}
                                          <button onClick={() => setShowComments(!showComments)} title="Comment" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', gap: '5px', borderRadius: '8px', transform: animateComment ? 'scale(1.25)' : 'scale(1)', transition: 'transform 0.2s' }}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-primary)" strokeWidth="2" style={{ transform: 'scaleX(-1)' }}>
                                                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                                                {commentCount > 0 && <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-primary)' }}>{commentCount}</span>}
                                          </button>

                                          {/* Share Icon */}
                                          <button onClick={handleShare} title="Share" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '8px', transform: animateShare ? 'scale(1.25) rotate(10deg)' : 'scale(1)', transition: 'transform 0.2s' }}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-primary)" strokeWidth="2">
                                                      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                                          </button>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                          {/* Download Button (visible for media posts) */}
                                          {content.media && content.media.length > 0 && (
                                                <button
                                                      title="Download"
                                                      onClick={async () => {
                                                            const media = content.media[0];
                                                            const url = getMediaUrl(media.url);
                                                            const filename = `zuno-${content._id}.${media.type === 'video' ? 'mp4' : 'jpg'}`;
                                                            try {
                                                                  // Try blob download first (works on browser)
                                                                  const res = await fetch(url, { mode: 'cors' });
                                                                  if (!res.ok) throw new Error('Fetch failed');
                                                                  const blob = await res.blob();
                                                                  const blobUrl = window.URL.createObjectURL(blob);
                                                                  const link = document.createElement('a');
                                                                  link.href = blobUrl;
                                                                  link.download = filename;
                                                                  document.body.appendChild(link);
                                                                  link.click();
                                                                  document.body.removeChild(link);
                                                                  window.URL.revokeObjectURL(blobUrl);
                                                            } catch (err) {
                                                                  // Fallback: open directly in new tab (works in-app WebView)
                                                                  console.warn('Blob download failed, opening in new tab:', err);
                                                                  window.open(url, '_blank');
                                                            }
                                                      }}
                                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '8px' }}
                                                >
                                                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-primary)" strokeWidth="2">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                            <polyline points="7 10 12 15 17 10" />
                                                            <line x1="12" y1="15" x2="12" y2="3" />
                                                      </svg>
                                                </button>
                                          )}

                                          {/* Save/Bookmark Icon */}
                                          <button onClick={handleSave} title="Save" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '8px', transform: animateSave ? 'scale(1.25)' : 'scale(1)', transition: 'transform 0.2s' }}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill={isSaved ? 'var(--color-text-primary)' : 'none'} stroke="var(--color-text-primary)" strokeWidth="2">
                                                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                                          </button>

                                          {/* Delete Button - Only for post owner */}
                                          {currentUser?._id === content.creator?._id && (
                                                <button
                                                      title="Delete"
                                                      onClick={handleDelete}
                                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '8px' }}
                                                >
                                                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                      </svg>
                                                </button>
                                          )}

                                          {/* More Options */}
                                          <button onClick={() => setShowMenu(!showMenu)} title="More" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '8px' }}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--color-text-primary)"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
                                          </button>
                                    </div>
                              </div>
                        </>
                  )}

                  {/* Universal More Menu Dropdown (Matches both layouts) */}
                  {showMenu && (
                        <div
                              className="absolute bg-white rounded-xl shadow-2xl border border-gray-100 p-2 min-w-[180px] z-50"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                    animation: 'fadeInUp 0.2s ease-out',
                                    backdropFilter: 'blur(10px)',
                                    background: 'rgba(255,255,255,0.95)',
                                    right: '16px',
                                    ...(isVideo ? { top: '50px' } : { bottom: '50px' })
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

                  {/* Comment Section - shows when Comment button is clicked */}
                  {showComments && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                              <CommentSection contentId={content._id} />
                        </div>
                  )}

                  {/* Fullscreen Media Viewer (Instagram Reel Style) */}
                  {isFullscreen && (
                        <div
                              className="fullscreen-media-modal"
                        >
                              <button
                                    className="fullscreen-close"
                                    onClick={(e) => {
                                          e.stopPropagation();
                                          setIsFullscreen(false);
                                    }}
                              >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <line x1="18" y1="6" x2="6" y2="18" />
                                          <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                              </button>

                              <div
                                    className="fullscreen-media-content"
                                    onClick={(e) => {
                                          e.stopPropagation();
                                          // Toggle play/pause for video in fullscreen
                                          if (isVideo) {
                                                const vid = e.currentTarget.querySelector('video');
                                                if (vid) {
                                                      vid.paused ? vid.play() : vid.pause();
                                                }
                                          }
                                    }}
                                    onDoubleClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleDoubleTap();
                                    }}
                              >
                                    <div className="fullscreen-gradient"></div>

                                    {/* Big Heart Animation for Double Tap */}
                                    {showBigHeart && (
                                          <div className="animate-heart-pop text-white shadow-2xl z-[99999]" style={{ filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))' }}>
                                                <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                                                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                                </svg>
                                          </div>
                                    )}

                                    {/* Media Element */}
                                    {!isVideo ? (
                                          <img
                                                src={getMediaUrl(mediaUrl)}
                                                alt={content.title || 'Fullscreen media'}
                                                style={{ width: '100%', height: '100dvh', objectFit: 'contain' }}
                                          />
                                    ) : (
                                          <video
                                                src={getMediaUrl(mediaUrl)}
                                                autoPlay
                                                loop
                                                playsInline
                                                muted={isMuted} // follow normal app setting
                                          />
                                    )}

                                    {/* Action Buttons Overlay (Right Side) */}
                                    <div className="fullscreen-actions">
                                          <button className="fullscreen-action-btn" onClick={(e) => { e.stopPropagation(); handleHelpful(); }}>
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill={isHelpful ? "var(--color-accent-helpful)" : "none"} stroke={isHelpful ? "var(--color-accent-helpful)" : "white"} strokeWidth="2">
                                                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                                </svg>
                                                <span className="fullscreen-action-label">{content.metrics?.helpfulCount + (isHelpful && !content.metrics?.helpfulCount ? 1 : 0) || 'Like'}</span>
                                          </button>

                                          <button className="fullscreen-action-btn" onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); setIsFullscreen(false); }}>
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                                </svg>
                                                <span className="fullscreen-action-label">{commentCount || 'Comment'}</span>
                                          </button>

                                          <button className="fullscreen-action-btn" onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(`${window.location.origin}/content/${content._id}`);
                                                alert('Link copied to share!');
                                          }}>
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ transform: 'translateY(-2px)' }}>
                                                      <line x1="22" y1="2" x2="11" y2="13" />
                                                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                                </svg>
                                                <span className="fullscreen-action-label">Share</span>
                                          </button>

                                          <button className="fullscreen-action-btn" onClick={(e) => { e.stopPropagation(); handleSave(); }}>
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill={isSaved ? "white" : "none"} stroke="white" strokeWidth="2">
                                                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                                </svg>
                                                <span className="fullscreen-action-label">Save</span>
                                          </button>
                                    </div>

                                    {/* Creator Info (Bottom Left) */}
                                    <div className="fullscreen-creator-info">
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                <img
                                                      src={content.creator?.avatar || 'https://via.placeholder.com/40'}
                                                      alt={content.creator?.displayName}
                                                      style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid white', objectFit: 'cover', flexShrink: 0 }}
                                                />
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                      <span style={{ fontWeight: '700', fontSize: '14px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                                            {content.creator?.displayName || 'Anonymous'}
                                                      </span>
                                                      {content.creator?.username && (
                                                            <span style={{ fontSize: '12px', color: '#d1d5db', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                                                                  @{content.creator.username}
                                                            </span>
                                                      )}
                                                </div>
                                                {currentUser?._id !== content.creator?._id && !isFollowing && (
                                                      <button
                                                            className="ml-2 px-3 py-1 bg-transparent border border-white rounded-md text-xs font-bold transition-colors hover:bg-white hover:text-black"
                                                            onClick={(e) => { e.stopPropagation(); handleFollow(); }}
                                                      >
                                                            Follow
                                                      </button>
                                                )}
                                          </div>
                                          {content.title && (
                                                <p className="text-sm font-medium drop-shadow-md line-clamp-2">
                                                      {content.title}
                                                </p>
                                          )}
                                          {content.body && (
                                                <p className="text-xs text-gray-200 mt-1 line-clamp-2 drop-shadow-md">
                                                      {content.body}
                                                </p>
                                          )}
                                    </div>
                              </div>
                        </div>
                  )}
            </article>
      );
};

export default ContentCard;
