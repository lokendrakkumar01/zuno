import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL, API_BASE_URL } from '../config';

// Separate component for media items to avoid React hooks violation
const MediaItem = ({ m, content }) => {
      const [loaded, setLoaded] = useState(false);
      const [error, setError] = useState(false);
      const mediaUrl = m.url.startsWith('http') ? m.url : `${API_BASE_URL}${m.url}`;

      return (
            <div className="relative bg-gray-100" style={{ minHeight: '200px' }}>
                  {/* Uploading Status */}
                  {m.status === 'uploading' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                              <span className="text-sm">Processing...</span>
                        </div>
                  )}

                  {/* Failed Status */}
                  {m.status === 'failed' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500">
                              <span className="text-2xl mb-2">⚠️</span>
                              <span className="text-sm">Media failed to load</span>
                        </div>
                  )}

                  {/* Ready Status */}
                  {(m.status === 'ready' || !m.status) && (
                        m.type === 'image' ? (
                              <>
                                    {!loaded && !error && (
                                          <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                                          </div>
                                    )}
                                    <img
                                          src={error ? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image Available%3C/text%3E%3C/svg%3E' : `${mediaUrl}?v=${new Date(content.updatedAt).getTime()}`}
                                          alt={content.title}
                                          loading="lazy"
                                          onLoad={() => setLoaded(true)}
                                          onError={() => setError(true)}
                                          style={{
                                                width: '100%',
                                                maxHeight: '500px',
                                                objectFit: 'contain',
                                                background: 'var(--color-bg-tertiary)',
                                                opacity: loaded ? 1 : 0,
                                                transition: 'opacity 0.3s ease'
                                          }}
                                    />
                              </>
                        ) : (
                              <video
                                    key={mediaUrl}
                                    src={`${mediaUrl}?v=${new Date(content.updatedAt).getTime()}`}
                                    controls
                                    controlsList="nodownload"
                                    preload="metadata"
                                    playsInline
                                    style={{ width: '100%', maxHeight: '500px' }}
                                    onError={(e) => {
                                          console.error('Video failed to load:', e);
                                          if (!e.target.dataset.retried) {
                                                e.target.dataset.retried = 'true';
                                                setTimeout(() => {
                                                      e.target.src = `${mediaUrl}?v=${Date.now()}`;
                                                }, 1000);
                                          }
                                    }}
                              />
                        )
                  )}
            </div>
      );
};

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
                        const res = await fetch(`${API_URL}/content/${id}`);
                        const data = await res.json();
                        if (data.success) {
                              setContent(data.data.content);
                        } else {
                              console.error('Content fetch failed:', data.message);
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
                  await fetch(`${API_URL}/content/${id}/helpful`, {
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
                  await fetch(`${API_URL}/content/${id}/save`, {
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
                                    <MediaItem key={idx} m={m} content={content} />
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
                              {content.media && content.media.length > 0 && (
                                    <button
                                          className="btn btn-secondary"
                                          onClick={async () => {
                                                try {
                                                      const media = content.media[0];
                                                      const url = media.url.startsWith('http') ? media.url : `${API_BASE_URL}${media.url}`;
                                                      const filename = `zuno-${content._id}.${media.type === 'video' ? 'mp4' : 'jpg'}`;

                                                      const res = await fetch(url);
                                                      const blob = await res.blob();
                                                      const blobUrl = window.URL.createObjectURL(blob);

                                                      const link = document.createElement('a');
                                                      link.href = blobUrl;
                                                      link.download = filename;
                                                      document.body.appendChild(link);
                                                      link.click();

                                                      document.body.removeChild(link);
                                                      window.URL.revokeObjectURL(blobUrl);
                                                } catch (err) {
                                                      console.error("Download failed", err);
                                                      alert("Failed to download media");
                                                }
                                          }}
                                    >
                                          ⬇️ Download
                                    </button>
                              )}
                        </div>
                        <p className="text-sm text-muted mt-md">
                              Your feedback is private and helps improve your personal feed.
                        </p>
                  </div>
            </div>
      );
};

export default ContentView;
