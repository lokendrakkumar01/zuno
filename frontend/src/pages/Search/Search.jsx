import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';
import ContentCard from '../../components/Content/ContentCard';

const Search = () => {
      const { token } = useAuth();
      const [searchQuery, setSearchQuery] = useState('');
      const [searchType, setSearchType] = useState('all'); // 'all', 'users', 'content'
      const [users, setUsers] = useState([]);
      const [contents, setContents] = useState([]);
      const [loading, setLoading] = useState(false);
      const [hasSearched, setHasSearched] = useState(false);

      const handleSearch = async (e) => {
            e?.preventDefault();
            if (!searchQuery.trim()) return;

            setLoading(true);
            setHasSearched(true);

            try {
                  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

                  // Search for content
                  if (searchType === 'all' || searchType === 'content') {
                        const contentRes = await fetch(
                              `${API_URL}/feed?search=${encodeURIComponent(searchQuery)}&limit=20`,
                              { headers }
                        );
                        const contentData = await contentRes.json();
                        if (contentData.success) {
                              setContents(contentData.data.contents || []);
                        }
                  }

                  // For now, we'll show content search only
                  // User search would need a backend endpoint
                  setUsers([]);

            } catch (error) {
                  console.error('Search failed:', error);
            }
            setLoading(false);
      };

      // Debounced search
      useEffect(() => {
            const timer = setTimeout(() => {
                  if (searchQuery.trim()) {
                        handleSearch();
                  }
            }, 500);
            return () => clearTimeout(timer);
      }, [searchQuery, searchType]);

      return (
            <div className="container" style={{ paddingTop: 'var(--space-xl)', paddingBottom: 'var(--space-2xl)' }}>
                  <div className="search-page animate-fadeIn">
                        <h1 className="text-3xl font-bold mb-lg text-center">
                              🔍 <span className="text-gradient">Search</span>
                        </h1>

                        {/* Search Form */}
                        <form onSubmit={handleSearch} className="mb-xl">
                              <div className="flex gap-md items-center" style={{ maxWidth: '600px', margin: '0 auto' }}>
                                    <div className="input-group flex-1" style={{ margin: 0 }}>
                                          <input
                                                type="text"
                                                className="input"
                                                placeholder="Search for content, topics..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                style={{ fontSize: 'var(--font-size-md)' }}
                                          />
                                    </div>
                                    <button type="submit" className="btn btn-primary" disabled={loading}>
                                          {loading ? <span className="spinner"></span> : '🔍 Search'}
                                    </button>
                              </div>

                              {/* Search Type Pills */}
                              <div className="mode-pills mt-lg" style={{ maxWidth: '400px', margin: 'var(--space-lg) auto 0' }}>
                                    <button
                                          type="button"
                                          className={`mode-pill ${searchType === 'all' ? 'active' : ''}`}
                                          onClick={() => setSearchType('all')}
                                    >
                                          🌐 All
                                    </button>
                                    <button
                                          type="button"
                                          className={`mode-pill ${searchType === 'content' ? 'active' : ''}`}
                                          onClick={() => setSearchType('content')}
                                    >
                                          📝 Content
                                    </button>
                                    <button
                                          type="button"
                                          className={`mode-pill ${searchType === 'users' ? 'active' : ''}`}
                                          onClick={() => setSearchType('users')}
                                    >
                                          👤 Users
                                    </button>
                              </div>
                        </form>

                        {/* Results */}
                        {loading && (
                              <div className="empty-state">
                                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                                    <p className="mt-md">Searching...</p>
                              </div>
                        )}

                        {!loading && hasSearched && contents.length === 0 && users.length === 0 && (
                              <div className="empty-state animate-fadeIn">
                                    <div className="empty-state-icon">🔍</div>
                                    <h3 className="text-xl font-semibold mb-sm">No results found</h3>
                                    <p className="text-muted">Try different keywords or check spelling</p>
                              </div>
                        )}

                        {!loading && !hasSearched && (
                              <div className="empty-state animate-fadeIn">
                                    <div className="empty-state-icon">💡</div>
                                    <h3 className="text-xl font-semibold mb-sm">Discover Content</h3>
                                    <p className="text-muted mb-lg">Search for topics, skills, or content you want to learn</p>

                                    {/* Popular Topics */}
                                    <div className="flex gap-sm flex-wrap justify-center mt-lg">
                                          {['technology', 'learning', 'creativity', 'health', 'business'].map(topic => (
                                                <button
                                                      key={topic}
                                                      className="tag tag-primary"
                                                      onClick={() => setSearchQuery(topic)}
                                                      style={{ cursor: 'pointer' }}
                                                >
                                                      {topic}
                                                </button>
                                          ))}
                                    </div>
                              </div>
                        )}

                        {/* Content Results */}
                        {!loading && contents.length > 0 && (
                              <div className="animate-fadeInUp">
                                    <h2 className="text-xl font-semibold mb-lg">📝 Content ({contents.length})</h2>
                                    <div className="content-grid">
                                          {contents.map(content => (
                                                <ContentCard key={content._id} content={content} />
                                          ))}
                                    </div>
                              </div>
                        )}

                        {/* User Results (Placeholder for when backend supports it) */}
                        {!loading && users.length > 0 && (
                              <div className="animate-fadeInUp mt-xl">
                                    <h2 className="text-xl font-semibold mb-lg">👤 Users ({users.length})</h2>
                                    <div className="grid grid-cols-3 gap-md">
                                          {users.map(user => (
                                                <Link
                                                      key={user._id}
                                                      to={`/u/${user.username}`}
                                                      className="card text-center p-lg"
                                                      style={{ textDecoration: 'none' }}
                                                >
                                                      <div className="avatar avatar-lg mx-auto mb-md" style={{ overflow: 'hidden' }}>
                                                            {user.avatar ? (
                                                                  <img src={user.avatar} alt={user.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                  <span style={{ fontSize: '1.5rem' }}>
                                                                        {user.displayName?.charAt(0) || user.username?.charAt(0) || 'U'}
                                                                  </span>
                                                            )}
                                                      </div>
                                                      <h3 className="font-semibold">{user.displayName || user.username}</h3>
                                                      <p className="text-sm text-muted">@{user.username}</p>
                                                </Link>
                                          ))}
                                    </div>
                              </div>
                        )}
                  </div>
            </div>
      );
};

export default Search;
