import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL, API_BASE_URL } from '../../config';

const StoryViewer = ({ group, onClose }) => {
      const [currentIndex, setCurrentIndex] = useState(0);
      const [progress, setProgress] = useState(0);
      const [imageLoaded, setImageLoaded] = useState(false);
      const [error, setError] = useState(false);
      const currentStory = group.stories[currentIndex];
      const videoRef = useRef(null);

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
      }, [currentIndex]);

      const handleNext = () => {
            if (currentIndex < group.stories.length - 1) {
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

      if (!currentStory) return null;

      const media = currentStory.media[0];
      const isVideo = media.type === 'video';

      return (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                  <button onClick={onClose} className="absolute top-4 right-4 text-white text-2xl z-50 hover:scale-110 transition-transform">✕</button>

                  <div className="relative w-full max-w-md h-full md:h-[90vh] bg-gray-900 md:rounded-2xl overflow-hidden flex flex-col">
                        {/* Progress Bar */}
                        <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
                              {group.stories.map((_, idx) => (
                                    <div key={idx} className="h-1 flex-1 bg-gray-600/50 rounded-full overflow-hidden">
                                          <div
                                                className="h-full bg-white transition-all duration-100"
                                                style={{
                                                      width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%'
                                                }}
                                          ></div>
                                    </div>
                              ))}
                        </div>

                        {/* User Info */}
                        <div className="absolute top-8 left-4 flex items-center gap-3 z-20">
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
                              <div>
                                    <span className="text-white font-semibold text-sm">{group.creator.displayName || group.creator.username}</span>
                                    <span className="text-gray-400 text-xs ml-2">{getTimeAgo(currentStory.createdAt)}</span>
                              </div>
                        </div>

                        {/* Media */}
                        <div className="flex-1 flex items-center justify-center bg-black relative">
                              {!isVideo && !imageLoaded && !error && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="w-10 h-10 border-4 border-gray-600 border-t-white rounded-full animate-spin"></div>
                                    </div>
                              )}

                              {isVideo ? (
                                    <video
                                          src={getMediaUrl(media.url)}
                                          className="w-full h-full object-contain"
                                          autoPlay
                                          playsInline
                                          onEnded={handleNext}
                                          onLoadedData={() => setImageLoaded(true)}
                                          onError={() => setError(true)}
                                    />
                              ) : (
                                    <img
                                          src={getMediaUrl(media.url)}
                                          className={`w-full h-full object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                                          onLoad={() => setImageLoaded(true)}
                                          onError={() => setError(true)}
                                    />
                              )}

                              {error && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                                          <span className="text-4xl mb-2">⚠️</span>
                                          <p className="text-gray-400">Failed to load story</p>
                                    </div>
                              )}

                              {/* Navigation Zones */}
                              <div className="absolute inset-y-0 left-0 w-1/3 cursor-pointer" onClick={handlePrev}></div>
                              <div className="absolute inset-y-0 right-0 w-1/3 cursor-pointer" onClick={handleNext}></div>
                        </div>

                        {/* Story expires in indicator */}
                        {currentStory.expiresAt && (
                              <div className="absolute bottom-4 left-0 right-0 text-center">
                                    <span className="text-gray-500 text-xs bg-black/50 px-3 py-1 rounded-full">
                                          ⏳ Expires {getTimeAgo(currentStory.expiresAt)}
                                    </span>
                              </div>
                        )}
                  </div>
            </div>
      );
};

const StoryBar = () => {
      const [storyGroups, setStoryGroups] = useState([]);
      const [selectedGroup, setSelectedGroup] = useState(null);
      const { user, isAuthenticated } = useAuth();

      useEffect(() => {
            const fetchStories = async () => {
                  try {
                        const res = await fetch(`${API_URL}/feed/stories`);
                        const data = await res.json();
                        if (data.success) {
                              setStoryGroups(data.data);
                        }
                  } catch (error) {
                        console.error("Failed to fetch stories", error);
                  }
            };
            fetchStories();
      }, []);

      // Instagram-style gradient ring
      const gradientRingStyle = {
            background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
            padding: '3px',
            borderRadius: '50%'
      };

      const seenRingStyle = {
            background: '#dbdbdb',
            padding: '3px',
            borderRadius: '50%'
      };

      if (storyGroups.length === 0 && !isAuthenticated) return null;

      return (
            <div style={{
                  background: 'white',
                  borderBottom: '1px solid #efefef',
                  padding: '12px 0',
                  marginBottom: '16px',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
            }}>
                  <style>
                        {`
                              .story-scroll::-webkit-scrollbar {
                                    display: none;
                              }
                        `}
                  </style>
                  <div className="story-scroll" style={{
                        display: 'flex',
                        gap: '16px',
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        overflowX: 'auto'
                  }}>
                        {/* Your Story - Add Button */}
                        {isAuthenticated && (
                              <Link to="/upload?type=story" style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '6px',
                                    minWidth: '75px',
                                    textDecoration: 'none'
                              }}>
                                    <div style={{
                                          position: 'relative',
                                          width: '66px',
                                          height: '66px'
                                    }}>
                                          <div style={{
                                                width: '66px',
                                                height: '66px',
                                                borderRadius: '50%',
                                                border: '2px solid #efefef',
                                                overflow: 'hidden',
                                                background: '#fafafa'
                                          }}>
                                                <img
                                                      src={user?.avatar || 'https://via.placeholder.com/66'}
                                                      alt="Your Story"
                                                      style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover'
                                                      }}
                                                />
                                          </div>
                                          {/* Plus icon */}
                                          <div style={{
                                                position: 'absolute',
                                                bottom: '0',
                                                right: '0',
                                                width: '22px',
                                                height: '22px',
                                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: '2px solid white',
                                                boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                                          }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                                                      <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="3" strokeLinecap="round" />
                                                </svg>
                                          </div>
                                    </div>
                                    <span style={{
                                          fontSize: '11px',
                                          color: '#262626',
                                          textAlign: 'center',
                                          maxWidth: '65px',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                    }}>Your Story</span>
                              </Link>
                        )}

                        {/* Story Circles - Instagram Style */}
                        {storyGroups.map(group => (
                              <div
                                    key={group.creator._id}
                                    onClick={() => setSelectedGroup(group)}
                                    style={{
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          gap: '6px',
                                          minWidth: '75px',
                                          cursor: 'pointer'
                                    }}
                              >
                                    <div style={gradientRingStyle}>
                                          <div style={{
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: '50%',
                                                border: '3px solid white',
                                                overflow: 'hidden',
                                                background: 'white'
                                          }}>
                                                <img
                                                      src={group.creator.avatar || 'https://via.placeholder.com/60'}
                                                      alt={group.creator.displayName}
                                                      style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover'
                                                      }}
                                                />
                                          </div>
                                    </div>
                                    {/* Follow icon for non-followed users - Like Instagram */}
                                    {!group.isFollowing && (
                                          <div style={{
                                                position: 'absolute',
                                                marginTop: '52px',
                                                width: '20px',
                                                height: '20px',
                                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: '2px solid white'
                                          }}>
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                                                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                                      <circle cx="8.5" cy="7" r="4"></circle>
                                                      <line x1="20" y1="8" x2="20" y2="14" stroke="white" strokeWidth="2"></line>
                                                      <line x1="23" y1="11" x2="17" y2="11" stroke="white" strokeWidth="2"></line>
                                                </svg>
                                          </div>
                                    )}
                                    <span style={{
                                          fontSize: '11px',
                                          color: '#262626',
                                          textAlign: 'center',
                                          maxWidth: '65px',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                    }}>{group.creator.displayName || group.creator.username}</span>
                              </div>
                        ))}
                  </div>

                  {selectedGroup && (
                        <StoryViewer group={selectedGroup} onClose={() => setSelectedGroup(null)} />
                  )}
            </div>
      );
};

export default StoryBar;
