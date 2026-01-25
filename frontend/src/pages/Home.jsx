import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ContentCard from '../components/Content/ContentCard';
import StoryBar from '../components/Story/StoryBar';
import { API_URL } from '../config';

const FEED_MODES = [
      { id: 'learning', label: '📚 Learning', desc: 'Skills, tutorials & explanations', icon: '📚' },
      { id: 'calm', label: '🧘 Calm', desc: 'Inspiration & peaceful stories', icon: '🧘' },
      { id: 'video', label: '🎬 Video', desc: 'Watch & learn visually', icon: '🎬' },
      { id: 'reading', label: '📖 Reading', desc: 'Articles & text posts', icon: '📖' },
      { id: 'problem-solving', label: '💡 Solutions', desc: 'Questions & answers', icon: '💡' }
];

const FEATURES = [
      { icon: '🧠', title: 'Learn & Grow', desc: 'Content focused on value, not likes', color: '#6366f1' },
      { icon: '🔒', title: 'Private Feedback', desc: 'Your reactions are never public', color: '#8b5cf6' },
      { icon: '🧘', title: 'Focus Mode', desc: 'Hide all metrics for peace', color: '#06b6d4' },
      { icon: '⚖️', title: 'Fair for All', desc: 'New creators get equal chance', color: '#22c55e' }
];

const CATEGORIES = [
      { id: 'technology', icon: '💻', label: 'Technology', color: '#6366f1' },
      { id: 'creativity', icon: '🎨', label: 'Creativity', color: '#ec4899' },
      { id: 'health', icon: '💪', label: 'Health', color: '#22c55e' },
      { id: 'business', icon: '💼', label: 'Business', color: '#f59e0b' },
      { id: 'science', icon: '🔬', label: 'Science', color: '#06b6d4' },
      { id: 'arts', icon: '🎭', label: 'Arts', color: '#a855f7' },
      { id: 'learning', icon: '📚', label: 'Learning', color: '#f97316' },
      { id: 'lifestyle', icon: '🌟', label: 'Lifestyle', color: '#14b8a6' }
];

