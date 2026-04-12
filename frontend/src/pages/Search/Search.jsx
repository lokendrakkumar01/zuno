import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ContentCard from '../../components/Content/ContentCard';
import SpotifySearch from '../../components/Music/SpotifySearch';
import { API_URL } from '../../config';
import { useAuth } from '../../context/AuthContext';
import { resolveAssetUrl } from '../../utils/media';

const QUICK_TOPICS = ['technology', 'learning', 'creativity', 'health', 'business', 'music'];

const Search = () => {
      const { token } = useAuth();
      const [searchQuery, setSearchQuery] = useState('');
      const [searchType, setSearchType] = useState('all');
      const [users, setUsers] = useState([]);
      const [contents, setContents] = useState([]);
      const [musicTrack, setMusicTrack] = useState(null);
      const [loading, setLoading] = useState(false);
      const [hasSearched, setHasSearched] = useState(false);
      const [cache, setCache] = useState({});

      const totalResults = users.length + contents.length;
      const searchSummary = useMemo(() => {
            if (!hasSearched) return 'Search people, content, and music from one place.';
            if (loading) return 'Finding the best matches for you.';
            if (totalResults === 0) return 'No matches yet. Try a broader keyword or a different topic.';
            return `${totalResults} result${totalResults === 1 ? '' : 's'} found for "${searchQuery.trim()}".`;
      }, [hasSearched, loading, searchQuery, totalResults]);

      const handleSearch = async (event) => {
            event?.preventDefault();

            const trimmedQuery = searchQuery.trim();
            if (!trimmedQuery) {
                  setHasSearched(false);
                  setUsers([]);
                  setContents([]);
                  return;
            }

            const cacheKey = `${searchType}:${trimmedQuery.toLowerCase()}`;
            if (cache[cacheKey]) {
                  setUsers(cache[cacheKey].users);
                  setContents(cache[cacheKey].contents);
                  setHasSearched(true);
                  return;
            }

            setLoading(true);
            setHasSearched(true);

            try {
                  const headers = token ? { Authorization: `Bearer ${token}` } : {};
                  let resultUsers = [];
                  let resultContents = [];

                  if (searchType === 'all' || searchType === 'users') {
                        try {
                              const userRes = await fetch(
                                    `${API_URL}/users/search?q=${encodeURIComponent(trimmedQuery)}&limit=20`,
                                    { headers }
                              );
                              const userData = await userRes.json();
                              if (userData.success) {
                                    resultUsers = userData.data?.users || [];
                              }
                        } catch (error) {
                              console.error('User search failed:', error);
                        }
                  }

                  if (searchType === 'all' || searchType === 'content') {
                        try {
                              const contentRes = await fetch(
                                    `${API_URL}/feed/search?q=${encodeURIComponent(trimmedQuery)}&limit=20`,
                                    { headers }
                              );
                              const contentData = await contentRes.json();
                              if (contentData.success) {
                                    resultContents = contentData.data?.contents || [];
                              }
                        } catch (error) {
                              console.error('Content search failed:', error);
                        }
                  }

                  setUsers(resultUsers);
                  setContents(resultContents);
                  setCache((prev) => ({
                        ...prev,
                        [cacheKey]: { users: resultUsers, contents: resultContents }
                  }));
            } catch (error) {
                  console.error('Search failed:', error);
            } finally {
                  setLoading(false);
            }
      };

      useEffect(() => {
            const trimmedQuery = searchQuery.trim();
            if (!trimmedQuery) {
                  setUsers([]);
                  setContents([]);
                  setHasSearched(false);
                  setLoading(false);
                  return undefined;
            }

            const timeoutId = window.setTimeout(() => {
                  handleSearch();
            }, 300);

            return () => window.clearTimeout(timeoutId);
      }, [searchQuery, searchType]);

      return (
            <div className="container" style={{ paddingTop: 'var(--space-xl)', paddingBottom: 'var(--space-2xl)' }}>
                  <div className="search-page animate-fadeIn">
                        <section className="search-hero-card">
                              <div className="search-hero-copy">
                                    <span className="search-hero-kicker">Explore Zuno</span>
                                    <h1>Search people, posts, and music without leaving the flow</h1>
                                    <p>{searchSummary}</p>
                              </div>

                              <form onSubmit={handleSearch} className="search-hero-form">
                                    <div className="search-input-panel">
                                          <span className="search-input-label">Smart search</span>
                                          <input
                                                type="text"
                                                className="input search-hero-input"
                                                placeholder="Search for creators, topics, or content..."
                                                value={searchQuery}
                                                onChange={(event) => setSearchQuery(event.target.value)}
                                          />
                                          <button type="submit" className="btn btn-primary search-hero-button" disabled={loading}>
                                                {loading ? 'Searching...' : 'Search now'}
                                          </button>
                                    </div>

                                    <div className="search-filter-row">
                                          <button
                                                type="button"
                                                className={`mode-pill ${searchType === 'all' ? 'active' : ''}`}
                                                onClick={() => setSearchType('all')}
                                          >
                                                All
                                          </button>
                                          <button
                                                type="button"
                                                className={`mode-pill ${searchType === 'content' ? 'active' : ''}`}
                                                onClick={() => setSearchType('content')}
                                          >
                                                Content
                                          </button>
                                          <button
                                                type="button"
                                                className={`mode-pill ${searchType === 'users' ? 'active' : ''}`}
                                                onClick={() => setSearchType('users')}
                                          >
                                                Users
                                          </button>
                                    </div>
                              </form>
                        </section>

                        <section className="search-discovery-grid">
                              <div className="card search-quick-card">
                                    <div className="search-section-head">
                                          <div>
                                                <span className="search-section-kicker">Quick topics</span>
                                                <h2>Jump back into trending interests</h2>
                                          </div>
                                          <span className="search-section-note">Tap to fill the search bar</span>
                                    </div>
                                    <div className="search-tag-grid">
                                          {QUICK_TOPICS.map((topic) => (
                                                <button
                                                      key={topic}
                                                      type="button"
                                                      className="search-topic-chip"
                                                      onClick={() => setSearchQuery(topic)}
                                                >
                                                      {topic}
                                                </button>
                                          ))}
                                    </div>
                              </div>

                              <div className="card search-music-card">
                                    <div className="search-section-head">
                                          <div>
                                                <span className="search-section-kicker">Music discovery</span>
                                                <h2>Search profile music instantly</h2>
                                          </div>
                                          <span className="search-section-note">Preview and keep exploring</span>
                                    </div>
                                    <SpotifySearch
                                          inputId="search-music-input"
                                          selectedTrack={musicTrack}
                                          onSelect={setMusicTrack}
                                          title="Search Music"
                                          helperText="Pick a track for inspiration or reuse it later in your profile."
                                          emptyLabel="Search any song, artist, or soundtrack."
                                          compact
                                    />
                              </div>
                        </section>

                        {loading ? (
                              <div className="empty-state search-empty-state">
                                    <p className="mt-md text-muted">Loading search results...</p>
                              </div>
                        ) : null}

                        {!loading && !hasSearched ? (
                              <div className="card search-placeholder-card animate-fadeInUp">
                                    <div className="search-section-head">
                                          <div>
                                                <span className="search-section-kicker">Start searching</span>
                                                <h2>Discover creators and useful content faster</h2>
                                          </div>
                                    </div>
                                    <p className="text-muted">
                                          Use the top search bar for posts and people, or try the music card above for profile song discovery.
                                    </p>
                              </div>
                        ) : null}

                        {!loading && hasSearched && totalResults === 0 ? (
                              <div className="empty-state animate-fadeIn search-empty-state">
                                    <div className="empty-state-icon">Search</div>
                                    <h3 className="text-xl font-semibold mb-sm">No results found</h3>
                                    <p className="text-muted">Try different spelling, broader keywords, or tap one of the quick topics above.</p>
                              </div>
                        ) : null}

                        {!loading && users.length > 0 ? (
                              <section className="animate-fadeInUp mt-xl">
                                    <div className="search-section-head">
                                          <div>
                                                <span className="search-section-kicker">People</span>
                                                <h2>{users.length} creator{users.length === 1 ? '' : 's'} matched</h2>
                                          </div>
                                    </div>

                                    <div className="search-user-grid">
                                          {users.map((matchedUser) => (
                                                <Link
                                                      key={matchedUser._id}
                                                      to={`/u/${matchedUser.username}`}
                                                      className="search-user-card"
                                                >
                                                      <div className="search-user-avatar">
                                                            {matchedUser.avatar ? (
                                                                  <img src={resolveAssetUrl(matchedUser.avatar)} alt={matchedUser.displayName || matchedUser.username} />
                                                            ) : (
                                                                  <span>
                                                                        {(matchedUser.displayName?.charAt(0) || matchedUser.username?.charAt(0) || 'U').toUpperCase()}
                                                                  </span>
                                                            )}
                                                      </div>
                                                      <div className="search-user-copy">
                                                            <strong>{matchedUser.displayName || matchedUser.username}</strong>
                                                            <span>@{matchedUser.username}</span>
                                                            <p>{matchedUser.bio || 'Open profile to see more details and recent content.'}</p>
                                                      </div>
                                                </Link>
                                          ))}
                                    </div>
                              </section>
                        ) : null}

                        {!loading && contents.length > 0 ? (
                              <section className="animate-fadeInUp mt-xl">
                                    <div className="search-section-head">
                                          <div>
                                                <span className="search-section-kicker">Content</span>
                                                <h2>{contents.length} post{contents.length === 1 ? '' : 's'} matched</h2>
                                          </div>
                                    </div>
                                    <div className="search-content-grid">
                                          {contents.map((content) => (
                                                <div key={content._id} className="search-content-grid-item">
                                                      <ContentCard content={content} />
                                                </div>
                                          ))}
                                    </div>
                              </section>
                        ) : null}
                  </div>
            </div>
      );
};

export default Search;
