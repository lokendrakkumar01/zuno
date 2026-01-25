import { useState, useEffect } from 'react';
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
      const [imageLoaded, setImageLoaded] = useState(false);

      // Assuming useFollow is a custom hook you have
      // const { isFollowing: initialFollowing } = useFollow(content.creator?._id);
      const [isFollowing, setIsFollowing] = useState(false); // Placeholder for now

      useEffect(() => {
            // setIsFollowing(initialFollowing); // Uncomment when useFollow is implemented
      }, []); // [initialFollowing]

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
                  setIsHelpful(!isHelpful);
            } catch (error) {
                  console.error('Failed to like:', error);
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

      const handleFollow = async () => {
            if (!token) return;
            try {
                  const endpoint = isFollowing ? 'unfollow' : 'follow';
                  await fetch(`${API_URL}/users/${content.creator._id}/${endpoint}`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  setIsFollowing(!isFollowing);
            } catch (error) {
                  console.error('Failed to toggle follow:', error);
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
            // ... existing code ...
      };

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
                              {content.media[0].status === 'uploading' && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                                          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                          <span className="text-sm">Processing media...</span>
                                    </div>
                              )}

                              {/* Error State */}
                              {content.media[0].status === 'failed' && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500">
                                          <span className="text-2xl mb-2">⚠️</span>
                                          <span className="text-sm">Media failed to process</span>
                                    </div>
                              )}

                              {/* Ready State */}
                              {(content.media[0].status === 'ready' || !content.media[0].status) && (
                                    content.media[0].type === 'image' ? (
                                          <>
                                                {/* Loading Spinner for Image */}
                                                {!imageLoaded && !imageError && (
                                                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                                            <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                                                      </div>
                                                )}

                                                <img
                                                      src={imageError ? placeholderImage : `${getMediaUrl(content.media[0].url)}?v=${new Date(content.updatedAt).getTime()}`}
                                                      alt={content.title || 'Content image'}
                                                      loading="lazy"
                                                      onLoad={() => setImageLoaded(true)}
                                                      onError={() => setImageError(true)}
                                                      className={`w-full h-auto object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                                                      style={{ minHeight: '200px', display: imageError ? 'none' : 'block' }}
                                                />

                                                {/* Fallback for Error */}
                                                {imageError && (
                                                      <div className="flex flex-col items-center justify-center h-full p-8 text-gray-400 bg-gray-100" style={{ minHeight: '200px' }}>
                                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
                                                                  <image x="4" y="4" width="16" height="16" transform="rotate(-15 12 12)" opacity="0.1" />
                                                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9" />
                                                                  <path d="M15 5h4a2 2 0 0 1 2 2v2" />
                                                                  <path d="M13 2 L3 12" />
                                                                  <path d="M21 2 L11 12" />
                                                            </svg>
                                                            <span className="text-sm">Image not available</span>
                                                      </div>
                                                )}
                                          </>
                                    ) : (
                                          <video
                                                key={content.media[0].url}
                                                src={`${getMediaUrl(content.media[0].url)}?v=${new Date(content.updatedAt).getTime()}`}
                                                controls
                                                controlsList="nodownload"
                                                playsInline
                                                preload="metadata"
                                                poster={content.media[0].thumbnail}
                                                className="w-full h-auto bg-black"
                                                style={{ maxHeight: '600px' }}
                                                onError={(e) => {
                                                      console.error('Video failed to load:', e);
                                                      if (!e.target.dataset.retried) {
                                                            e.target.dataset.retried = 'true';
                                                            setTimeout(() => {
                                                                  e.target.src = `${getMediaUrl(content.media[0].url)}?v=${Date.now()}`;
                                                            }, 1000);
                                                      }
                                                }}
                                          />
                                    )
                              )}

                              {/* Content Type Badge */}
                              {content.contentType.includes('video') && (
                                    <div style={{
                                          position: 'absolute',
                                          top: 'var(--space-sm)',
                                          right: 'var(--space-sm)',
                                          background: 'rgba(0,0,0,0.7)',
                                          padding: '0.25rem 0.5rem',
                                          borderRadius: 'var(--radius-sm)',
                                          fontSize: 'var(--font-size-xs)',
                                          color: 'white'
                                    }}>
                                          {content.contentType === 'short-video' ? '🎥 Short' : '🎬 Video'}
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

                        <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-4">
                                    <button
                                          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                                          onClick={handleHelpful}
                                          style={{
                                                transform: animateHelpful ? 'scale(1.2)' : 'scale(1)',
                                                transition: 'transform 0.2s ease',
                                                background: 'none', border: 'none', padding: 0,
                                                cursor: 'pointer',
                                                color: isHelpful ? '#ef4444' : 'var(--color-text-primary)'
                                          }}
                                    >
                                          <svg width="24" height="24" viewBox="0 0 24 24" fill={isHelpful ? '#ef4444' : 'none'} stroke={isHelpful ? '#ef4444' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                          </svg>
                                          <span className="text-sm font-medium">Like</span>
                                    </button>

                                    <button
                                          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                                          onClick={() => setShowComments(!showComments)}
                                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-primary)' }}
                                    >
                                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                                          </svg>
                                          <span className="text-sm font-medium">Comment</span>
                                    </button>

                                    <button
                                          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                                          onClick={handleShare}
                                          style={{
                                                transform: animateShare ? 'scale(1.2)' : 'scale(1)',
                                                transition: 'transform 0.2s ease',
                                                background: 'none', border: 'none', padding: 0,
                                                cursor: 'pointer',
                                                color: 'var(--color-text-primary)'
                                          }}
                                    >
                                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                          </svg>
                                          <span className="text-sm font-medium">Share</span>
                                    </button>
                              </div>

                              <div className="flex items-center gap-4 relative">
                                    <button
                                          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                                          onClick={handleSave}
                                          style={{
                                                transform: animateSave ? 'scale(1.2)' : 'scale(1)',
                                                transition: 'transform 0.2s ease',
                                                background: 'none', border: 'none', padding: 0,
                                                cursor: 'pointer',
                                                color: isSaved ? 'var(--color-accent-primary)' : 'var(--color-text-primary)'
                                          }}
                                    >
                                          <svg width="24" height="24" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                          </svg>
                                          <span className="text-sm font-medium">Save</span>
                                    </button>

                                    <button
                                          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                                          onClick={(e) => {
                                                e.stopPropagation();
                                                setShowMenu(!showMenu);
                                          }}
                                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-primary)' }}
                                    >
                                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                                <circle cx="12" cy="5" r="2"></circle>
                                                <circle cx="12" cy="12" r="2"></circle>
                                                <circle cx="12" cy="19" r="2"></circle>
                                          </svg>
                                          <span className="text-sm font-medium">More</span>
                                    </button>

                                    {/* More Menu Dropdown */}
                                    {showMenu && (
                                          <div className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-100 p-2 min-w-[150px] z-50 animate-fadeIn"
                                                onClick={(e) => e.stopPropagation()}
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
                                                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded flex items-center gap-2"
                                                      >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                  <polyline points="7 10 12 15 17 10"></polyline>
                                                                  <line x1="12" y1="15" x2="12" y2="3"></line>
                                                            </svg>
                                                            Download
                                                      </button>
                                                )}

                                                {currentUser?._id === content.creator?._id && (
                                                      <button
                                                            onClick={handleDelete}
                                                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-2"
                                                      >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                  <polyline points="3 6 5 6 21 6"></polyline>
                                                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                            </svg>
                                                            Delete
                                                      </button>
                                                )}
                                                <button
                                                      onClick={() => {
                                                            alert('Report feature coming soon');
                                                            setShowMenu(false);
                                                      }}
                                                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded flex items-center gap-2"
                                                >
                                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                                                            <line x1="4" y1="22" x2="4" y2="15"></line>
                                                      </svg>
                                                      Report
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