const Home = () => {
      const { token, isAuthenticated, user } = useAuth();
      const { t } = useLanguage();
      const [mode, setMode] = useState('learning');
      const [contents, setContents] = useState([]);
      const [loading, setLoading] = useState(true);
      const [page, setPage] = useState(1);
      const [hasMore, setHasMore] = useState(true);
      const [stats, setStats] = useState({ users: '1K+', content: '500+', helpful: '10K+' });

      const fetchFeed = async (currentMode, currentPage, append = false) => {
            setLoading(true);
            try {
                  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
                  const res = await fetch(`${API_URL}/feed?mode=${currentMode}&page=${currentPage}&limit=9`, { headers });
                  const data = await res.json();

                  if (data.success) {
                        if (append) {
                              setContents(prev => [...prev, ...data.data.contents]);
                        } else {
                              setContents(data.data.contents);
                        }
                        setHasMore(data.data.pagination.hasMore);
                  }
            } catch (error) {
                  console.error('Failed to fetch feed:', error);
            }
            setLoading(false);
      };

      useEffect(() => {
            setPage(1);
            fetchFeed(mode, 1, false);
      }, [mode, token]);

      const loadMore = () => {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchFeed(mode, nextPage, true);
      };

      return (
            <div className="home-page">
                  {/* Hero Section - For Non-Logged Users */}
                  {!isAuthenticated && (
                        <section className="hero">
                              <div className="hero-bg"></div>
                              <div className="hero-content">
                                    <div className="hero-badge">
                                          <span className="hero-badge-dot"></span>
                                          <span>A New Kind of Platform</span>
                                    </div>

                                    <h1 className="hero-title">
                                          {t('heroTitle') || 'Learn, Grow & Share'} <br />
                                          <span className="text-gradient">{t('heroSubtitle') || 'Without the Noise'}</span>
                                    </h1>

                                    <p className="hero-subtitle">
                                          ZUNO is a calm, value-focused platform for meaningful sharing.
                                          No addiction tricks. No follower race. Just pure learning and growth.
                                    </p>

                                    <div className="hero-buttons">
                                          <Link to="/register" className="btn btn-primary btn-lg">
                                                ✨ {t('join')}
                                          </Link>
                                          <Link to="/login" className="btn btn-secondary btn-lg">
                                                {t('login')}
                                          </Link>
                                    </div>

                                    <div className="hero-stats">
                                          <div className="hero-stat">
                                                <div className="hero-stat-value">{stats.users}</div>
                                                <div className="hero-stat-label">Happy Users</div>
                                          </div>
                                          <div className="hero-stat">
                                                <div className="hero-stat-value">{stats.content}</div>
                                                <div className="hero-stat-label">Quality Content</div>
                                          </div>
                                          <div className="hero-stat">
                                                <div className="hero-stat-value">{stats.helpful}</div>
                                                <div className="hero-stat-label">Helpful Marks</div>
                                          </div>
                                    </div>
                              </div>
                        </section>
                  )}

                  {/* Stories Section - For Logged Users */}
                  {isAuthenticated && (
                        <div className="container mt-md animate-fadeIn">
                              <StoryBar />
                        </div>
                  )}

                  {/* Welcome Back - For Logged Users */}
                  {isAuthenticated && (
                        <section className="section animate-fadeIn" style={{ paddingTop: 'var(--space-md)' }}>
                              <div className="card" style={{
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                    marginBottom: 'var(--space-xl)'
                              }}>
                                    <div className="flex items-center justify-between flex-wrap gap-lg">
                                          <div>
                                                <h2 className="text-2xl font-bold mb-sm">
                                                      {t('welcomeBack')}, <span className="text-gradient">{user?.displayName || user?.username}</span>! 👋
                                                </h2>
                                                <p className="text-secondary">Ready to learn something new today?</p>
                                          </div>
                                          <div className="flex gap-md">
                                                <Link to="/upload" className="btn btn-primary">
                                                      ➕ {t('upload')}
                                                </Link>
                                                <Link to="/profile" className="btn btn-secondary">
                                                      👤 {t('profile')}
                                                </Link>
                                          </div>
                                    </div>
                              </div>
                        </section>
                  )}

                  {/* Features Section */}
                  {!isAuthenticated && (
                        <section className="section">
                              <div className="container">
                                    <h2 className="section-title animate-fadeInUp">
                                          Why <span className="text-gradient">ZUNO</span>?
                                    </h2>
                                    <p className="section-subtitle animate-fadeInUp stagger-1">
                                          Built different. Feels different. Actually helps you grow.
                                    </p>

                                    <div className="grid grid-cols-4 gap-lg">
                                          {FEATURES.map((feature, idx) => (
                                                <div
                                                      key={feature.title}
                                                      className={`feature-card animate-fadeInUp stagger-${idx + 1}`}
                                                >
                                                      <div className="feature-icon" style={{ background: `linear-gradient(135deg, ${feature.color}, ${feature.color}dd)` }}>
                                                            {feature.icon}
                                                      </div>
                                                      <h3 className="text-lg font-semibold mb-sm">{feature.title}</h3>
                                                      <p className="text-secondary text-sm">{feature.desc}</p>
                                                </div>
                                          ))}
                                    </div>
                              </div>
                        </section>
                  )}

                  {/* Categories Section */}
                  <section className="section">
                        <div className="container">
                              <h2 className="section-title animate-fadeInUp">
                                    Explore <span className="text-gradient-pink">Topics</span>
                              </h2>
                              <p className="section-subtitle animate-fadeInUp">
                                    Subscribe to topics you love, not people you don't know
                              </p>

                              <div className="grid grid-cols-4 gap-md">
                                    {CATEGORIES.map((cat, idx) => (
                                          <Link
                                                key={cat.id}
                                                to={`/?topic=${cat.id}`}
                                                className={`card text-center animate-fadeInUp stagger-${(idx % 4) + 1}`}
                                                style={{
                                                      cursor: 'pointer',
                                                      borderColor: `${cat.color}33`
                                                }}
                                                onClick={(e) => {
                                                      e.preventDefault();
                                                      // Could filter by topic
                                                }}
                                          >
                                                <div
                                                      style={{
                                                            fontSize: '2.5rem',
                                                            marginBottom: 'var(--space-sm)',
                                                            filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.2))'
                                                      }}
                                                >
                                                      {cat.icon}
                                                </div>
                                                <div className="font-semibold" style={{ color: cat.color }}>{cat.label}</div>
                                          </Link>
                                    ))}
                              </div>
                        </div>
                  </section>

                  {/* Feed Mode Selector */}
                  <section className="section" style={{ paddingTop: 0 }}>
                        <div className="container">
                              <div className="feed-header animate-fadeIn">
                                    <h2 className="section-title">
                                          Your <span className="text-gradient">Feed</span>
                                    </h2>
                                    <p className="section-subtitle">Choose your vibe. No algorithm forcing content on you.</p>

                                    <div className="mode-pills" style={{ maxWidth: '800px', margin: '0 auto' }}>
                                          {FEED_MODES.map(m => (
                                                <button
                                                      key={m.id}
                                                      className={`mode-pill ${mode === m.id ? 'active' : ''}`}
                                                      onClick={() => setMode(m.id)}
                                                >
                                                      {m.label}
                                                </button>
                                          ))}
                                    </div>
                                    <p className="text-sm text-muted mt-md text-center">
                                          {FEED_MODES.find(m => m.id === mode)?.desc}
                                    </p>
                              </div>

                              {/* Content Grid */}
                              {loading && contents.length === 0 ? (
                                    <div className="empty-state">
                                          <div className="spinner" style={{ margin: '0 auto' }}></div>
                                          <p className="mt-md">Loading amazing content...</p>
                                    </div>
                              ) : contents.length === 0 ? (
                                    <div className="empty-state animate-fadeIn">
                                          <div className="empty-state-icon">📭</div>
                                          <h3 className="text-xl font-semibold mb-sm">No content yet in this mode</h3>
                                          <p className="text-muted mb-lg">Be the first to share something valuable!</p>
                                          {isAuthenticated ? (
                                                <Link to="/upload" className="btn btn-primary">
                                                      ➕ Upload Content
                                                </Link>
                                          ) : (
                                                <Link to="/register" className="btn btn-primary">
                                                      Join to Upload
                                                </Link>
                                          )}
                                    </div>
                              ) : (
                                    <>
                                          <div className="content-grid mt-xl">
                                                {contents.map((content, idx) => (
                                                      <div
                                                            key={content._id}
                                                            className={`animate-fadeInUp stagger-${(idx % 3) + 1}`}
                                                            style={{ opacity: 0 }}
                                                      >
                                                            <ContentCard content={content} />
                                                      </div>
                                                ))}
                                          </div>

                                          {/* Load More Button (Conscious Choice - No Infinite Scroll) */}
                                          {hasMore && (
                                                <div className="text-center mt-2xl animate-fadeIn">
                                                      <button
                                                            onClick={loadMore}
                                                            className="btn btn-secondary btn-lg"
                                                            disabled={loading}
                                                      >
                                                            {loading ? <span className="spinner"></span> : '📖 Load More Content'}
                                                      </button>
                                                      <p className="text-sm text-muted mt-md">
                                                            🧘 Take a moment. Loading more is always your choice.
                                                      </p>
                                                </div>
                                          )}
                                    </>
                              )}
                        </div>
                  </section>

                  {/* Quick Actions - For Logged Users */}
                  {isAuthenticated && (
                        <section className="section">
                              <div className="container">
                                    <h2 className="section-title animate-fadeInUp">
                                          Quick <span className="text-gradient">Actions</span>
                                    </h2>

                                    <div className="grid grid-cols-4 gap-lg mt-xl">
                                          <Link to="/upload" className="feature-card animate-fadeInUp stagger-1">
                                                <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                                                      📤
                                                </div>
                                                <h3 className="font-semibold">Upload</h3>
                                                <p className="text-sm text-muted">Share your knowledge</p>
                                          </Link>

                                          <Link to="/profile" className="feature-card animate-fadeInUp stagger-2">
                                                <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #ec4899, #f97316)' }}>
                                                      👤
                                                </div>
                                                <h3 className="font-semibold">Profile</h3>
                                                <p className="text-sm text-muted">Manage your settings</p>
                                          </Link>

                                          <Link to="/?mode=calm" className="feature-card animate-fadeInUp stagger-3" onClick={() => setMode('calm')}>
                                                <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #06b6d4, #22d3ee)' }}>
                                                      🧘
                                                </div>
                                                <h3 className="font-semibold">Calm Mode</h3>
                                                <p className="text-sm text-muted">Peaceful browsing</p>
                                          </Link>

                                          <Link to="/content/saved" className="feature-card animate-fadeInUp stagger-4">
                                                <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                                                      📌
                                                </div>
                                                <h3 className="font-semibold">Saved</h3>
                                                <p className="text-sm text-muted">Your bookmarks</p>
                                          </Link>
                                    </div>
                              </div>
                        </section>
                  )}

                  {/* CTA Section - For Non-Logged Users */}
                  {!isAuthenticated && (
                        <section className="section" style={{ background: 'var(--gradient-hero)' }}>
                              <div className="container text-center">
                                    <h2 className="section-title animate-fadeInUp">
                                          Ready to <span className="text-gradient-pink">Join</span>?
                                    </h2>
                                    <p className="section-subtitle animate-fadeInUp stagger-1">
                                          Start your journey of learning and growth. No addictions. No noise.
                                    </p>
                                    <div className="flex justify-center gap-md animate-fadeInUp stagger-2">
                                          <Link to="/register" className="btn btn-primary btn-lg animate-glow">
                                                ✨ Create Free Account
                                          </Link>
                                    </div>
                              </div>
                        </section>
                  )}

                  {/* Footer */}
                  <footer style={{
                        padding: 'var(--space-xl) 0',
                        borderTop: '1px solid var(--color-border)',
                        marginTop: 'var(--space-2xl)'
                  }}>
                        <div className="container">
                              <div className="flex justify-between items-center flex-wrap gap-lg">
                                    <div className="flex items-center gap-sm">
                                          <div className="logo-icon" style={{ width: '32px', height: '32px', fontSize: 'var(--font-size-sm)' }}>Z</div>
                                          <span className="font-bold">ZUNO</span>
                                          <span className="text-muted text-sm">• Value Platform</span>
                                    </div>
                                    <div className="flex gap-lg text-sm text-muted">
                                          <span>🧘 Focus on Value</span>
                                          <span>🔒 Privacy First</span>
                                          <span>💚 No Addiction</span>
                                    </div>
                              </div>
                              <p className="text-center text-muted text-sm mt-lg">
                                    © 2026 ZUNO. Built for learning, growth, and peace of mind.
                              </p>
                        </div>
                  </footer>
            </div>
      );
};

export default Home;
