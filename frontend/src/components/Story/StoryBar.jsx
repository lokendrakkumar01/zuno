import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';
import StoryViewer from './StoryViewer';

const StoryBar = () => {
      const [storyGroups, setStoryGroups] = useState(() => {
            try {
                  const cached = localStorage.getItem('zuno_stories_cache');
                  return cached ? JSON.parse(cached) : [];
            } catch {
                  return [];
            }
      });
      const [selectedGroup, setSelectedGroup] = useState(null);
      const { user, isAuthenticated } = useAuth();
      const location = useLocation(); // Need useLocation

      useEffect(() => {
            const fetchStories = async () => {
                  try {
                        const res = await fetch(`${API_URL}/feed/stories`);
                        const data = await res.json();
                        if (data.success) {
                              setStoryGroups(data.data);
                              localStorage.setItem('zuno_stories_cache', JSON.stringify(data.data));

                              // Check for viewStory param after fetch
                              const params = new URLSearchParams(location.search);
                              const viewStoryId = params.get('viewStory');
                              if (viewStoryId) {
                                    const group = data.data.find(g => g.creator._id === viewStoryId);
                                    if (group) setSelectedGroup(group);
                              }
                        }
                  } catch (error) {
                        console.error("Failed to fetch stories", error);
                  }
            };
            fetchStories();
      }, [location.search]); // Re-run if query params change

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
