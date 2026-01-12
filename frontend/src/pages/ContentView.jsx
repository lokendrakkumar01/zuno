import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

const ContentView = () => {
      const { id } = useParams();
      const { token } = useAuth();
      const [content, setContent] = useState(null);
      const [loading, setLoading] = useState(true);
      const [isHelpful, setIsHelpful] = useState(false);
      const [isSaved, setIsSaved] = useState(false);

      useEffect(() => {
            const fetchContent = async () => {
                  try {
                        const res = await fetch(`/ api / content / ${id} `);
                        const data = await res.json();
                        if (data.success) {
                              setContent(data.data.content);
                        }
                  } catch (error) {
                        console.error('Failed to fetch content:', error);
                  }
                  setLoading(false);
            };
            fetchContent();
      }, [id]);

      const handleHelpful = async () => {
            if (!token) return;
            try {
                  await fetch(`/ api / content / ${id}/helpful`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  setIsHelpful(!isHelpful);
            } catch (error) {
                  console.error('Failed:', error);
            }
      };

      const handleSave = async () => {
            if (!token) return;
            try {
                  await fetch(`/api/content/${id}/save`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  setIsSaved(!isSaved);
            } catch (error) {
                  console.error('Failed:', error);
            }
      };

      if (loading) {
            return (
                  <div className="empty-state">
                        <div className="spinner" style={{ margin: '0 auto' }}></div>
                  </div>
            );
      }

      if (!content) {
            return (
                  <div className="empty-state animate-fadeIn">
                        <div className="empty-state-icon">🔍</div>
                        <h2 className="text-xl font-semibold mb-md">Content not found</h2>
                        <Link to="/" className="btn btn-primary">Go Home</Link>
                  </div>
            );
      }

      return (
            <div className="content-view-page animate-fadeIn">
                  {/* Creator Info */}
                  <div className="flex items-center gap-md mb-lg">
                        <Link to={`/u/${content.creator?.username}`}>
                              <div className="avatar avatar-lg">
                                    {content.creator?.avatar ? (
                                          <img src={content.creator.avatar} alt={content.creator.displayName} />
                                    ) : (
                                          content.creator?.displayName?.charAt(0).toUpperCase() || 'Z'
                                    )}
                              </div>
                        </Link>
                        <div>
                              <Link to={`/u/${content.creator?.username}`} className="font-semibold text-lg">
                                    {content.creator?.displayName || content.creator?.username}
                              </Link>
                              <p className="text-sm text-muted">@{content.creator?.username}</p>
                        </div>
                        <span className="tag tag-primary">{content.contentType}</span>
                  </div>

                  {/* Title */}
                  {content.title && (
                        <h1 className="text-2xl font-bold mb-md">{content.title}</h1>
                  )}

                  {/* Purpose & Topics */}
                  <div className="flex gap-sm flex-wrap mb-lg">
                        <span className="tag" style={{ background: 'rgba(99, 102, 241, 0.2)', color: 'var(--color-accent-primary)' }}>
                              {content.purpose}
                        </span>
                        {content.topics?.map(topic => (
                              <span key={topic} className="tag">{topic}</span>
                        ))}
                  </div>

                  {/* Media */}
                  {content.media && content.media.length > 0 && (
                        <div className="card mb-lg p-0" style={{ overflow: 'hidden' }}>
                              {content.media.map((m, idx) => (
                                    <div key={idx}>
                                          {m.type === 'image' ? (
                                                <img
                                                      src={m.url.startsWith('http') ? m.url : `${API_BASE_URL}${m.url}`}
                                                      alt={content.title}
                                                      style={{ width: '100%', maxHeight: '500px', objectFit: 'contain', background: 'var(--color-bg-tertiary)' }}
                                                />
                                          ) : (
                                                <video
                                                      src={m.url.startsWith('http') ? m.url : `${API_BASE_URL}${m.url}`}
                                                      controls
                                                      controlsList="nodownload"
                                                      style={{ width: '100%', maxHeight: '500px' }}
                                                />
                                          )}
                                    </div>
                              ))}
                        </div>
                  )}

                  {/* Body */}
                  {content.body && (
                        <div className="card mb-lg">
                              <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>{content.body}</p>
                        </div>
                  )}

                  {/* Chapters (for long videos) */}
                  {content.chapters && content.chapters.length > 0 && (
                        <div className="card mb-lg">
                              <h3 className="font-semibold mb-md">📑 Chapters</h3>
                              <ul>
                                    {content.chapters.map((ch, idx) => (
                                          <li key={idx} className="flex justify-between p-sm" style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <span>{ch.title}</span>
                                                <span className="text-muted">{Math.floor(ch.startTime / 60)}:{(ch.startTime % 60).toString().padStart(2, '0')}</span>
                                          </li>
                                    ))}
                              </ul>
                        </div>
                  )}

                  {/* Notes (downloadable) */}
                  {content.notes && (
                        <div className="card mb-lg">
                              <h3 className="font-semibold mb-md">📝 Notes</h3>
                              <p style={{ whiteSpace: 'pre-wrap' }}>{content.notes}</p>
                        </div>
                  )}

                  {/* Actions */}
                  <div className="card">
                        <div className="flex gap-md">
                              <button
                                    className={`btn ${isHelpful ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={handleHelpful}
                              >
                                    {isHelpful ? '✅ Marked Helpful' : '👍 Mark as Helpful'}
                              </button>
                              <button
                                    className={`btn ${isSaved ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={handleSave}
                              >
                                    {isSaved ? '📌 Saved' : '🔖 Save for Later'}
                              </button>
                        </div>
                        <p className="text-sm text-muted mt-md">
                              Your feedback is private and helps improve your personal feed.
                        </p>
                  </div>
            </div>
      );
};

export default ContentView;
