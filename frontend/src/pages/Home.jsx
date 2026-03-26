import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ContentCard from '../components/Content/ContentCard';
import StoryBar from '../components/Story/StoryBar';
import { API_URL } from '../config';

const FEED_MODES = [
      { id: 'all', label: '🌟 All', desc: 'All public content from everyone', icon: '🌟' },
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
      const [searchParams, setSearchParams] = useSearchParams();
      const navigate = useNavigate();

      const topicParam = searchParams.get('topic') || '';
      const [mode, setMode] = useState('all');

      // Always initialize from cache - NEVER show loading to user
      const [contents, setContents] = useState(() => {
            try {
                  const cached = localStorage.getItem('zuno_feedCache_all');
                  return cached ? JSON.parse(cached) : [];
            } catch {
                  return [];
            }
      });

      // loading = false ALWAYS for UI — we refresh silently in background
      const [silentRefreshing, setSilentRefreshing] = useState(false);
      const [error, setError] = useState(null);
      const [page, setPage] = useState(1);
      const [hasMore, setHasMore] = useState(true);
      const [stats, setStats] = useState({ users: '1K+', content: '500+', helpful: '10K+' });

      const fetchFeed = async (currentMode, currentPage, append = false, currentTopic = topicParam) => {
            let hasCachedContent = false;

            if (currentPage === 1 && !append) {
                  try {
                        const cacheKey = currentTopic ? `zuno_feedCache_${currentMode}_${currentTopic}` : `zuno_feedCache_${currentMode}`;
                        const cached = localStorage.getItem(cacheKey);
                        if (cached) {
                              const parsedCache = JSON.parse(cached);
                              if (parsedCache.length > 0) {
                                    setContents(parsedCache);
                                    hasCachedContent = true;
                              }
                        }
                  } catch { }
                  setSilentRefreshing(true);
            } else {
                  hasCachedContent = contents.length > 0;
            }

            // Retry logic with longer timeout for Render.com cold starts
            const attemptFetch = async (timeoutMs) => {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                  try {
                        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
                        const url = new URL(`${API_URL}/feed`);
                        url.searchParams.append('mode', currentMode);
                        url.searchParams.append('page', currentPage);
                        url.searchParams.append('limit', 12);
                        if (currentTopic) url.searchParams.append('topic', currentTopic);
                        const res = await fetch(url.toString(), { headers, signal: controller.signal });
                        clearTimeout(timeoutId);
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        return await res.json();
                  } catch (err) {
                        clearTimeout(timeoutId);
                        throw err;
                  }
            };

            try {
                  let data;
                  try {
                        // First attempt: 12s (fast network or warm server)
                        data = await attemptFetch(12000);
                  } catch (firstErr) {
                        if (firstErr.name === 'AbortError' && !hasCachedContent) {
                              // Server is cold-starting (Render free tier). Show waking up state, retry with 30s.
                              setError('__waking_up__');
                              data = await attemptFetch(35000);
                        } else {
                              throw firstErr;
                        }
                  }

                  if (data && data.success) {
                        const newContents = data.data.contents;
                        if (append) {
                              setContents(prev => {
                                    const existingIds = new Set(prev.map(c => c._id));
                                    const uniqueNew = newContents.filter(c => !existingIds.has(c._id));
                                    return [...prev, ...uniqueNew];
                              });
                        } else {
                              setContents(newContents);
                              try {
                                    const cacheKey = currentTopic ? `zuno_feedCache_${currentMode}_${currentTopic}` : `zuno_feedCache_${currentMode}`;
                                    localStorage.setItem(cacheKey, JSON.stringify(newContents));
                              } catch (e) { }
                        }
                        setHasMore(data.data.pagination.hasMore);
                        setError(null);
                  } else {
                        throw new Error(data?.message || 'Failed to load');
                  }
            } catch (err) {
                  console.error('Feed fetch failed:', err);
                  if (!hasCachedContent) {
                        setError(err.name === 'AbortError' ? 'timeout' : 'network');
                  } else {
                        setError(null); // Have cached content — hide error silently
                  }
            } finally {
                  setSilentRefreshing(false);
            }
      };

      useEffect(() => {
            setPage(1);
            fetchFeed(mode, 1, false, topicParam);
      }, [mode, token, topicParam]);

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
                                                      setSearchParams({ topic: cat.id });
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
                                          Your <span className="text-gradient">{topicParam ? `${topicParam.charAt(0).toUpperCase() + topicParam.slice(1)}` : 'Feed'}</span>
                                    </h2>
                                    <p className="section-subtitle">
                                          {topicParam ? `Showing top content for ${topicParam}` : 'Choose your vibe. No algorithm forcing content on you.'}
                                    </p>
                                    {topicParam && (
                                          <button
                                                className="btn btn-sm btn-secondary mt-sm"
                                                onClick={() => setSearchParams({})}
                                          >
                                                ✕ Clear Filter
                                          </button>
                                    )}

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

                              {/* Error State - Server Waking Up or Network Error */}
                              {contents.length === 0 && error ? (
                                    error === '__waking_up__' ? (
                                    <div className="card p-xl text-center" style={{ maxWidth: '600px', margin: '40px auto', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.08))', borderColor: 'rgba(99,102,241,0.3)' }}>
                                          <div style={{ fontSize: '3rem', marginBottom: '16px', animation: 'spin 2s linear infinite', display: 'inline-block' }}>☀️</div>
                                          <h3 className="text-xl font-bold mb-sm" style={{ color: '#818cf8' }}>Server Waking Up...</h3>
                                          <p className="text-muted mb-sm">Our free server takes ~30s to start. Please wait!</p>
                                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', margin: '12px 0 20px' }}>
                                                {[0,1,2,3,4].map(i => (
                                                      <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', animation: `callDot 1.4s ease-in-out ${i * 0.28}s infinite` }} />
                                                ))}
                                          </div>
                                          <button onClick={() => fetchFeed(mode, 1, false)} className="btn btn-secondary mx-auto flex" style={{ fontSize: '0.9rem' }}>
                                                🔄 Retry Now
                                          </button>
                                    </div>
                                    ) : (
                                    <div className="card p-xl text-center" style={{ maxWidth: '600px', margin: '40px auto', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                                          <div className="empty-state-icon mb-md">⚠️</div>
                                          <h3 className="text-xl font-bold text-red-500 mb-sm">Connection Issue</h3>
                                          <p className="text-muted mb-lg">Network error. Check your connection and try again.</p>
                                          <button onClick={() => fetchFeed(mode, 1, false)} className="btn btn-primary mx-auto flex">
                                                🔄 Retry Connection
                                          </button>
                                    </div>
                                    )
                              ) : contents.length === 0 && silentRefreshing ? (
                                    <div className="animate-fadeIn" style={{ padding: 'var(--space-xl) 0' }}>
                                          {/* Loading skeleton cards */}
                                          <div className="home-feed-grid">
                                                {[1, 2, 3, 4, 5, 6].map(i => (
                                                      <div key={i} style={{
                                                            background: 'var(--color-surface)',
                                                            border: '1px solid var(--color-border)',
                                                            borderRadius: '16px',
                                                            padding: '20px',
                                                            animationDelay: `${i * 0.1}s`
                                                      }}>
                                                            {/* Avatar + name row */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                                                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(90deg, var(--color-border) 25%, rgba(255,255,255,0.05) 50%, var(--color-border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }}></div>
                                                                  <div style={{ flex: 1 }}>
                                                                        <div style={{ height: '12px', width: '120px', borderRadius: '6px', background: 'linear-gradient(90deg, var(--color-border) 25%, rgba(255,255,255,0.05) 50%, var(--color-border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', marginBottom: '8px' }}></div>
                                                                        <div style={{ height: '10px', width: '80px', borderRadius: '5px', background: 'linear-gradient(90deg, var(--color-border) 25%, rgba(255,255,255,0.05) 50%, var(--color-border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }}></div>
                                                                  </div>
                                                            </div>
                                                            {/* Thumbnail */}
                                                            <div style={{ height: '160px', borderRadius: '10px', background: 'linear-gradient(90deg, var(--color-border) 25%, rgba(255,255,255,0.05) 50%, var(--color-border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', marginBottom: '14px' }}></div>
                                                            {/* Title lines */}
                                                            <div style={{ height: '14px', width: '90%', borderRadius: '6px', background: 'linear-gradient(90deg, var(--color-border) 25%, rgba(255,255,255,0.05) 50%, var(--color-border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', marginBottom: '8px' }}></div>
                                                            <div style={{ height: '12px', width: '60%', borderRadius: '5px', background: 'linear-gradient(90deg, var(--color-border) 25%, rgba(255,255,255,0.05) 50%, var(--color-border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }}></div>
                                                      </div>
                                                ))}
                                          </div>
                                          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '24px', fontSize: '14px' }}>
                                                ⚡ Loading your feed...
                                          </p>
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
                                          <div className="home-feed-grid">
                                                {contents.map((content, idx) => (
                                                      <div
                                                            key={content._id}
                                                            style={{ animationDelay: `${(idx % 6) * 0.07}s` }}
                                                      >
                                                            <ContentCard content={content} />
                                                      </div>
                                                ))}
                                          </div>

                                          {/* Load More Button */}
                                          {hasMore && (
                                                <div className="text-center mt-2xl animate-fadeIn">
                                                      <button
                                                            onClick={loadMore}
                                                            className="btn btn-secondary btn-lg"
                                                            disabled={silentRefreshing}
                                                      >
                                                            {silentRefreshing ? <span className="spinner"></span> : '📖 Load More Content'}
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

                                          <Link to="/" className="feature-card animate-fadeInUp stagger-3" onClick={() => { setMode('calm'); setSearchParams({}); }}>
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
                        marginTop: 'var(--space-2xl)',
                        background: 'linear-gradient(180deg, transparent 0%, rgba(99, 102, 241, 0.03) 100%)'
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
                              <div style={{
                                    marginTop: 'var(--space-lg)',
                                    paddingTop: 'var(--space-lg)',
                                    borderTop: '1px solid var(--color-border)',
                                    textAlign: 'center'
                              }}>
                                    <p className="text-muted text-sm">
                                          © 2026 ZUNO. Built for learning, growth, and peace of mind.
                                    </p>
                                    <p style={{
                                          marginTop: 'var(--space-sm)',
                                          fontSize: '14px',
                                          fontWeight: '600',
                                          background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)',
                                          WebkitBackgroundClip: 'text',
                                          WebkitTextFillColor: 'transparent',
                                          backgroundClip: 'text'
                                    }}>
                                          ✨ Created by LOKENDRA KUMAR ✨
                                    </p>
                              </div>
                        </div>
                  </footer>
            </div>
      );
};

export default Home;
