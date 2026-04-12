import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ContentCard from '../components/Content/ContentCard';
import StoryBar from '../components/Story/StoryBar';
import { API_URL } from '../config';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const PRIMARY_FEED_TIMEOUT_MS = 22000;
const WAKE_FEED_TIMEOUT_MS = 50000;

const FEED_MODES = [
      { id: 'all', label: 'All', desc: 'A fast mix of current conversations, posts and videos.' },
      { id: 'learning', label: 'Learning', desc: 'Tutorials, skill building and explainers.' },
      { id: 'calm', label: 'Calm', desc: 'Inspiration, reflection and low-noise updates.' },
      { id: 'video', label: 'Video', desc: 'Short and long videos optimized for quick watching.' },
      { id: 'reading', label: 'Reading', desc: 'Text-first posts and deeper breakdowns.' },
      { id: 'problem-solving', label: 'Solutions', desc: 'Questions, answers and practical help.' }
];

const FALLBACK_TOPICS = ['learning', 'technology', 'creativity', 'business', 'problem-solving'];

const readFeedCache = (key) => {
      try {
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
      } catch {
            return [];
      }
};

const Home = () => {
      const { token, user } = useAuth();
      const [searchParams, setSearchParams] = useSearchParams();
      const topicParam = searchParams.get('topic') || '';
      const [mode, setMode] = useState('all');

      const [contents, setContents] = useState(() => readFeedCache('zuno_feedCache_all'));
      const [silentRefreshing, setSilentRefreshing] = useState(false);
      const [error, setError] = useState(null);
      const [page, setPage] = useState(1);
      const [hasMore, setHasMore] = useState(true);

      const feedRequestGenRef = useRef(0);

      const wakeBackend = async () => {
            try {
                  await fetch(`${API_URL}/ping`, { cache: 'no-store' });
            } catch {
                  // Best-effort wake only.
            }
      };

      const fetchFeed = async (currentMode, currentPage, append = false, currentTopic = topicParam) => {
            const myGen = ++feedRequestGenRef.current;
            let hasCachedContent = false;

            if (currentPage === 1 && !append) {
                  const modeKey = currentTopic ? `zuno_feedCache_${currentMode}_${currentTopic}` : `zuno_feedCache_${currentMode}`;
                  let fromCache = readFeedCache(modeKey);
                  if (fromCache.length === 0 && currentMode !== 'all') {
                        fromCache = readFeedCache('zuno_feedCache_all');
                  }
                  if (fromCache.length > 0) {
                        setContents(fromCache);
                        hasCachedContent = true;
                  }

                  setSilentRefreshing(true);
                  setError(null);
            } else {
                  hasCachedContent = contents.length > 0;
            }

            const buildUrl = () => {
                  const url = new URL(`${API_URL}/feed`);
                  url.searchParams.append('mode', currentMode);
                  url.searchParams.append('page', currentPage);
                  url.searchParams.append('limit', 12);
                  if (currentTopic) {
                        url.searchParams.append('topic', currentTopic);
                  }
                  return url.toString();
            };

            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const attemptFetch = async (timeoutMs) => {
                  return fetchWithTimeout(buildUrl(), { headers }, timeoutMs);
            };

            try {
                  let res;

                  try {
                        res = await attemptFetch(PRIMARY_FEED_TIMEOUT_MS);
                  } catch (firstErr) {
                        if (firstErr?.name !== 'AbortError') {
                              throw firstErr;
                        }
                        if (myGen !== feedRequestGenRef.current) {
                              return;
                        }
                        setError('__waking_up__');
                        await wakeBackend();
                        res = await attemptFetch(WAKE_FEED_TIMEOUT_MS);
                  }

                  if (myGen !== feedRequestGenRef.current) {
                        return;
                  }

                  if (!res.ok) {
                        throw new Error(`HTTP ${res.status}`);
                  }

                  const data = await res.json();

                  if (myGen !== feedRequestGenRef.current) {
                        return;
                  }

                  if (data?.success) {
                        const newContents = data.data.contents || [];

                        if (append) {
                              setContents((prev) => {
                                    const existingIds = new Set(prev.map((item) => item._id));
                                    const uniqueNew = newContents.filter((item) => !existingIds.has(item._id));
                                    return [...prev, ...uniqueNew];
                              });
                        } else {
                              setContents(newContents);

                              try {
                                    const cacheKey = currentTopic ? `zuno_feedCache_${currentMode}_${currentTopic}` : `zuno_feedCache_${currentMode}`;
                                    localStorage.setItem(cacheKey, JSON.stringify(newContents));
                              } catch {
                                    // best-effort
                              }
                        }

                        setHasMore(Boolean(data.data.pagination?.hasMore));
                        setError(null);
                  } else {
                        throw new Error(data?.message || 'Failed to load');
                  }
            } catch (err) {
                  if (myGen !== feedRequestGenRef.current) {
                        return;
                  }
                  console.error('Feed fetch failed:', err);
                  if (!hasCachedContent) {
                        setError(err?.name === 'AbortError' ? 'timeout' : 'network');
                  } else {
                        setError(null);
                  }
            } finally {
                  if (myGen === feedRequestGenRef.current) {
                        setSilentRefreshing(false);
                  }
            }
      };

      useEffect(() => {
            setPage(1);
            fetchFeed(mode, 1, false, topicParam);

            return () => {
                  feedRequestGenRef.current += 1;
            };
      }, [mode, token, topicParam]);

      const loadMore = () => {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchFeed(mode, nextPage, true, topicParam);
      };

      const derivedTopics = Array.from(
            new Set(contents.flatMap((content) => content.topics || []).filter(Boolean))
      ).slice(0, 6);
      const quickTopics = derivedTopics.length > 0 ? derivedTopics : FALLBACK_TOPICS;
      const selectedMode = FEED_MODES.find((item) => item.id === mode) || FEED_MODES[0];
      const videoCount = contents.filter((item) => item.contentType?.includes('video')).length;
      const textCount = contents.filter((item) => item.contentType === 'post').length;

      return (
            <div className="home-page">
                  <section className="home-hero-shell">
                        <div className="container home-hero">
                              <div className="home-hero-copy">
                                    <span className="home-kicker">Fast social feed</span>
                                    <h1>{user?.displayName ? `Welcome back, ${user.displayName.split(' ')[0]}` : 'Your ZUNO home'}</h1>
                                    <p>
                                          Clean navigation, fast loading, and a quieter feed that still keeps chat, live streams and sharing close at hand.
                                    </p>

                                    <div className="home-hero-actions">
                                          <Link to="/upload" className="btn btn-primary">Create Post</Link>
                                          <Link to="/profile" className="btn btn-secondary">Open Profile Inbox</Link>
                                      </div>

                                    <div className="home-hero-topics">
                                          {quickTopics.map((topic) => (
                                                <button
                                                      key={topic}
                                                      type="button"
                                                      className={`home-topic-pill ${topicParam === topic ? 'active' : ''}`}
                                                      onClick={() => setSearchParams({ topic })}
                                                >
                                                      #{topic}
                                                </button>
                                          ))}
                                          {topicParam && (
                                                <button type="button" className="home-topic-clear" onClick={() => setSearchParams({})}>
                                                      Clear topic
                                                </button>
                                          )}
                                    </div>
                              </div>

                              <div className="home-hero-panels">
                                    <div className="home-summary-card">
                                          <span className="home-summary-label">Current mode</span>
                                          <strong>{selectedMode.label}</strong>
                                          <p>{selectedMode.desc}</p>
                                    </div>
                                    <div className="home-stat-grid">
                                          <div className="home-stat-card">
                                                <span>Loaded now</span>
                                                <strong>{contents.length}</strong>
                                          </div>
                                          <div className="home-stat-card">
                                                <span>Video</span>
                                                <strong>{videoCount}</strong>
                                          </div>
                                          <div className="home-stat-card">
                                                <span>Reading</span>
                                                <strong>{textCount}</strong>
                                          </div>
                                          <div className="home-stat-card">
                                                <span>Live</span>
                                                <strong>{mode === 'video' ? 'Ready' : 'Discover'}</strong>
                                          </div>
                                    </div>
                              </div>
                        </div>
                  </section>

                  <div className="container home-story-strip">
                        <StoryBar />
                  </div>

                  <section className="section">
                        <div className="container">
                              <div className="feed-header home-feed-toolbar">
                                    <div className="home-mode-scroller">
                                          {FEED_MODES.map((feedMode) => (
                                                <button
                                                      key={feedMode.id}
                                                      type="button"
                                                      onClick={() => setMode(feedMode.id)}
                                                      className={`mode-btn ${mode === feedMode.id ? 'active' : ''}`}
                                                >
                                                      {feedMode.label}
                                                </button>
                                          ))}
                                    </div>

                                    <div className="home-toolbar-status">
                                          {silentRefreshing && contents.length === 0 ? (
                                                <span className="home-inline-loader" aria-hidden />
                                          ) : !silentRefreshing ? (
                                                <span className="text-secondary" style={{ fontSize: '0.88rem' }}>Scroll to explore</span>
                                          ) : null}
                                    </div>
                              </div>

                              {error === '__waking_up__' && contents.length === 0 && (
                                    <div className="text-center py-xl">
                                          <div className="loader mb-md" />
                                          <h3 className="text-lg">Preparing your feed...</h3>
                                          <p className="text-secondary">The server may be waking up — loading the latest posts.</p>
                                    </div>
                              )}

                              {(error === 'network' || error === 'timeout') && contents.length === 0 && (
                                    <div className="text-center py-xl">
                                          <p className="text-secondary mb-md">
                                                {error === 'timeout'
                                                      ? 'The feed is taking longer than usual.'
                                                      : 'Unable to reach the server right now.'}
                                          </p>
                                          <button
                                                type="button"
                                                onClick={() => fetchFeed(mode, 1, false, topicParam)}
                                                className="btn btn-primary"
                                          >
                                                Try again
                                          </button>
                                    </div>
                              )}

                              <div className="content-grid">
                                    {contents.map((content, index) => (
                                          <div key={content._id} className="animate-fadeInUp" style={{ animationDelay: `${index * 0.04}s` }}>
                                                <ContentCard content={content} />
                                          </div>
                                    ))}
                              </div>

                              {contents.length === 0 && !silentRefreshing && !error && (
                                    <div className="text-center py-3xl card">
                                          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>Quiet for now</div>
                                          <h3 className="text-xl font-bold mb-sm">Nothing has landed here yet</h3>
                                          <p className="text-secondary mb-xl">Switch modes or share the first post in this lane.</p>
                                          <Link to="/upload" className="btn btn-primary">Start Creating</Link>
                                    </div>
                              )}

                              {hasMore && contents.length > 0 && (
                                    <div className="text-center mt-3xl">
                                          <button type="button" onClick={loadMore} disabled={silentRefreshing} className="btn btn-secondary">
                                                {silentRefreshing ? 'Loading...' : 'Load More'}
                                          </button>
                                    </div>
                              )}
                        </div>
                  </section>

                  {silentRefreshing && contents.length > 0 && (
                        <div className="home-floating-refresh home-floating-refresh--subtle" aria-hidden>
                              <div className="loader-xs" />
                        </div>
                  )}
            </div>
      );
};

export default Home;
