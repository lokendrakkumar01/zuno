import { Suspense, lazy, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

const ContentCard = lazy(() => import('../components/Content/ContentCard'));
const StoryBar = lazy(() => import('../components/Story/StoryBar'));

const FEED_PAGE_SIZE = 12;
const FEED_MODES = [
  { id: 'all', label: 'All', desc: 'A fast mix of current conversations, posts and videos.' },
  { id: 'learning', label: 'Learning', desc: 'Tutorials, skill building and explainers.' },
  { id: 'calm', label: 'Calm', desc: 'Inspiration, reflection and low-noise updates.' },
  { id: 'video', label: 'Video', desc: 'Short and long videos optimized for quick watching.' },
  { id: 'reading', label: 'Reading', desc: 'Text-first posts and deeper breakdowns.' },
  { id: 'problem-solving', label: 'Solutions', desc: 'Questions, answers and practical help.' }
];
const FALLBACK_TOPICS = ['learning', 'technology', 'creativity', 'business', 'problem-solving'];

const FeedSkeleton = () => (
  <div className="home-windowed-list">
    {[0, 1, 2].map((item) => (
      <div key={item} className="card animate-pulse" style={{ minHeight: 420, marginBottom: 16 }}>
        <div style={{ height: 260, borderRadius: 12, background: 'var(--color-bg-secondary)' }} />
        <div style={{ height: 24, width: '65%', borderRadius: 8, background: 'var(--color-bg-secondary)', marginTop: 16 }} />
        <div style={{ height: 16, width: '92%', borderRadius: 8, background: 'var(--color-bg-secondary)', marginTop: 12 }} />
      </div>
    ))}
  </div>
);

export default function Home() {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState('all');
  const topicParam = searchParams.get('topic') || '';

  const feedQuery = useInfiniteQuery({
    queryKey: ['feed', mode, topicParam],
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    initialPageParam: null,
    placeholderData: (previous) => previous,
    queryFn: async ({ pageParam }) => {
      const url = new URL(`${API_URL}/feed`);
      url.searchParams.set('mode', mode);
      url.searchParams.set('limit', String(FEED_PAGE_SIZE));
      if (topicParam) url.searchParams.set('topic', topicParam);
      if (pageParam) url.searchParams.set('cursor', pageParam);
      const res = await fetch(url.toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) throw new Error(payload?.message || 'Failed to load feed');
      const pagination = payload.data?.pagination || {};
      return {
        contents: payload.data?.contents || [],
        nextCursor: pagination.nextCursor || payload.data?.nextCursor || null,
        hasMore: Boolean(pagination.hasMore ?? payload.data?.hasMore)
      };
    },
    getNextPageParam: (lastPage) => lastPage?.hasMore ? lastPage.nextCursor : undefined
  });

  const contents = useMemo(() => {
    const seen = new Set();
    return (feedQuery.data?.pages || [])
      .flatMap((page) => page.contents || [])
      .filter((content) => {
        if (!content?._id || seen.has(content._id)) return false;
        seen.add(content._id);
        return true;
      });
  }, [feedQuery.data]);

  const quickTopics = useMemo(() => {
    const derived = Array.from(new Set(contents.flatMap((content) => content.topics || []).filter(Boolean))).slice(0, 6);
    return derived.length ? derived : FALLBACK_TOPICS;
  }, [contents]);

  const selectedMode = FEED_MODES.find((item) => item.id === mode) || FEED_MODES[0];

  return (
    <div className="home-page">
      <section className="home-hero-shell">
        <div className="container home-hero">
          <div className="home-hero-copy">
            <span className="home-kicker">Fast social feed</span>
            <h1>{user?.displayName ? `Welcome back, ${user.displayName.split(' ')[0]}` : 'Your ZUNO home'}</h1>
            <p>Instant cached feed, virtual rendering, stories, live content, and creation close at hand.</p>
            <div className="home-hero-actions">
              <Link to="/upload" className="btn btn-primary">Create Post</Link>
              <Link to="/messages" className="btn btn-secondary">Open Messages</Link>
            </div>
            <div className="home-hero-topics">
              {quickTopics.map((topic) => (
                <button key={topic} type="button" className={`home-topic-pill ${topicParam === topic ? 'active' : ''}`} onClick={() => setSearchParams({ topic })}>
                  #{topic}
                </button>
              ))}
              {topicParam ? <button type="button" className="home-topic-clear" onClick={() => setSearchParams({})}>Clear topic</button> : null}
            </div>
          </div>
          <div className="home-hero-panels">
            <div className="home-summary-card">
              <span className="home-summary-label">Current mode</span>
              <strong>{selectedMode.label}</strong>
              <p>{selectedMode.desc}</p>
            </div>
            <div className="home-stat-grid">
              <div className="home-stat-card"><span>Loaded</span><strong>{contents.length}</strong></div>
              <div className="home-stat-card"><span>Status</span><strong>{feedQuery.isFetching ? 'Syncing' : 'Ready'}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <div className="container home-story-strip">
        <Suspense fallback={null}><StoryBar /></Suspense>
      </div>

      <section className="section">
        <div className="container">
          <div className="feed-header home-feed-toolbar">
            <div className="home-mode-scroller">
              {FEED_MODES.map((feedMode) => (
                <button key={feedMode.id} type="button" onClick={() => setMode(feedMode.id)} className={`mode-btn ${mode === feedMode.id ? 'active' : ''}`}>
                  {feedMode.label}
                </button>
              ))}
            </div>
            <span className="text-secondary" style={{ fontSize: '.88rem' }}>Cursor feed + virtual render</span>
          </div>

          {contents.length === 0 && feedQuery.isFetching ? <FeedSkeleton /> : null}

          {contents.length > 0 ? (
            <Suspense fallback={null}>
              <Virtuoso
                useWindowScroll
                data={contents}
                endReached={() => {
                  if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) feedQuery.fetchNextPage();
                }}
                overscan={800}
                itemContent={(index, content) => (
                  <div className="home-windowed-item animate-fadeInUp" style={{ animationDelay: `${Math.min(index, 8) * 0.02}s`, paddingBottom: '1rem' }}>
                    <ContentCard content={content} />
                  </div>
                )}
              />
            </Suspense>
          ) : null}

          {contents.length === 0 && !feedQuery.isFetching && !feedQuery.isError ? (
            <div className="text-center py-3xl card">
              <h3 className="text-xl font-bold mb-sm">Nothing has landed here yet</h3>
              <p className="text-secondary mb-xl">Switch modes or share the first post in this lane.</p>
              <Link to="/upload" className="btn btn-primary">Start Creating</Link>
            </div>
          ) : null}

          {feedQuery.isError && contents.length === 0 ? (
            <div className="text-center py-lg">
              <p className="text-secondary mb-sm">Offline or waking the backend. Try again in a moment.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => feedQuery.refetch()}>Retry</button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
