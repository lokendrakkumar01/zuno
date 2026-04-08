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
                  setError(null);
            } else {
                  hasCachedContent = contents.length > 0;
            }

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
                        data = await attemptFetch(20000);
                  } catch (firstErr) {
                        if (firstErr.name === 'AbortError') {
                              setError('__waking_up__');
                              data = await attemptFetch(45000);
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
                  {/* Stories Section */}
                  <div className="container mt-md animate-fadeIn">
                        <StoryBar />
                  </div>

                  {/* Feed Section */}
                  <section className="section">
                        <div className="container">
                              <div className="feed-header mb-xl">
                                    <div className="flex items-center justify-between flex-wrap gap-md">
                                          <div className="flex gap-md overflow-x-auto pb-sm no-scrollbar">
                                                {FEED_MODES.map(m => (
                                                      <button
                                                            key={m.id}
                                                            onClick={() => setMode(m.id)}
                                                            className={`mode-btn ${mode === m.id ? 'active' : ''}`}
                                                      >
                                                            {m.label}
                                                      </button>
                                                ))}
                                          </div>
                                          {topicParam && (
                                                <div className="topic-badge">
                                                      <span># {topicParam}</span>
                                                      <button onClick={() => setSearchParams({})}>✕</button>
                                                </div>
                                          )}
                                    </div>
                              </div>

                              {/* Error States */}
                              {error === '__waking_up__' && contents.length === 0 && (
                                    <div className="text-center py-xl">
                                          <div className="loader mb-md"></div>
                                          <h3 className="text-lg">ZUNO is waking up...</h3>
                                          <p className="text-secondary">Please wait a few seconds while we warm up the servers.</p>
                                    </div>
                              )}

                              {error === 'network' && contents.length === 0 && (
                                    <div className="text-center py-xl">
                                          <p className="text-danger mb-md">⚠️ Unable to connect to the server.</p>
                                          <button onClick={() => fetchFeed(mode, 1)} className="btn btn-primary">Try Again</button>
                                    </div>
                              )}

                              {/* Feed Grid */}
                              <div className="grid grid-cols-1 md-grid-cols-2 lg-grid-cols-3 gap-xl">
                                    {contents.map((content, idx) => (
                                          <div key={content._id} className="animate-fadeInUp" style={{ animationDelay: `${idx * 0.05}s` }}>
                                                <ContentCard content={content} />
                                          </div>
                                    ))}
                              </div>

                              {/* Empty State */}
                              {contents.length === 0 && !silentRefreshing && !error && (
                                    <div className="text-center py-3xl card glass">
                                          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🍃</div>
                                          <h3 className="text-xl font-bold mb-sm">Quiet for now</h3>
                                          <p className="text-secondary mb-xl">Be the first to share something meaningful in this category!</p>
                                          <Link to="/upload" className="btn btn-primary">
                                                ➕ Start Creating
                                          </Link>
                                    </div>
                              )}

                              {/* Load More */}
                              {hasMore && contents.length > 0 && (
                                    <div className="text-center mt-3xl">
                                          <button
                                                onClick={loadMore}
                                                disabled={silentRefreshing}
                                                className="btn btn-secondary"
                                          >
                                                {silentRefreshing ? 'Loading...' : 'Load More Content'}
                                          </button>
                                    </div>
                              )}
                        </div>
                  </section>

                  {/* Silent Refresh Indicator */}
                  {silentRefreshing && contents.length > 0 && (
                        <div style={{
                              position: 'fixed',
                              bottom: '80px',
                              right: '20px',
                              background: 'var(--color-bg-card)',
                              padding: '8px 16px',
                              borderRadius: 'var(--radius-full)',
                              boxShadow: 'var(--shadow-lg)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px',
                              zIndex: 1000,
                              border: '1px solid var(--color-border)'
                        }}>
                              <div className="loader-xs"></div>
                              <span>Updating...</span>
                        </div>
                  )}
            </div>
      );
};

export default Home;
