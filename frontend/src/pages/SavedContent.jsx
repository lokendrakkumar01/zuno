import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import ContentCard from '../components/Content/ContentCard';

const SavedContent = () => {
      const { token, isAuthenticated } = useAuth();
      const [savedPosts, setSavedPosts] = useState(() => {
            try {
                  const cached = localStorage.getItem('zuno_saved_content');
                  if (cached) return JSON.parse(cached);
            } catch (e) { }
            return [];
      });
      const [loading, setLoading] = useState(() => {
            try {
                  if (localStorage.getItem('zuno_saved_content')) return false;
            } catch (e) { }
            return true;
      });

      useEffect(() => {
            if (isAuthenticated && token) {
                  fetchSavedContent();
            } else {
                  setLoading(false);
            }
      }, [isAuthenticated, token]);

      const fetchSavedContent = async () => {
            setLoading(prev => savedPosts.length > 0 ? false : true);
            try {
                  const res = await fetch(`${API_URL}/content/user/saved`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setSavedPosts(data.data.contents || []);
                        try {
                              localStorage.setItem('zuno_saved_content', JSON.stringify(data.data.contents || []));
                        } catch (e) { }
                  }
            } catch (error) {
                  console.error('Failed to fetch saved content:', error);
            }
            setLoading(false);
      };

      const handleUnsave = (contentId) => {
            setSavedPosts(prev => prev.filter(post => post._id !== contentId));
      };

      if (!isAuthenticated) {
            return (
                  <div className="container" style={{ paddingTop: 'var(--space-2xl)' }}>
                        <div className="empty-state animate-fadeIn">
                              <div className="empty-state-icon">🔐</div>
                              <h2 className="text-xl font-semibold mb-md">Login Required</h2>
                              <p className="text-gray-500">Please login to see your saved bookmarks</p>
                        </div>
                  </div>
            );
      }

      if (loading) {
            return (
                  <div className="container" style={{ paddingTop: 'var(--space-2xl)' }}>
                        <div className="flex justify-center items-center" style={{ minHeight: '50vh' }}>
                              <div className="animate-pulse text-xl">Loading saved content...</div>
                        </div>
                  </div>
            );
      }

      return (
            <div className="container" style={{ paddingTop: 'var(--space-xl)', paddingBottom: 'var(--space-2xl)' }}>
                  <div className="animate-fadeIn">
                        {/* Header */}
                        <div className="mb-xl">
                              <h1 className="text-2xl font-bold mb-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    📌 Saved Bookmarks
                              </h1>
                              <p className="text-gray-500">Your saved content for later</p>
                        </div>

                        {/* Saved Content Grid */}
                        {savedPosts.length > 0 ? (
                              <div className="content-grid">
                                    {savedPosts.map(post => (
                                          <ContentCard
                                                key={post._id}
                                                content={post}
                                                onDelete={() => handleUnsave(post._id)}
                                          />
                                    ))}
                              </div>
                        ) : (
                              <div className="empty-state">
                                    <div className="empty-state-icon">📭</div>
                                    <h2 className="text-xl font-semibold mb-md">No saved content yet</h2>
                                    <p className="text-gray-500">Save posts by clicking the bookmark icon on any content</p>
                              </div>
                        )}
                  </div>
            </div>
      );
};

export default SavedContent;
