import { useState, useEffect, useRef } from 'react';
import { useMusic } from '../../context/MusicContext';
import { API_BASE_URL } from '../../config';

const StoryViewer = ({ group, onClose }) => {
      const [currentIndex, setCurrentIndex] = useState(0);
      const [progress, setProgress] = useState(0);
      const [imageLoaded, setImageLoaded] = useState(false);
      const { playTrack, stopTrack } = useMusic();
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
      }, [currentIndex, group.stories.length]);

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

      const media = currentStory.media && currentStory.media.length > 0 ? currentStory.media[0] : null;
      const isVideo = media?.type === 'video';
      const isTextStatus = !media && currentStory.backgroundColor;

      return (
            <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
                  <button onClick={onClose} className="absolute top-4 right-4 text-white text-2xl z-[110] hover:scale-110 transition-transform">✕</button>

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

                        {/* Music Info Overlay */}
                        {currentStory.music && currentStory.music.previewUrl && (
                              <div className="absolute top-20 left-4 right-4 z-20 animate-fadeIn">
                                    <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md p-2 rounded-lg border border-white/10 max-w-fit">
                                          <div className="w-8 h-8 rounded bg-green-500 flex items-center justify-center flex-shrink-0">
                                                <div className="flex gap-[2px] items-center h-3">
                                                      <div className="w-[2px] bg-white h-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                                                      <div className="w-[2px] bg-white h-2/3 animate-pulse" style={{ animationDelay: '150ms' }}></div>
                                                      <div className="w-[2px] bg-white h-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                                                </div>
                                          </div>
                                          <div className="flex flex-col min-w-0 pr-2">
                                                <span className="text-white text-xs font-bold truncate">{currentStory.music.name}</span>
                                                <span className="text-gray-300 text-[10px] truncate">{currentStory.music.artist}</span>
                                          </div>

                                    </div>
                              </div>
                        )}

                        {/* Content Area */}
                        <div className="flex-1 flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: isTextStatus ? currentStory.backgroundColor : 'black' }}>
                              {isTextStatus ? (
                                    <div className="p-8 text-center animate-fadeInUp">
                                          <h2 className="text-white text-3xl font-bold leading-tight break-words" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                                                {currentStory.body}
                                          </h2>
                                    </div>
                              ) : (
                                    <>
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
                                    </>
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

export default StoryViewer;
