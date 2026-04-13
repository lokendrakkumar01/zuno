import { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const ContentCard = lazy(() => import('../components/Content/ContentCard'));
const StoryBar = lazy(() => import('../components/Story/StoryBar'));
const VirtualizedList = lazy(() => import('../components/VirtualizedList'));

const PRIMARY_FEED_TIMEOUT_MS = 12000;
const WAKE_FEED_TIMEOUT_MS = 45000;
const FEED_PAGE_SIZE = 12;
const FEED_CARD_HEIGHT = 520;

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
      const [feedBusy, setFeedBusy] = useState(false);
      const [error, setError] = useState(null);
      const [hasMore, setHasMore] = useState(true);
      const [nextCursor, setNextCursor] = useState(null);
      const feedRequestGenRef = useRef(0);

      const wakeBackend = useCallback(async () => {
            try {
                  await fetch(`${API_URL}/ping`, { cache: 'no-store' });
            } catch {
                  // Best effort only.
            }
      }, []);

      useEffect(() => {
            wakeBackend();
      }, [wakeBackend]);

      const fetchFeed = useCallback(async ({
            currentMode,
            append = false,
            cursor = null,
            currentTopic = topicParam
      }) => {
            const requestId = ++feedRequestGenRef.current;
            const cacheKey = currentTopic ? `zuno_feedCache_${currentMode}_${currentTopic}` : `zuno_feedCache_${currentMode}`;

            if (!append) {
                  const cached = readFeedCache(cacheKey);
                  if (cached.length > 0) {
                        startTransition(() => setContents(cached));
                  }
                  setError(null);
            }

            setFeedBusy(true);

            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const url = new URL(`${API_URL}/feed`);
            url.searchParams.set('mode', currentMode);
            url.searchParams.set('limit', String(FEED_PAGE_SIZE));
            if (cursor) url.searchParams.set('cursor', cursor);
            if (currentTopic) url.searchParams.set('topic', currentTopic);

            const runFetch = async (timeoutMs) => fetchWithTimeout(url.toString(), { headers }, timeoutMs);

            try {
                  let response;

                  try {
                        response = await runFetch(PRIMARY_FEED_TIMEOUT_MS);
                  } catch (fetchError) {
                        if (fetchError?.name !== 'AbortError') {
                              throw fetchError;
                        }
                        await wakeBackend();
                        response = await runFetch(WAKE_FEED_TIMEOUT_MS);
                  }

                  if (requestId !== feedRequestGenRef.current) return;
                  if (!response.ok) throw new Error(`HTTP ${response.status}`);

                  const payload = await response.json();
                  if (!payload?.success) {
                        throw new Error(payload?.message || 'Failed to load feed');
                  }

                  const nextContents = payload.data?.contents || [];
                  const pagination = payload.data?.pagination || {};

                  startTransition(() => {
                        setContents((previous) => {
                              if (!append) {
                                    try {
                                          localStorage.setItem(cacheKey, JSON.stringify(nextContents));
                                    } catch {
                                          // Best effort cache.
                                    }
                                    return nextContents;
                              }

                              const existingIds = new Set(previous.map((item) => item._id));
                              const merged = [...previous, ...nextContents.filter((item) => !existingIds.has(item._id))];
                              try {
                                    localStorage.setItem(cacheKey, JSON.stringify(merged));
                              } catch {
                                    // Best effort cache.
                              }
                              return merged;
                        });
                  });

                  setHasMore(Boolean(pagination.hasMore));
                  setNextCursor(pagination.nextCursor || null);
                  setError(null);
            } catch (fetchError) {
                  if (requestId !== feedRequestGenRef.current) return;
                  const cached = readFeedCache(cacheKey);
                  if (cached.length === 0 && contents.length === 0) {
                        setError(fetchError?.name === 'AbortError' ? 'timeout' : 'network');
                  }
            } finally {
                  if (requestId === feedRequestGenRef.current) {
                        setFeedBusy(false);
                  }
            }
      }, [contents.length, token, topicParam, wakeBackend]);

      useEffect(() => {
            setHasMore(true);
            setNextCursor(null);
            fetchFeed({ currentMode: mode, append: false, cursor: null, currentTopic: topicParam });

            return () => {
                  feedRequestGenRef.current += 1;
            };
      }, [fetchFeed, mode, topicParam]);

      const loadMore = useCallback(() => {
            if (!nextCursor || feedBusy) return;
            fetchFeed({ currentMode: mode, append: true, cursor: nextCursor, currentTopic: topicParam });
      }, [feedBusy, fetchFeed, mode, nextCursor, topicParam]);

      const quickTopics = useMemo(() => {
            const derivedTopics = Array.from(
                  new Set(contents.flatMap((content) => content.topics || []).filter(Boolean))
            ).slice(0, 6);

            return derivedTopics.length > 0 ? derivedTopics : FALLBACK_TOPICS;
      }, [contents]);

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
                                    <p>Clean navigation, instant hydration, and a quieter feed that still keeps chat, live streams, and sharing close at hand.</p>

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
                                          {topicParam ? (
                                                <button type="button" className="home-topic-clear" onClick={() => setSearchParams({})}>
                                                      Clear topic
                                                </button>
                                          ) : null}
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
                        <Suspense fallback={null}>
                              <StoryBar />
                        </Suspense>
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
                                          <span className="text-secondary" style={{ fontSize: '0.88rem' }}>Cursor feed + windowed render</span>
                                    </div>
                              </div>

                              {(error === 'network' || error === 'timeout') && contents.length === 0 ? (
                                    <div className="text-center py-lg">
                                          <p className="text-secondary mb-sm" style={{ fontSize: '0.9rem' }}>
                                                {error === 'timeout'
                                                      ? 'Still connecting. Tap below to retry.'
                                                      : 'Offline. Retry once the connection is back.'}
                                          </p>
                                          <button
                                                type="button"
                                                onClick={() => fetchFeed({ currentMode: mode, append: false, cursor: null, currentTopic: topicParam })}
                                                className="btn btn-secondary btn-sm"
                                          >
                                                Retry
                                          </button>
                                    </div>
                              ) : null}

                              {contents.length > 0 ? (
                                    <Suspense fallback={<div className="py-lg text-center text-secondary">Loading feed cards...</div>}>
                                          <VirtualizedList
                                                items={contents}
                                                itemHeight={FEED_CARD_HEIGHT}
                                                className="home-windowed-list"
                                                itemClassName="home-windowed-item"
                                                renderItem={(content, index) => (
                                                      <div className="animate-fadeInUp" style={{ animationDelay: `${Math.min(index, 10) * 0.03}s`, paddingBottom: '1rem' }}>
                                                            <ContentCard content={content} />
                                                      </div>
                                                )}
                                          />
                                    </Suspense>
                              ) : null}

                              {contents.length === 0 && !feedBusy && !error ? (
                                    <div className="text-center py-3xl card">
                                          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>Quiet for now</div>
                                          <h3 className="text-xl font-bold mb-sm">Nothing has landed here yet</h3>
                                          <p className="text-secondary mb-xl">Switch modes or share the first post in this lane.</p>
                                          <Link to="/upload" className="btn btn-primary">Start Creating</Link>
                                    </div>
                              ) : null}

                              {hasMore && contents.length > 0 ? (
                                    <div className="text-center mt-3xl">
                                          <button type="button" onClick={loadMore} disabled={feedBusy} className="btn btn-secondary">
                                                {feedBusy ? 'Loading...' : 'Load more'}
                                          </button>
                                    </div>
                              ) : null}
                        </div>
                  </section>
            </div>
      );
};

export default Home;
