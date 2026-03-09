import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { formatDistanceToNow } from 'date-fns';
import StoryViewer from '../components/Story/StoryViewer';

const Status = () => {
      const { user, token, isAuthenticated } = useAuth();
      const navigate = useNavigate();
      const [storyGroups, setStoryGroups] = useState([]);
      const [loading, setLoading] = useState(true);
      const [selectedGroup, setSelectedGroup] = useState(null);

      useEffect(() => {
            if (!isAuthenticated) {
                  navigate('/login');
                  return;
            }

            const fetchStatuses = async () => {
                  try {
                        const res = await fetch(`${API_URL}/feed/stories`, {
                              headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const data = await res.json();
                        if (data.success) {
                              setStoryGroups(data.data);
                        }
                  } catch (error) {
                        console.error("Failed to fetch statuses", error);
                  } finally {
                        setLoading(false);
                  }
            };

            fetchStatuses();
      }, [isAuthenticated, token, navigate]);

      const myStories = storyGroups.find(group => group.creator._id === user?._id);
      const otherStories = storyGroups.filter(group => group.creator._id !== user?._id);

      // Filter into Recent updates
      const recentUpdates = otherStories;

      return (
            <div className="status-page container animate-fadeIn pb-24">
                  <header className="flex items-center justify-between mb-lg pt-md px-md">
                        <h1 className="text-2xl font-bold">Status</h1>
                        <div className="flex gap-sm">
                              <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl">
                                    🔍
                              </button>
                              <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl">
                                    ⋮
                              </button>
                        </div>
                  </header>

                  {/* My Status */}
                  <section className="mb-8">
                        <div className="flex items-center gap-4 p-4 hover:bg-black/5 rounded-xl transition-colors cursor-pointer" onClick={() => myStories ? setSelectedGroup(myStories) : navigate('/upload?type=story')}>
                              <div className="relative">
                                    <div className="w-16 h-16 rounded-full overflow-hidden p-1" style={{ background: myStories ? 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' : '#e5e7eb' }}>
                                          <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-white">
                                                <img
                                                      src={user?.avatar || 'https://via.placeholder.com/64'}
                                                      alt="My Status"
                                                      className="w-full h-full object-cover"
                                                />
                                          </div>
                                    </div>
                                    {!myStories && (
                                          <div className="absolute bottom-0 right-0 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center border-2 border-white text-lg font-bold">
                                                +
                                          </div>
                                    )}
                              </div>
                              <div className="flex-1">
                                    <h3 className="font-bold text-lg">My Status</h3>
                                    <p className="text-gray-500 text-sm">
                                          {myStories ? 'Tap to view your updates' : 'Tap to add status update'}
                                    </p>
                              </div>
                        </div>
                  </section>

                  {/* Recent Updates */}
                  <section>
                        <h2 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider px-4">Recent Updates</h2>
                        {loading ? (
                              <div className="flex justify-center p-8">
                                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                              </div>
                        ) : recentUpdates.length > 0 ? (
                              <div className="space-y-1">
                                    {recentUpdates.map(group => (
                                          <div
                                                key={group.creator._id}
                                                className="flex items-center gap-4 p-4 hover:bg-black/5 rounded-xl transition-colors cursor-pointer"
                                                onClick={() => setSelectedGroup(group)}
                                          >
                                                <div className="w-16 h-16 rounded-full p-1" style={{ background: 'linear-gradient(45deg, #25D366, #128C7E)' }}>
                                                      <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-white">
                                                            <img
                                                                  src={group.creator.avatar || 'https://via.placeholder.com/64'}
                                                                  alt={group.creator.displayName}
                                                                  className="w-full h-full object-cover"
                                                            />
                                                      </div>
                                                </div>
                                                <div className="flex-1 flex flex-col justify-center">
                                                      <h3 className="font-bold text-lg">{group.creator.displayName || group.creator.username}</h3>
                                                      <p className="text-gray-500 text-sm">
                                                            {group.stories && group.stories.length > 0 ? formatDistanceToNow(new Date(group.stories[group.stories.length - 1].createdAt)) + ' ago' : ''}
                                                      </p>
                                                </div>
                                          </div>
                                    ))}
                              </div>
                        ) : (
                              <div className="text-center py-12 text-gray-400 italic">
                                    <p>No new updates to show</p>
                              </div>
                        )}
                  </section>

                  {/* WhatsApp FAB Style for text status */}
                  <div className="fixed bottom-28 right-6 flex flex-col gap-4 items-center">
                        <button
                              className="w-12 h-12 rounded-full bg-gray-100 shadow-md flex items-center justify-center transition-transform hover:scale-110"
                              onClick={() => navigate('/upload?type=text-status')}
                              title="Text Status"
                        >
                              <span className="text-xl">✍️</span>
                        </button>
                        <button
                              className="w-16 h-16 rounded-full bg-green-500 shadow-xl flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95"
                              onClick={() => navigate('/upload?type=story')}
                              title="Camera Status"
                        >
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                    <circle cx="12" cy="13" r="4" />
                              </svg>
                        </button>
                  </div>

                  {selectedGroup && (
                        <StoryViewer group={selectedGroup} onClose={() => setSelectedGroup(null)} />
                  )}
            </div>
      );
};

export default Status;
