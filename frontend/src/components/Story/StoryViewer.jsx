import { useState, useEffect, useRef } from 'react';
import { useMusic } from '../../context/MusicContext';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL, API_URL } from '../../config';

const StoryViewer = ({ group, onClose }) => {
      const { user, token } = useAuth();
      const [currentIndex, setCurrentIndex] = useState(0);
      const [progress, setProgress] = useState(0);
      const [imageLoaded, setImageLoaded] = useState(false);
      const { playTrack, stopTrack } = useMusic();
      const [error, setError] = useState(false);
      const [isEditing, setIsEditing] = useState(false);
      const [editBody, setEditBody] = useState('');
      const [isDeleting, setIsDeleting] = useState(false);
      // Local copy of stories to avoid direct prop mutation
      const [localStories, setLocalStories] = useState(() => [...group.stories]);
      const currentStory = localStories[currentIndex];
      const videoRef = useRef(null);

      const isOwner = user?._id === group.creator._id;

      // Reset state for new story
      useEffect(() => {
            setImageLoaded(false);
            setError(false);
      }, [currentIndex]);

      useEffect(() => {
            const timer = setInterval(() => {
                  setProgress(prev => {
                        if (prev >= 100) {
                              handleNext();
                              return 0;
                        }
                        return prev + 1; // Basic tick
                  });
            }, 50); // 5 sec duration roughly if step is small

            return () => clearInterval(timer);
      }, [currentIndex, localStories.length]);

      // Music Handling
      useEffect(() => {
            if (currentStory?.music?.previewUrl) {
                  playTrack(currentStory.music);
            } else {
                  stopTrack();
            }

            return () => stopTrack(); // Stop when unmounting or changing story
      }, [currentStory, playTrack, stopTrack]);

      const handleNext = () => {
            if (currentIndex < localStories.length - 1) {
                  setCurrentIndex(prev => prev + 1);
                  setProgress(0);
            } else {
                  onClose();
            }
      };

      const handlePrev = () => {
            if (currentIndex > 0) {
                  setCurrentIndex(prev => prev - 1);
                  setProgress(0);
            }
      };

      const handleShare = async () => {
            const shareUrl = `${window.location.origin}/status/${group.creator.username}`;
            if (navigator.share) {
                  try {
                        await navigator.share({
                              title: `Check out ${group.creator.displayName || group.creator.username}'s ZUNO status`,
                              url: shareUrl
                        });
                        await fetch(`${API_URL}/content/${currentStory._id}/share`, { method: 'POST' });
                  } catch (err) {
                        console.error('Share failed:', err);
                  }
            } else {
                  navigator.clipboard.writeText(shareUrl);
                  alert('Status link copied to clipboard!');
            }
      };

      const handleDelete = async () => {
            if (!window.confirm('Are you sure you want to delete this status?')) return;
            setIsDeleting(true);
            try {
                  const res = await fetch(`${API_URL}/content/${currentStory._id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        if (localStories.length === 1) {
                              onClose();
                              window.location.reload(); // Refresh to update list
                        } else {
                              // Remove story from local state (no prop mutation)
                              const updated = localStories.filter((_, i) => i !== currentIndex);
                              setLocalStories(updated);
                              // Adjust index if we were at the last story
                              if (currentIndex >= updated.length) {
                                    setCurrentIndex(updated.length - 1);
                              }
                              setProgress(0);
                        }
                  }
            } catch (err) {
                  console.error('Delete failed:', err);
            } finally {
                  setIsDeleting(false);
            }
      };

      const handleSaveEdit = async () => {
            try {
                  const res = await fetch(`${API_URL}/content/${currentStory._id}`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ body: editBody })
                  });
                  const data = await res.json();
                  if (data.success) {
                        // Update the story text locally without mutating props
                        setLocalStories(prev => prev.map((s, i) =>
                              i === currentIndex ? { ...s, body: editBody } : s
                        ));
                        setIsEditing(false);
                  }
            } catch (err) {
                  console.error('Edit failed:', err);
            }
      };

      const getMediaUrl = (url) => {
            if (!url) return '';
            if (url.startsWith('http')) return url;
            return `${API_BASE_URL}${url}`;
      };

      // Calculate time ago
      const getTimeAgo = (date) => {
            const now = new Date();
            const diff = now - new Date(date);
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor(diff / (1000 * 60));
            if (hours > 0) return `${hours}h`;
            if (minutes > 0) return `${minutes}m`;
            return 'now';
      };

      // Calculate time remaining until expiry
      const getTimeRemaining = (date) => {
            const now = new Date();
            const diff = new Date(date) - now;
            if (diff <= 0) return 'Expired';
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            if (hours > 0) return `${hours}h left`;
            if (minutes > 0) return `${minutes}m left`;
            return 'Expiring soon';
      };

      if (!currentStory) return null;

      const media = currentStory.media && currentStory.media.length > 0 ? currentStory.media[0] : null;
      const isVideo = media?.type === 'video';
      const isTextStatus = !media && currentStory.backgroundColor;

      return (
            <div style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 1000,
                  backgroundColor: 'black',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
            }}>
                  <button
                        onClick={onClose}
                        style={{
                              position: 'absolute',
                              top: '24px',
                              right: '24px',
                              color: 'white',
                              fontSize: '32px',
                              zIndex: 1100,
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'transform 0.2s'
                        }}
                  >
                        ✕
                  </button>

                  <div style={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: '450px',
                        height: '100%',
                        maxHeight: '100vh',
                        backgroundColor: '#111',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        borderRadius: window.innerWidth > 768 ? '16px' : '0'
                  }}>
                        {/* Progress Bar */}
                        <div style={{
                              position: 'absolute',
                              top: '12px',
                              left: '8px',
                              right: '8px',
                              display: 'flex',
                              gap: '4px',
                              zIndex: 20
                        }}>
                              {localStories.map((_, idx) => (
                                    <div key={idx} style={{
                                          height: '3px',
                                          flex: 1,
                                          backgroundColor: 'rgba(255,255,255,0.3)',
                                          borderRadius: '2px',
                                          overflow: 'hidden'
                                    }}>
                                          <div
                                                style={{
                                                      height: '100%',
                                                      backgroundColor: 'white',
                                                      transition: 'width 0.1s linear',
                                                      width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%'
                                                }}
                                          ></div>
                                    </div>
                              ))}
                        </div>

                        {/* User Info */}
                        <div style={{
                              position: 'absolute',
                              top: '32px',
                              left: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              zIndex: 20
                        }}>
                              <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    padding: '2px',
                                    background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)'
                              }}>
                                    <img
                                          src={group.creator.avatar || 'https://via.placeholder.com/40'}
                                          alt={group.creator.displayName}
                                          style={{
                                                width: '100%',
                                                height: '100%',
                                                borderRadius: '50%',
                                                border: '2px solid black',
                                                objectFit: 'cover'
                                          }}
                                    />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>{group.creator.displayName || group.creator.username}</span>
                                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>{getTimeAgo(currentStory.createdAt)}</span>
                              </div>
                        </div>

                        {/* Music Info Overlay */}
                        {currentStory.music && currentStory.music.previewUrl && (
                              <div style={{
                                    position: 'absolute',
                                    top: '84px',
                                    left: '16px',
                                    right: '16px',
                                    zIndex: 20,
                                    animation: 'fadeIn 0.3s ease'
                              }}>
                                    <div style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          background: 'rgba(0,0,0,0.3)',
                                          backdropFilter: 'blur(8px)',
                                          padding: '8px',
                                          borderRadius: '8px',
                                          border: '1px solid rgba(255,255,255,0.1)',
                                          maxWidth: 'fit-content'
                                    }}>
                                          <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '4px',
                                                backgroundColor: '#22c55e',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                          }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '12px' }}>
                                                      <div style={{ width: '2px', height: '100%', backgroundColor: 'white', animation: 'pulse 1s infinite' }}></div>
                                                      <div style={{ width: '2px', height: '60%', backgroundColor: 'white', animation: 'pulse 1s infinite 0.15s' }}></div>
                                                      <div style={{ width: '2px', height: '100%', backgroundColor: 'white', animation: 'pulse 1s infinite 0.3s' }}></div>
                                                </div>
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, paddingRight: '8px' }}>
                                                <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentStory.music.name}</span>
                                                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentStory.music.artist}</span>
                                          </div>
                                    </div>
                              </div>
                        )}

                        {/* Content Area */}
                        <div
                              style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    backgroundColor: isTextStatus ? currentStory.backgroundColor : 'black'
                              }}
                        >
                              {isTextStatus ? (
                                    <div style={{ padding: '32px', textAlign: 'center' }}>
                                          <h2 style={{
                                                color: 'white',
                                                fontSize: '28px',
                                                fontWeight: 'bold',
                                                lineHeight: '1.2',
                                                wordBreak: 'break-word',
                                                textShadow: '0 2px 10px rgba(0,0,0,0.3)'
                                          }}>
                                                {currentStory.body}
                                          </h2>
                                    </div>
                              ) : (
                                    <>
                                          {!isVideo && !imageLoaded && !error && (
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyCenter: 'center' }}>
                                                      <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.2)', borderTopColor: 'white', borderRadius: '50%' }}></div>
                                                </div>
                                          )}

                                          {isVideo ? (
                                                <video
                                                      src={media ? getMediaUrl(media.url) : ''}
                                                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                      autoPlay
                                                      playsInline
                                                      onEnded={handleNext}
                                                      onLoadedData={() => setImageLoaded(true)}
                                                      onError={() => setError(true)}
                                                />
                                          ) : (
                                                <img
                                                      src={media ? getMediaUrl(media.url) : ''}
                                                      style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'contain',
                                                            transition: 'opacity 0.3s',
                                                            opacity: imageLoaded ? 1 : 0
                                                      }}
                                                      onLoad={() => setImageLoaded(true)}
                                                      onError={() => setError(true)}
                                                />
                                          )}
                                    </>
                              )}

                              {error && (
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                          <span style={{ fontSize: '40px', marginBottom: '8px' }}>⚠️</span>
                                          <p style={{ color: 'rgba(255,255,255,0.6)' }}>Failed to load story</p>
                                    </div>
                              )}

                              {/* Navigation Zones */}
                              <div style={{ position: 'absolute', inset: '0 auto 0 0', width: '33.33%', cursor: 'pointer' }} onClick={handlePrev}></div>
                              <div style={{ position: 'absolute', inset: '0 0 0 auto', width: '33.33%', cursor: 'pointer' }} onClick={handleNext}></div>
                        </div>

                        {/* Bottom Actions */}
                        <div style={{
                              position: 'absolute',
                              bottom: '24px',
                              left: '16px',
                              right: '16px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              zIndex: 100
                        }}>
                              <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                          onClick={handleShare}
                                          style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                          title="Share"
                                    >
                                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                                    </button>
                                    {isOwner && (
                                          <>
                                                <button
                                                      onClick={() => {
                                                            setEditBody(currentStory.body || '');
                                                            setIsEditing(true);
                                                      }}
                                                      style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                      title="Edit"
                                                >
                                                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                </button>
                                                <button
                                                      onClick={handleDelete}
                                                      disabled={isDeleting}
                                                      style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239,68,68,0.3)', backdropFilter: 'blur(10px)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                      title="Delete"
                                                >
                                                      {isDeleting ? '...' : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>}
                                                </button>
                                          </>
                                    )}
                              </div>

                              {currentStory.expiresAt && (
                                    <span style={{
                                          color: 'rgba(255,255,255,0.5)',
                                          fontSize: '11px',
                                          backgroundColor: 'rgba(0,0,0,0.5)',
                                          padding: '4px 10px',
                                          borderRadius: '999px'
                                    }}>
                                          ⏳ {getTimeRemaining(currentStory.expiresAt)}
                                    </span>
                              )}
                        </div>

                        {/* Edit Overlay */}
                        {isEditing && (
                              <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    zIndex: 500,
                                    background: 'rgba(0,0,0,0.85)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: '24px',
                                    justifyContent: 'center'
                                    // backdropFilter: 'blur(10px)'
                              }}>
                                    <h3 style={{ color: 'white', marginBottom: '16px' }}>Edit Status</h3>
                                    <textarea
                                          value={editBody}
                                          onChange={(e) => setEditBody(e.target.value)}
                                          style={{
                                                width: '100%',
                                                height: '150px',
                                                background: 'rgba(255,255,255,0.1)',
                                                border: '1px solid rgba(255,255,255,0.2)',
                                                borderRadius: '12px',
                                                color: 'white',
                                                padding: '12px',
                                                fontSize: '16px',
                                                outline: 'none',
                                                marginBottom: '20px'
                                          }}
                                          autoFocus
                                    />
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                          <button
                                                onClick={handleSaveEdit}
                                                style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'var(--color-accent-primary, #6366f1)', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                                          >
                                                Save Changes
                                          </button>
                                          <button
                                                onClick={() => setIsEditing(false)}
                                                style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                                          >
                                                Cancel
                                          </button>
                                    </div>
                              </div>
                        )}
                  </div>
            </div>
      );
};

export default StoryViewer;
