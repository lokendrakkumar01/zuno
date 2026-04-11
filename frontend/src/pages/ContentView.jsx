import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { API_URL, API_BASE_URL } from '../config';
import CommentSection from '../components/Content/CommentSection';
import { BookmarkIcon, CheckIcon, CommentIcon, HeartIcon, ShareIcon } from '../components/Icons/ActionIcons';
import { resolveAssetUrl } from '../utils/media';

// Separate component for media items to avoid React hooks violation
const MediaItem = ({ m, content }) => {
      const [loaded, setLoaded] = useState(false);
      const [error, setError] = useState(false);
      const mediaUrl = resolveAssetUrl(m.url || '');

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
      const { token, user } = useAuth();
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
      const [shareBusy, setShareBusy] = useState(false);
      const [editingContent, setEditingContent] = useState(false);
      const [savingContent, setSavingContent] = useState(false);
      const [contentForm, setContentForm] = useState({ title: '', body: '' });
      const isOwner = Boolean(user?._id && content?.creator?._id?.toString() === user._id?.toString());

      const updateContentState = (updater) => {
            setContent((prev) => {
                  if (!prev) return prev;
                  const next = typeof updater === 'function' ? updater(prev) : updater;
                  try {
                        localStorage.setItem(`zuno_content_${id}`, JSON.stringify(next));
                  } catch {
                        // Cache writes are optional.
                  }
                  return next;
            });
      };

      useEffect(() => {
            if (!content) return;
            setContentForm({
                  title: content.title || '',
                  body: content.body || ''
            });
      }, [content?._id, content?.title, content?.body]);

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
                        const res = await fetch(`${API_URL}/content/${id}`, {
                              headers: token ? { Authorization: `Bearer ${token}` } : {}
                        });
                        const data = await res.json();
                        if (data.success) {
                              setContent(data.data.content);
                              setIsHelpful(Boolean(data.data.content?.viewerState?.isHelpful));
                              setIsSaved(Boolean(data.data.content?.viewerState?.isSaved));
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
      }, [id, token]);

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
                  const res = await fetch(`${API_URL}/content/${id}/helpful`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setIsHelpful(Boolean(data.data?.isHelpful));
                        updateContentState((prev) => ({
                              ...prev,
                              metrics: {
                                    ...(prev.metrics || {}),
                                    helpfulCount: data.data?.helpfulCount ?? prev.metrics?.helpfulCount ?? 0
                              }
                        }));
                  }
            } catch (error) {
                  console.error('Failed:', error);
            }
      };

      const handleSave = async () => {
            if (!token) return;
            try {
                  const res = await fetch(`${API_URL}/content/${id}/save`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setIsSaved(Boolean(data.data?.isSaved));
                        updateContentState((prev) => ({
                              ...prev,
                              metrics: {
                                    ...(prev.metrics || {}),
                                    saveCount: data.data?.saveCount ?? prev.metrics?.saveCount ?? 0
                              }
                        }));
                  }
            } catch (error) {
                  console.error('Failed:', error);
            }
      };

      const handleShare = async () => {
            if (shareBusy) return;

            setShareBusy(true);

            try {
                  const res = await fetch(`${API_URL}/content/${id}/share`, {
                        method: 'POST'
                  });
                  const data = await res.json();
                  const shareUrl = data.data?.shareUrl || `${window.location.origin}/content/${id}`;

                  updateContentState((prev) => ({
                        ...prev,
                        metrics: {
                              ...(prev.metrics || {}),
                              shareCount: data.data?.shareCount ?? prev.metrics?.shareCount ?? 0
                        }
                  }));

                  if (navigator.share) {
                        await navigator.share({
                              title: content.title || 'ZUNO content',
                              text: content.body?.slice(0, 120) || 'Check this out on ZUNO.',
                              url: shareUrl
                        });
                  } else if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(shareUrl);
                  } else {
                        window.open(shareUrl, '_blank', 'noopener,noreferrer');
                  }
            } catch (error) {
                  console.error('Failed to share content:', error);
            } finally {
                  setShareBusy(false);
            }
      };

      const handleDownloadMedia = async () => {
            if (!content.media?.[0]) return;

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
            } catch (error) {
                  console.error('Download failed:', error);
            }
      };

      const handleSaveContentEdit = async () => {
            if (!token || !isOwner || savingContent) return;

            setSavingContent(true);

            try {
                  const res = await fetch(`${API_URL}/content/${id}`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({
                              title: contentForm.title.trim(),
                              body: contentForm.body
                        })
                  });
                  const data = await res.json();

                  if (data.success) {
                        updateContentState((prev) => ({
                              ...prev,
                              title: data.data?.content?.title ?? contentForm.title.trim(),
                              body: data.data?.content?.body ?? contentForm.body,
                              updatedAt: data.data?.content?.updatedAt ?? prev.updatedAt
                        }));
                        setEditingContent(false);
                  }
            } catch (error) {
                  console.error('Failed to update content:', error);
            } finally {
                  setSavingContent(false);
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
                                                      {content.creator?.avatar ? <img src={resolveAssetUrl(content.creator.avatar)} alt="" /> : content.creator?.username?.charAt(0).toUpperCase()}
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
                                    <div className="flex items-start justify-between gap-md flex-wrap">
                                          <h1 className="text-4xl font-extrabold mb-md" style={{ letterSpacing: '-0.02em', lineHeight: '1.2', flex: '1 1 320px' }}>
                                                {content.title || 'Untitled Content'}
                                          </h1>
                                          {isOwner && (
                                                <button
                                                      type="button"
                                                      className={`btn ${editingContent ? 'btn-primary' : 'btn-secondary'} btn-sm flex items-center gap-sm`}
                                                      onClick={() => setEditingContent((prev) => !prev)}
                                                >
                                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M12 20h9" />
                                                            <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
                                                      </svg>
                                                      <span>{editingContent ? 'Close editor' : 'Edit content'}</span>
                                                </button>
                                          )}
                                    </div>
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

                              {isOwner && editingContent && (
                                    <div className="card p-lg mb-xl" style={{ border: '1px solid rgba(99, 102, 241, 0.18)' }}>
                                          <div className="grid gap-md">
                                                <div className="input-group">
                                                      <label className="input-label">Title</label>
                                                      <input
                                                            type="text"
                                                            className="input"
                                                            value={contentForm.title}
                                                            onChange={(event) => setContentForm((prev) => ({ ...prev, title: event.target.value }))}
                                                            placeholder="Add a clear title"
                                                      />
                                                </div>
                                                <div className="input-group">
                                                      <label className="input-label">Description</label>
                                                      <textarea
                                                            className="input"
                                                            rows={5}
                                                            value={contentForm.body}
                                                            onChange={(event) => setContentForm((prev) => ({ ...prev, body: event.target.value }))}
                                                            placeholder="Describe your content"
                                                      />
                                                </div>
                                                <div className="flex gap-sm flex-wrap">
                                                      <button type="button" className="btn btn-primary" onClick={handleSaveContentEdit} disabled={savingContent}>
                                                            {savingContent ? 'Saving...' : 'Save changes'}
                                                      </button>
                                                      <button
                                                            type="button"
                                                            className="btn btn-ghost"
                                                            onClick={() => {
                                                                  setContentForm({ title: content.title || '', body: content.body || '' });
                                                                  setEditingContent(false);
                                                            }}
                                                      >
                                                            Cancel
                                                      </button>
                                                </div>
                                          </div>
                                    </div>
                              )}

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

                              <div className="mb-2xl">
                                    <CommentSection
                                          contentId={content._id}
                                          onCountChange={(commentCount) => {
                                                updateContentState((prev) => ({
                                                      ...prev,
                                                      metrics: {
                                                            ...(prev.metrics || {}),
                                                            commentCount
                                                      }
                                                }));
                                          }}
                                    />
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
                                                                        {item.media?.[0]?.url && <img src={resolveAssetUrl(item.media[0].url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
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
                                                            {content.creator?.avatar ? <img src={resolveAssetUrl(content.creator.avatar)} alt="" /> : content.creator?.username?.charAt(0).toUpperCase()}
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
                                                <button
                                                      className="btn btn-secondary w-full flex items-center justify-center gap-sm"
                                                      onClick={() => {
                                                            const commentsSection = document.getElementById('comments');
                                                            if (commentsSection) {
                                                                  commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                            }
                                                      }}
                                                >
                                                      <CommentIcon size={18} />
                                                      Comments ({content.metrics?.commentCount || 0})
                                                </button>
                                                <button className={`btn w-full flex items-center justify-center gap-sm ${isHelpful ? 'btn-primary' : 'btn-secondary'}`} onClick={handleHelpful}>
                                                      {isHelpful ? <CheckIcon size={18} /> : <HeartIcon size={18} />}
                                                      {isHelpful ? 'Helpful' : 'Mark as Helpful'}
                                                </button>
                                                <button className={`btn w-full flex items-center justify-center gap-sm ${isSaved ? 'btn-primary' : 'btn-secondary'}`} onClick={handleSave}>
                                                      <BookmarkIcon size={18} filled={isSaved} />
                                                      {isSaved ? 'Saved' : 'Save for Later'}
                                                </button>
                                                <button
                                                      className="btn btn-secondary w-full flex items-center justify-center gap-sm"
                                                      onClick={handleShare}
                                                      disabled={shareBusy}
                                                >
                                                      <ShareIcon size={18} />
                                                      {shareBusy ? 'Sharing...' : `Share (${content.metrics?.shareCount || 0})`}
                                                </button>
                                                {isOwner && (
                                                      <button
                                                            type="button"
                                                            className="btn btn-ghost w-full flex items-center justify-center gap-sm"
                                                            onClick={() => setEditingContent((prev) => !prev)}
                                                      >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                  <path d="M12 20h9" />
                                                                  <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
                                                            </svg>
                                                            {editingContent ? 'Hide editor' : 'Edit title and description'}
                                                      </button>
                                                )}
                                                {content.media?.[0] && (
                                                      <button
                                                            className="btn btn-ghost w-full flex items-center justify-center gap-sm text-indigo-600 border border-indigo-100"
                                                            onClick={handleDownloadMedia}
                                                      >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                  <path d="M12 3v12" />
                                                                  <path d="m7 10 5 5 5-5" />
                                                                  <path d="M5 21h14" />
                                                            </svg>
                                                            Download Media
                                                      </button>
                                                )}
                                          </div>
                                    </div>

                                    <div className="card p-lg mb-lg border-2 border-indigo-50 shadow-sm" style={{ display: 'none' }}>
                                          <h4 className="font-bold mb-lg" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</h4>
                                          <div className="flex flex-col gap-md">
                                                <button
                                                      className="btn btn-secondary w-full flex items-center justify-center gap-sm"
                                                      onClick={() => {
                                                            const commentsSection = document.getElementById('comments');
                                                            if (commentsSection) {
                                                                  commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                            }
                                                      }}
                                                >
                                                      <span style={{ fontSize: '1.2rem' }}>💬</span>
                                                      Comments ({content.metrics?.commentCount || 0})
                                                </button>
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
                                    display: block !important;
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
                              .content-sidebar > div {
                                    position: static !important;
                              }
                        }
                  `}</style>
            </div>
      );
};

export default ContentView;
