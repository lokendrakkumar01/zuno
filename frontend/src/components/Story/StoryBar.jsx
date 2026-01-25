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

      if (!currentStory) return null;

      const media = currentStory.media[0];
      const isVideo = media.type === 'video';

      return (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                  <button onClick={onClose} className="absolute top-4 right-4 text-white text-2xl z-50">✕</button>

                  <div className="relative w-full max-w-md h-full md:h-[80vh] bg-gray-900 rounded-lg overflow-hidden flex flex-col">
                        {/* Progress Bar */}
                        <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
                              {group.stories.map((_, idx) => (
                                    <div key={idx} className="h-1 flex-1 bg-gray-600 rounded-full overflow-hidden">
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
                        <div className="absolute top-6 left-4 flex items-center gap-2 z-20">
                              <img
                                    src={group.creator.avatar || 'https://via.placeholder.com/40'}
                                    alt={group.creator.displayName}
                                    className="w-8 h-8 rounded-full border border-white"
                              />
                              <span className="text-white font-semibold">{group.creator.displayName}</span>
                              <span className="text-gray-300 text-xs">• {new Date(currentStory.createdAt).getHours()}:{new Date(currentStory.createdAt).getMinutes()}</span>
                        </div>

                        {/* Media */}
                        <div className="flex-1 flex items-center justify-center bg-black relative">
                              {!isVideo && !imageLoaded && !error && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="w-8 h-8 border-4 border-gray-600 border-t-white rounded-full animate-spin"></div>
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
                                          <span className="text-3xl mb-2">⚠️</span>
                                          <p>Failed to load story</p>
                                    </div>
                              )}

                              {/* Navigation Zones */}
                              <div className="absolute inset-y-0 left-0 w-1/3" onClick={handlePrev}></div>
                              <div className="absolute inset-y-0 right-0 w-1/3" onClick={handleNext}></div>
                        </div>
                  </div>
            </div>
      );
};

const StoryBar = () => {
      const [storyGroups, setStoryGroups] = useState([]);
      const [selectedGroup, setSelectedGroup] = useState(null);
      const { user } = useAuth();

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

      if (storyGroups.length === 0) return null;

      return (
            <div className="bg-white border-b border-gray-100 py-4 mb-4 overflow-x-auto no-scrollbar">
                  <div className="container flex gap-4">
                        {/* Add Story Button (If User Logged In) */}
                        {user && (
                              <Link to="/upload?type=story" className="flex flex-col items-center gap-1 min-w-[70px] cursor-pointer">
                                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center border-2 border-white relative">
                                          <img
                                                src={user.avatar || 'https://via.placeholder.com/40'}
                                                alt="You"
                                                className="w-full h-full rounded-full object-cover opacity-50"
                                          />
                                          <div className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs border border-white">+</div>
                                    </div>
                                    <span className="text-xs text-gray-600 truncate w-full text-center">Your Story</span>
                              </Link>
                        )}

                        {/* Story Circles */}
                        {storyGroups.map(group => (
                              <div
                                    key={group.creator._id}
                                    className="flex flex-col items-center gap-1 min-w-[70px] cursor-pointer"
                                    onClick={() => setSelectedGroup(group)}
                              >
                                    <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-fuchsia-600">
                                          <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-white">
                                                <img
                                                      src={group.creator.avatar || 'https://via.placeholder.com/60'}
                                                      alt={group.creator.displayName}
                                                      className="w-full h-full object-cover"
                                                />
                                          </div>
                                    </div>
                                    <span className="text-xs text-gray-600 truncate w-full text-center">{group.creator.displayName}</span>
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
