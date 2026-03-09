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
            <div className="status-page container animate-fadeIn" style={{ paddingBottom: '96px' }}>
                  <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingTop: '16px' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Status</h1>
                        <div style={{ display: 'flex', gap: '8px' }}>
                              <button className="btn btn-icon" style={{ background: 'var(--color-bg-hover)', fontSize: '20px' }}>
                                    🔍
                              </button>
                              <button className="btn btn-icon" style={{ background: 'var(--color-bg-hover)', fontSize: '20px' }}>
                                    ⋮
                              </button>
                        </div>
                  </header>

                  {/* My Status */}
                  <section style={{ marginBottom: '32px' }}>
                        <div
                              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '12px', cursor: 'pointer', background: 'var(--color-bg-secondary)' }}
                              onClick={() => myStories ? setSelectedGroup(myStories) : navigate('/upload?type=story')}
                        >
                              <div style={{ position: 'relative' }}>
                                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', padding: '4px', background: myStories ? 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' : 'var(--color-border-light)' }}>
                                          <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2px solid var(--color-bg-primary)', overflow: 'hidden', background: 'var(--color-bg-primary)' }}>
                                                <img
                                                      src={user?.avatar || 'https://via.placeholder.com/64'}
                                                      alt="My Status"
                                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                          </div>
                                    </div>
                                    {!myStories && (
                                          <div style={{ position: 'absolute', bottom: '0', right: '0', background: 'var(--color-accent-success)', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--color-bg-primary)', fontSize: '18px', fontWeight: 'bold' }}>
                                                +
                                          </div>
                                    )}
                              </div>
                              <div style={{ flex: 1 }}>
                                    <h3 style={{ fontWeight: 'bold', fontSize: '18px' }}>My Status</h3>
                                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                                          {myStories ? 'Tap to view your updates' : 'Tap to add status update'}
                                    </p>
                              </div>
                        </div>
                  </section>

                  {/* Recent Updates */}
                  <section>
                        <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Updates</h2>
                        {loading ? (
                              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                                    <div style={{ width: '32px', height: '32px', border: '4px solid var(--color-bg-hover)', borderTopColor: 'var(--color-accent-primary)', borderRadius: '50%' }} className="animate-spin"></div>
                              </div>
                        ) : recentUpdates.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {recentUpdates.map(group => (
                                          <div
                                                key={group.creator._id}
                                                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '12px', cursor: 'pointer', background: 'var(--color-bg-secondary)' }}
                                                onClick={() => setSelectedGroup(group)}
                                          >
                                                <div style={{ width: '64px', height: '64px', borderRadius: '50%', padding: '4px', background: 'linear-gradient(45deg, #25D366, #128C7E)' }}>
                                                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2px solid var(--color-bg-primary)', overflow: 'hidden', background: 'var(--color-bg-primary)' }}>
                                                            <img
                                                                  src={group.creator.avatar || 'https://via.placeholder.com/64'}
                                                                  alt={group.creator.displayName}
                                                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            />
                                                      </div>
                                                </div>
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                      <h3 style={{ fontWeight: 'bold', fontSize: '18px' }}>{group.creator.displayName || group.creator.username}</h3>
                                                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                                                            {group.stories && group.stories.length > 0 ? formatDistanceToNow(new Date(group.stories[group.stories.length - 1].createdAt)) + ' ago' : ''}
                                                      </p>
                                                </div>
                                          </div>
                                    ))}
                              </div>
                        ) : (
                              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                    <p>No new updates to show</p>
                              </div>
                        )}
                  </section>

                  {/* WhatsApp FAB Style for text status */}
                  <div style={{ position: 'fixed', bottom: '112px', right: '24px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                        <button
                              style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-bg-hover)', boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
                              onClick={() => navigate('/upload?type=text-status')}
                              title="Text Status"
                        >
                              <span style={{ fontSize: '20px' }}>✍️</span>
                        </button>
                        <button
                              style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-accent-success)', boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', border: 'none', cursor: 'pointer' }}
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
