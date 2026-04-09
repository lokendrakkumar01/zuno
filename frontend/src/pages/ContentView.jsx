import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { API_URL, API_BASE_URL } from '../config';
import CommentSection from '../components/Content/CommentSection';

// Separate component for media items to avoid React hooks violation
const MediaItem = ({ m, content }) => {
      const [loaded, setLoaded] = useState(false);
      const [error, setError] = useState(false);
      const mediaUrl = m.url?.startsWith('http') ? m.url : `${API_BASE_URL}${m.url || ''}`;

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
      const { playTrack, stopTrack, currentTrack, isPlaying: isGlobalPlaying } = useMusic();
      const [content, setContent] = useState(() => {
            try {
                  const cached = localStorage.getItem(`zuno_content_${id}`);
                  if (cached) return JSON.parse(cached);
            } catch (e) { }
            return null;
      });
      const isThisPlaying = isGlobalPlaying && currentTrack?.trackId === content?.music?.trackId;
      const [loading, setLoading] = useState(() => {
            try {
                  if (localStorage.getItem(`zuno_content_${id}`)) return false;
            } catch (e) { }
            return true;
      });
      const [isHelpful, setIsHelpful] = useState(false);
      const [isSaved, setIsSaved] = useState(false);
      const [moreContent, setMoreContent] = useState([]);
      const [moreLoading, setMoreLoading] = useState(false);

      const fetchMoreFromCreator = async (username) => {
            if (!username) return;
            setMoreLoading(true);
            try {
                  const res = await fetch(`${API_URL}/feed/creator/${username}`);
                  const data = await res.json();
                  if (data.success) {
                        const items = data.data.contents || data.data || [];
                        setMoreContent(items.filter(i => i._id !== id).slice(0, 4));
                  }
            } catch (err) {
                  console.error(err);
            } finally {
                  setMoreLoading(false);
            }
      };

      useEffect(() => {
            const fetchContent = async () => {
                  setLoading(prev => content ? false : true);
                  try {
                        const res = await fetch(`${API_URL}/content/${id}`);
                        const data = await res.json();
                        if (data.success) {
                              setContent(data.data.content);
                              try {
                                    localStorage.setItem(`zuno_content_${id}`, JSON.stringify(data.data.content));
                              } catch (e) { }
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

      useEffect(() => {
            if (content?.creator?.username) {
                  fetchMoreFromCreator(content.creator.username);
            }
      }, [content?._id]);

      const hasAutoPlayed = useRef(false);
      useEffect(() => {
            // Only auto-play music on first content load, not on every update
            if (content?.music?.previewUrl && !hasAutoPlayed.current) {
                  hasAutoPlayed.current = true;
                  playTrack(content.music);
            }
      }, [content?._id]); // Only re-run when content ID changes (new page)

      // Stop music only when leaving the page (unmount)
      useEffect(() => {
            return () => stopTrack();
      }, []);

      const handleHelpful = async () => {
            if (!token) return;
            // Play music if exists and not already playing
            if (content.music && content.music.previewUrl && !isThisPlaying) {
                  playTrack(content.music);
            }
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
                        {/* Silent loading */}
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
            <div className="content-view-container animate-fadeIn" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
                  <div className="content-view-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '30px' }}>
                        
                        {/* Main Content Area */}
                        <div className="content-main-area">
                              {/* Header for Mobile only */}
                              <div className="mobile-only mb-lg" style={{ display: 'none' }}>
                                    <div className="flex items-center gap-md">
                                          <Link to={`/u/${content.creator?.username}`}>
                                                <div className="avatar avatar-md">
                                                      {content.creator?.avatar ? <img src={content.creator.avatar} alt="" /> : content.creator?.username?.charAt(0).toUpperCase()}
                                                </div>
                                          </Link>
                                          <div>
                                                <Link to={`/u/${content.creator?.username}`} className="font-bold">{content.creator?.displayName || content.creator?.username}</Link>
                                                <p className="text-xs text-muted">@{content.creator?.username}</p>
                                          </div>
                                    </div>
                              </div>

                              {/* Title & Stats */}
                              <div className="mb-xl">
                                    <h1 className="text-4xl font-extrabold mb-md" style={{ letterSpacing: '-0.02em', lineHeight: '1.2' }}>{content.title || 'Untitled Content'}</h1>
                                    <div className="flex gap-sm flex-wrap items-center">
                                          <span className="tag tag-primary" style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 800 }}>{content.contentType}</span>
                                          <span className="text-muted" style={{ margin: '0 8px' }}>•</span>
                                          <span className="text-muted text-sm">{new Date(content.createdAt).toLocaleDateString()}</span>
                                          <span className="text-muted" style={{ margin: '0 8px' }}>•</span>
                                          <div className="flex gap-xs">
                                                {content.topics?.map(topic => (
                                                      <span key={topic} className="text-indigo-500 font-semibold text-sm">#{topic}</span>
                                                ))}
                                          </div>
                                    </div>
                              </div>

                              {/* Media Section */}
                              {content.media && content.media.length > 0 && (
                                    <div className="media-section mb-xl" style={{ borderRadius: '24px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)' }}>
                                          {content.media.map((m, idx) => (
                                                <MediaItem key={idx} m={m} content={content} />
                                          ))}
                                    </div>
                              )}

                              {/* Body Section */}
                              <div className="content-body-rich mb-2xl" style={{ fontSize: '1.15rem', lineHeight: '1.8', color: '#374151' }}>
                                    {content.body ? (
                                          <div style={{ whiteSpace: 'pre-wrap' }}>{content.body}</div>
                                    ) : (
                                          <p className="text-muted italic">No additional text content.</p>
                                    )}
                              </div>

                              {/* Technical Details: Chapters / Notes */}
                              {(content.chapters?.length > 0 || content.notes) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-lg mb-2xl">
                                          {content.chapters?.length > 0 && (
                                                <div className="card p-lg" style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
                                                      <h3 className="font-bold mb-md flex items-center gap-sm">📑 Video Chapters</h3>
                                                      <ul className="flex flex-col gap-sm">
                                                            {content.chapters.map((ch, idx) => (
                                                                  <li key={idx} className="flex justify-between items-center p-sm hover:bg-white rounded-lg transition-all cursor-pointer">
                                                                        <span className="text-sm font-medium">{ch.title}</span>
                                                                        <span className="text-xs font-bold px-2 py-1 bg-gray-200 rounded">{Math.floor(ch.startTime / 60)}:{(ch.startTime % 60).toString().padStart(2, '0')}</span>
                                                                  </li>
                                                            ))}
                                                      </ul>
                                                </div>
                                          )}
                                          {content.notes && (
                                                <div className="card p-lg" style={{ background: 'linear-gradient(135deg, #fffcf0, #fefce8)' }}>
                                                      <h3 className="font-bold mb-md flex items-center gap-sm">📝 Study Notes</h3>
                                                      <p className="text-sm" style={{ whiteSpace: 'pre-wrap', color: '#854d0e' }}>{content.notes}</p>
                                                </div>
                                          )}
                                    </div>
                              )}

                              {/* Footer Related Content */}
                              <div className="more-from-creator mt-2xl pt-xl" style={{ borderTop: '2px solid #f1f5f9' }}>
                                    <div className="flex items-center justify-between mb-xl">
                                          <h2 className="text-2xl font-bold">More from this Creator</h2>
                                          <Link to={`/u/${content.creator?.username}`} className="text-indigo-600 font-bold hover:underline">View Profile →</Link>
                                    </div>
                                    {moreLoading ? (
                                          <div className="flex gap-md overflow-x-auto pb-4">
                                                {[1,2,3].map(i => <div key={i} style={{ minWidth: '240px', height: '160px', borderRadius: '16px', background: '#f1f5f9' }} className="animate-pulse"></div>)}
                                          </div>
                                    ) : moreContent.length > 0 ? (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                                                {moreContent.map(item => (
                                                      <Link key={item._id} to={`/content/${item._id}`} className="card p-md hover:scale-[1.02] transition-transform flex gap-md">
                                                            <div style={{ width: '80px', height: '80px', borderRadius: '12px', background: 'var(--gradient-primary)', flexShrink: 0, overflow: 'hidden' }}>
                                                                  {item.media?.[0]?.url && <img src={item.media[0].url.startsWith('http') ? item.media[0].url : `${API_BASE_URL}${item.media[0].url}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                            </div>
                                                            <div>
                                                                  <h4 className="font-bold mb-1 truncate max-w-[200px]">{item.title || 'Post'}</h4>
                                                                  <span className="tag text-[10px] py-0 px-2">{item.contentType}</span>
                                                                  <p className="text-xs text-muted mt-2 line-clamp-1">{item.body?.slice(0, 50)}</p>
                                                            </div>
                                                      </Link>
                                                ))}
                                          </div>
                                    ) : (
                                          <p className="text-muted text-center py-lg card bg-gray-50 border-dashed">No other content yet.</p>
                                    )}
                              </div>
                        </div>

                        {/* Sidebar */}
                        <div className="content-sidebar">
                              <div style={{ position: 'sticky', top: '100px' }}>
                                    
                                    {/* Creator Card */}
                                    <div className="card p-xl mb-lg shadow-xl" style={{ border: 'none', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white' }}>
                                          <div className="flex flex-col items-center text-center">
                                                <Link to={`/u/${content.creator?.username}`}>
                                                      <div className="avatar avatar-2xl mb-md" style={{ border: '4px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }}>
                                                            {content.creator?.avatar ? <img src={content.creator.avatar} alt="" /> : content.creator?.username?.charAt(0).toUpperCase()}
                                                      </div>
                                                </Link>
                                                <h3 className="text-xl font-bold mb-1">{content.creator?.displayName || content.creator?.username}</h3>
                                                <p className="text-gray-400 text-sm mb-lg">@{content.creator?.username}</p>
                                                <Link to={`/u/${content.creator?.username}`} className="btn btn-primary w-full shadow-lg" style={{ background: 'white', color: '#1e293b' }}>
                                                      View Profile
                                                </Link>
                                          </div>
                                    </div>

                                    {/* Action Box */}
                                    <div className="card p-lg mb-lg border-2 border-indigo-50 shadow-sm">
                                          <h4 className="font-bold mb-lg" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</h4>
                                          <div className="flex flex-col gap-md">
                                                <button className={`btn w-full flex items-center justify-center gap-sm ${isHelpful ? 'btn-primary' : 'btn-secondary'}`} onClick={handleHelpful}>
                                                      <span style={{ fontSize: '1.2rem' }}>{isHelpful ? '✅' : '👍'}</span>
                                                      {isHelpful ? 'Helpful' : 'Mark as Helpful'}
                                                </button>
                                                <button className={`btn w-full flex items-center justify-center gap-sm ${isSaved ? 'btn-primary' : 'btn-secondary'}`} onClick={handleSave}>
                                                      <span style={{ fontSize: '1.2rem' }}>{isSaved ? '📌' : '🔖'}</span>
                                                      {isSaved ? 'Saved' : 'Save for Later'}
                                                </button>
                                                {content.media?.[0] && (
                                                      <button 
                                                            className="btn btn-ghost w-full flex items-center justify-center gap-sm text-indigo-600 border border-indigo-100" 
                                                            onClick={async () => {
                                                                  try {
                                                                        const media = content.media[0];
                                                                        const url = media.url?.startsWith('http') ? media.url : `${API_BASE_URL}${media.url}`;
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
                                                                  } catch (err) { alert("Download failed"); }
                                                            }}
                                                      >
                                                            <span>⬇️</span> Download Media
                                                      </button>
                                                )}
                                          </div>
                                    </div>

                                    {/* Related Music */}
                                    {content.music && content.music.previewUrl && (
                                          <div className="card p-lg border-0 bg-indigo-50/50">
                                                <h4 className="font-bold mb-md text-xs text-indigo-400 uppercase tracking-widest">In this post</h4>
                                                <div className="flex items-center gap-md">
                                                      <div className="relative group cursor-pointer" onClick={() => isThisPlaying ? stopTrack() : playTrack(content.music)}>
                                                            <img src={content.music.albumArt} alt="" style={{ width: '64px', height: '64px', borderRadius: '12px', boxShadow: '0 4px 10px rgba(99,102,241,0.2)' }} />
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                                                  <span style={{ fontSize: '1.5rem', color: 'white' }}>{isThisPlaying ? '⏸️' : '▶️'}</span>
                                                            </div>
                                                      </div>
                                                      <div className="min-w-0">
                                                            <p className="font-bold text-sm truncate">{content.music.name}</p>
                                                            <p className="text-xs text-muted truncate">{content.music.artist}</p>
                                                      </div>
                                                </div>
                                          </div>
                                    )}
                              </div>
                        </div>
                  </div>

                  <style>{`
                        @media (max-width: 992px) {
                              .content-view-layout {
                                    grid-template-columns: 1fr !important;
                              }
                              .content-sidebar {
                                    display: none !important;
                              }
                              .mobile-only {
                                    display: flex !important;
                              }
                              .content-view-container {
                                    padding: 12px 16px !important;
                              }
                              .text-4xl {
                                    font-size: 2.25rem !important;
                              }
                        }
                  `}</style>
            </div>
      );
};

export default ContentView;
