import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { API_URL, STREAM_POLL_INTERVAL_MS } from '../config';
import { resolveAssetUrl } from '../utils/media';

const REACTION_OPTIONS = ['❤', '😂', '👏', '🔥'];
const ACTIVE_STREAMS_CACHE_KEY = 'zuno_live_streams_cache';
const PLAYBACK_STATUS_POLL_MS = 5000;

const readJsonCache = (key, fallback) => {
      try {
            const cached = localStorage.getItem(key);
            return cached ? JSON.parse(cached) : fallback;
      } catch {
            return fallback;
      }
};

const CopyField = ({ label, value, onCopy, secret = false }) => {
      const maskedValue = secret ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;

      return (
            <div className="live-copy-card">
                  <span>{label}</span>
                  <code>{maskedValue}</code>
                  <button type="button" onClick={() => onCopy(value)}>Copy</button>
            </div>
      );
};

const ReactionsManager = memo(({ socket }) => {
      const [reactions, setReactions] = useState([]);

      useEffect(() => {
            if (!socket) return undefined;

            const handleComment = (data) => {
                  if (!data.comment?.startsWith('REACTION:')) return;

                  const emoji = data.comment.split(':')[1];
                  const reactionId = `${Date.now()}-${Math.random()}`;
                  const nextReaction = { id: reactionId, emoji, left: Math.random() * 70 + 15 };

                  setReactions((prev) => [...prev.slice(-24), nextReaction]);
                  setTimeout(() => {
                        setReactions((prev) => prev.filter((reaction) => reaction.id !== reactionId));
                  }, 2400);
            };

            socket.on('newStreamComment', handleComment);
            return () => socket.off('newStreamComment', handleComment);
      }, [socket]);

      return reactions.map((reaction) => (
            <div key={reaction.id} className="floating-reaction" style={{ left: `${reaction.left}%` }}>
                  {reaction.emoji}
            </div>
      ));
});

const LiveStream = () => {
      const { hostId } = useParams();
      const navigate = useNavigate();
      const { user, token } = useAuth();
      const { socket, isConnected } = useSocketContext();

      const isHostMode = hostId === 'host';
      const isViewMode = Boolean(hostId && hostId !== 'host');

      const [streamTitle, setStreamTitle] = useState('');
      const [streamDescription, setStreamDescription] = useState('');
      const [streamInfo, setStreamInfo] = useState(null);
      const [sessionData, setSessionData] = useState(null);
      const [comments, setComments] = useState([]);
      const [commentText, setCommentText] = useState('');
      const [viewerCount, setViewerCount] = useState(0);
      const [isLive, setIsLive] = useState(false);
      const [activeStreams, setActiveStreams] = useState(() => readJsonCache(ACTIVE_STREAMS_CACHE_KEY, []));
      const [loadingStreams, setLoadingStreams] = useState(() => readJsonCache(ACTIVE_STREAMS_CACHE_KEY, []).length === 0);
      const [streamError, setStreamError] = useState('');
      const [isStarting, setIsStarting] = useState(false);
      const [slowModeEnabled, setSlowModeEnabled] = useState(false);
      const [copyFeedback, setCopyFeedback] = useState('');
      const [playbackReady, setPlaybackReady] = useState(false);
      const [checkingPlayback, setCheckingPlayback] = useState(false);
      const [playbackHint, setPlaybackHint] = useState('');

      const commentsEndRef = useRef(null);

      useEffect(() => {
            commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, [comments]);

      const copyToClipboard = useCallback(async (value) => {
            try {
                  await navigator.clipboard.writeText(value);
                  setCopyFeedback('Copied');
            } catch {
                  setCopyFeedback('Copy failed');
            }

            window.setTimeout(() => setCopyFeedback(''), 1500);
      }, []);

      const checkPlaybackStatus = useCallback(async (targetHostId) => {
            if (!targetHostId) return false;

            try {
                  setCheckingPlayback(true);
                  const res = await fetch(`${API_URL}/livestream/status/${targetHostId}`, {
                        cache: 'no-store'
                  });
                  const data = await res.json();

                  if (!data.success) {
                        setPlaybackReady(false);
                        if (res.status === 404) {
                              setStreamError('This stream is offline right now.');
                        }
                        return false;
                  }

                  const ready = Boolean(data.data?.playback?.active);
                  setPlaybackReady(ready);
                  if (ready) {
                        setStreamError('');
                  }
                  setPlaybackHint(
                        ready
                              ? ''
                              : (isHostMode
                                    ? 'Session is ready. Start streaming in OBS or Streamlabs using the RTMP URL and stream key.'
                                    : 'Waiting for the broadcaster to start sending video to Cloudinary.')
                  );
                  return ready;
            } catch {
                  setPlaybackReady(false);
                  setPlaybackHint(
                        isHostMode
                              ? 'Checking Cloudinary playback status...'
                              : 'Checking whether the live video is available...'
                  );
                  return false;
            } finally {
                  setCheckingPlayback(false);
            }
      }, [isHostMode]);

      const loadActiveStreams = useCallback(async () => {
            if (isHostMode || isViewMode) return;

            const cachedStreams = readJsonCache(ACTIVE_STREAMS_CACHE_KEY, []);
            if (cachedStreams.length === 0) {
                  setLoadingStreams(true);
            }

            try {
                  const res = await fetch(`${API_URL}/livestream/active`);
                  const data = await res.json();
                  const nextStreams = data.success ? data.data.streams || [] : [];
                  setActiveStreams(nextStreams);
                  localStorage.setItem(ACTIVE_STREAMS_CACHE_KEY, JSON.stringify(nextStreams));
            } catch {
                  if (cachedStreams.length === 0) {
                        setActiveStreams([]);
                  }
            } finally {
                  setLoadingStreams(false);
            }
      }, [isHostMode, isViewMode]);

      useEffect(() => {
            if (isHostMode || isViewMode) return undefined;

            loadActiveStreams();
            const intervalId = window.setInterval(loadActiveStreams, STREAM_POLL_INTERVAL_MS);
            return () => window.clearInterval(intervalId);
      }, [isHostMode, isViewMode, loadActiveStreams]);

      useEffect(() => {
            if (!isViewMode || !hostId) return undefined;

            let ignore = false;
            const cacheKey = `zuno_live_stream_${hostId}`;
            const cachedStreamInfo = readJsonCache(cacheKey, null);

            if (cachedStreamInfo) {
                  setStreamInfo(cachedStreamInfo);
                  setStreamTitle(cachedStreamInfo?.title || '');
                  setStreamDescription(cachedStreamInfo?.description || '');
                  setViewerCount(cachedStreamInfo?.viewerCount || 0);
            }

            const loadStreamInfo = async () => {
                  try {
                        const res = await fetch(`${API_URL}/livestream/${hostId}`);
                        const data = await res.json();

                        if (!ignore && data.success) {
                              const nextStream = data.data.stream;
                              setStreamInfo(nextStream);
                              setStreamTitle(nextStream?.title || '');
                              setStreamDescription(nextStream?.description || '');
                              setViewerCount(nextStream?.viewerCount || 0);
                              localStorage.setItem(cacheKey, JSON.stringify(nextStream));
                        }
                  } catch {
                        if (!ignore) {
                              setStreamInfo(cachedStreamInfo || null);
                        }
                  }
            };

            loadStreamInfo();
            return () => {
                  ignore = true;
            };
      }, [hostId, isViewMode]);

      const requestStreamSession = useCallback(async ({ isHost, title, description, targetHostId }) => {
            const res = await fetch(`${API_URL}/livestream/session`, {
                  method: 'POST',
                  headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                  },
                  cache: 'no-store',
                  body: JSON.stringify({
                        isHost,
                        title,
                        description,
                        hostId: targetHostId
                  })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                  throw new Error(data.message || 'Failed to prepare stream session.');
            }

            return data.data;
      }, [token]);

      useEffect(() => {
            if (!socket) return undefined;

            const handleStreamStarted = () => {
                  if (!isHostMode && !isViewMode) {
                        loadActiveStreams();
                  }
            };

            const handleStreamEnded = ({ hostId: endedHostId } = {}) => {
                  if (!isHostMode && !isViewMode) {
                        loadActiveStreams();
                  }

                  if (
                        (isViewMode && String(endedHostId) === String(hostId))
                        || (isHostMode && String(endedHostId) === String(user?._id))
                  ) {
                        setIsLive(false);
                        setPlaybackReady(false);
                        setPlaybackHint('');
                        setStreamError('This stream has ended.');
                  }
            };

            const handleViewerJoined = ({ viewerCount: nextViewerCount }) => setViewerCount(nextViewerCount || 0);
            const handleViewerLeft = ({ viewerCount: nextViewerCount }) => setViewerCount(nextViewerCount || 0);
            const handleNewComment = (data) => {
                  if (data.comment?.startsWith('REACTION:')) return;
                  setComments((prev) => [...prev.slice(-199), data]);
            };
            const handleStreamNotFound = () => setStreamError('Stream not found or already offline.');
            const handleStreamJoined = (payload) => {
                  setViewerCount(payload.viewerCount || 0);
                  setSlowModeEnabled(Boolean(payload.slowMode));
            };
            const handleSlowModeUpdated = (payload) => setSlowModeEnabled(Boolean(payload.enabled));

            socket.on('streamStarted', handleStreamStarted);
            socket.on('streamEnded', handleStreamEnded);
            socket.on('viewerJoined', handleViewerJoined);
            socket.on('viewerLeft', handleViewerLeft);
            socket.on('newStreamComment', handleNewComment);
            socket.on('streamNotFound', handleStreamNotFound);
            socket.on('streamJoined', handleStreamJoined);
            socket.on('slowModeUpdated', handleSlowModeUpdated);

            return () => {
                  socket.off('streamStarted', handleStreamStarted);
                  socket.off('streamEnded', handleStreamEnded);
                  socket.off('viewerJoined', handleViewerJoined);
                  socket.off('viewerLeft', handleViewerLeft);
                  socket.off('newStreamComment', handleNewComment);
                  socket.off('streamNotFound', handleStreamNotFound);
                  socket.off('streamJoined', handleStreamJoined);
                  socket.off('slowModeUpdated', handleSlowModeUpdated);
            };
      }, [hostId, isHostMode, isViewMode, loadActiveStreams, socket, user?._id]);

      const startStream = useCallback(async () => {
            if (!user || !socket) return;

            try {
                  setIsStarting(true);
                  setStreamError('');
                  setPlaybackReady(false);
                  setPlaybackHint('Preparing Cloudinary session...');

                  if (!isConnected) {
                        throw new Error('Realtime connection is still getting ready. Please wait a moment and try again.');
                  }

                  const title = streamTitle.trim() || `${user.displayName || user.username}'s Live`;
                  const description = streamDescription.trim();
                  const data = await requestStreamSession({ isHost: true, title, description });

                  setSessionData(data);
                  setStreamInfo(data.stream);
                  setStreamTitle(data.stream?.title || title);
                  setStreamDescription(data.stream?.description || description);
                  setIsLive(true);
                  setComments([]);
                  setViewerCount(0);
                  setSlowModeEnabled(false);
                  setPlaybackHint('Session ready. Start streaming in OBS or Streamlabs now.');

                  socket.emit('startStream', {
                        hostId: user._id,
                        title: data.stream?.title || title,
                        description: data.stream?.description || description,
                        roomId: data.roomId
                  });
            } catch (error) {
                  setStreamError(error.message || 'Could not start the stream.');
            } finally {
                  setIsStarting(false);
            }
      }, [isConnected, requestStreamSession, socket, streamDescription, streamTitle, user]);

      const endStream = useCallback(async () => {
            if (!user || !socket) return;

            socket.emit('endStream', { hostId: user._id });

            try {
                  await fetch(`${API_URL}/livestream/end`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                  });
            } catch {
                  // Socket cleanup already handles the live state.
            }

            setIsLive(false);
            setPlaybackReady(false);
            setPlaybackHint('');
            setSessionData(null);
            setStreamInfo(null);
            navigate('/live');
      }, [navigate, socket, token, user]);

      useEffect(() => {
            if (!isViewMode || !socket || !user || !hostId) return undefined;
            if (!isConnected) {
                  setIsLive(false);
                  setPlaybackReady(false);
                  setPlaybackHint('Connecting to live chat and stream room...');
                  return undefined;
            }

            let ignore = false;
            let retryTimer = null;

            const joinStream = async (attempt = 1) => {
                  try {
                        const data = await requestStreamSession({
                              isHost: false,
                              targetHostId: hostId
                        });

                        if (ignore) return;

                        setSessionData(data);
                        setStreamInfo(data.stream);
                        setStreamTitle(data.stream?.title || '');
                        setStreamDescription(data.stream?.description || '');
                        setViewerCount(data.stream?.viewerCount || 0);
                        setIsLive(true);
                        setPlaybackReady(false);
                        setPlaybackHint('Waiting for the broadcaster to start sending video.');
                        setStreamError('');

                        socket.emit('joinStream', { hostId, viewerId: user._id });
                  } catch (error) {
                        if (ignore) return;

                        if (attempt < 3) {
                              setStreamError('Preparing the live room...');
                              retryTimer = window.setTimeout(() => joinStream(attempt + 1), 1400);
                              return;
                        }

                        setStreamError(error.message || 'Connection error');
                  }
            };

            joinStream();

            return () => {
                  ignore = true;
                  if (retryTimer) {
                        window.clearTimeout(retryTimer);
                  }
                  socket.emit('leaveStreamView', { hostId, viewerId: user._id });
            };
      }, [hostId, isConnected, isViewMode, requestStreamSession, socket, user]);

      useEffect(() => {
            const playbackHostId = isHostMode ? user?._id : hostId;
            if (!isLive || !playbackHostId) return undefined;

            checkPlaybackStatus(playbackHostId);
            const intervalId = window.setInterval(() => {
                  checkPlaybackStatus(playbackHostId);
            }, PLAYBACK_STATUS_POLL_MS);

            return () => window.clearInterval(intervalId);
      }, [checkPlaybackStatus, hostId, isHostMode, isLive, user?._id]);

      const sendComment = (event) => {
            event.preventDefault();
            if (!commentText.trim() || !socket || !isLive) return;
            if (slowModeEnabled && !isHostMode) return;

            socket.emit('streamComment', {
                  hostId: isHostMode ? user?._id : hostId,
                  comment: commentText.trim(),
                  username: user?.username,
                  avatar: user?.avatar
            });

            setCommentText('');
      };

      const toggleSlowMode = () => {
            if (!socket || !isHostMode) return;
            const nextValue = !slowModeEnabled;
            setSlowModeEnabled(nextValue);
            socket.emit('setSlowMode', { enabled: nextValue });
      };

      const sendReaction = (emoji) => {
            if (!socket || !isLive) return;

            socket.emit('streamComment', {
                  hostId: isHostMode ? user?._id : hostId,
                  comment: `REACTION:${emoji}`,
                  username: user?.username,
                  avatar: user?.avatar
            });
      };

      const retryStreamConnection = async () => {
            if (!isViewMode || !user || !socket) return;
            if (!isConnected) {
                  setStreamError('Realtime connection is still getting ready. Please try again in a moment.');
                  return;
            }

            try {
                  setStreamError('');
                  const data = await requestStreamSession({
                        isHost: false,
                        targetHostId: hostId
                  });
                  setSessionData(data);
                  setStreamInfo(data.stream);
                  setIsLive(true);
                  setPlaybackReady(false);
                  setPlaybackHint('Waiting for the broadcaster to start sending video.');
                  socket.emit('joinStream', { hostId, viewerId: user._id });
            } catch (error) {
                  setStreamError(error.message || 'Could not reconnect to the stream.');
            }
      };

      if (!hostId) {
            return (
                  <div className="live-dashboard-page">
                        <div className="container live-dashboard-shell">
                              <section className="live-dashboard-hero">
                                    <div>
                                          <span className="home-kicker">Cloudinary live streaming</span>
                                          <h1>Broadcast with RTMP and watch through the Cloudinary player</h1>
                                          <p>Hosts get encoder details instantly, viewers join the embedded player, and chat stays realtime through sockets.</p>
                                    </div>
                                    {user ? (
                                          <button type="button" onClick={() => navigate('/live/host')} className="btn btn-primary">
                                                Start Live Setup
                                          </button>
                                    ) : null}
                              </section>

                              <section className="live-dashboard-strip">
                                    <div className="live-summary-card">
                                          <span>Active now</span>
                                          <strong>{activeStreams.length}</strong>
                                    </div>
                                    <div className="live-summary-card">
                                          <span>Streaming</span>
                                          <strong>Cloudinary</strong>
                                    </div>
                                    <div className="live-summary-card">
                                          <span>Chat</span>
                                          <strong>Realtime</strong>
                                    </div>
                              </section>

                              {loadingStreams ? (
                                    <div className="live-empty-card">
                                          <div className="loader mb-md" />
                                          <p>Loading live streams...</p>
                                    </div>
                              ) : activeStreams.length === 0 ? (
                                    <div className="live-empty-card">
                                          <h3>No live streams right now</h3>
                                          <p>Set up the next Cloudinary stream and bring your audience in with one player link.</p>
                                          {user ? (
                                                <button type="button" className="btn btn-secondary" onClick={() => navigate('/live/host')}>
                                                      Open Host Setup
                                                </button>
                                          ) : null}
                                    </div>
                              ) : (
                                    <div className="live-stream-grid">
                                          {activeStreams.map((stream) => (
                                                <button
                                                      type="button"
                                                      key={stream.id}
                                                      className="live-stream-card"
                                                      onClick={() => navigate(`/live/${stream.hostId}`)}
                                                >
                                                      <div className="live-stream-card-media">
                                                            <span className="live-badge">LIVE</span>
                                                      </div>
                                                      <div className="live-stream-card-body">
                                                            <div className="live-stream-host">
                                                                  {stream.hostAvatar ? (
                                                                        <img src={resolveAssetUrl(stream.hostAvatar)} alt={stream.hostDisplayName} />
                                                                  ) : (
                                                                        <span>{stream.hostDisplayName?.charAt(0) || 'Z'}</span>
                                                                  )}
                                                                  <div>
                                                                        <strong>{stream.hostDisplayName}</strong>
                                                                        <small>@{stream.hostUsername}</small>
                                                                  </div>
                                                            </div>
                                                            <h3>{stream.title}</h3>
                                                            <p>{stream.viewerCount || 0} watching now</p>
                                                      </div>
                                                </button>
                                          ))}
                                    </div>
                              )}
                        </div>
                  </div>
            );
      }

      if (!user) {
            return (
                  <div className="live-dashboard-page">
                        <div className="container live-dashboard-shell">
                              <div className="live-empty-card">
                                    <h3>Login required</h3>
                                    <p>You need an account to host or join a protected live room.</p>
                                    <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>
                                          Go to Login
                                    </button>
                              </div>
                        </div>
                  </div>
            );
      }

      const liveHeading = streamTitle || streamInfo?.title || (isHostMode ? 'My live stream' : 'Live stream');
      const playbackUrl = sessionData?.playback?.playerUrl || '';
      const hlsUrl = sessionData?.playback?.hlsUrl || '';
      const hlsPublicId = sessionData?.playback?.hlsPublicId || '';
      const broadcast = sessionData?.broadcast;
      const waitingForPlayback = isLive && !playbackReady && !streamError;

      return (
            <div className="livestream-layout">
                  <div className="livestream-video-area">
                        {playbackUrl && playbackReady ? (
                              <div className="live-player-shell">
                                    <iframe
                                          title={liveHeading}
                                          src={playbackUrl}
                                          className="live-player-frame"
                                          allow="autoplay; fullscreen; picture-in-picture"
                                          allowFullScreen
                                    />
                              </div>
                        ) : null}

                        <div className="live-video-overlay">
                              <div className="live-video-topbar">
                                    <div>
                                          <span className="live-badge">{playbackReady ? 'LIVE' : 'PREPARING'}</span>
                                          <h2>{liveHeading}</h2>
                                          <p>{streamDescription || streamInfo?.description || 'Cloudinary-powered playback with realtime audience chat.'}</p>
                                          {streamInfo?.roomId ? <small className="live-room-label">Room: {streamInfo.roomId}</small> : null}
                                    </div>

                                    <div className="live-topbar-actions">
                                          <span className="live-viewer-pill">{viewerCount} watching</span>
                                          {isHostMode && isLive ? (
                                                <>
                                                      <button type="button" className="btn btn-ghost btn-sm" onClick={toggleSlowMode}>
                                                            {slowModeEnabled ? 'Slow mode on' : 'Slow mode off'}
                                                      </button>
                                                      <button type="button" className="btn btn-secondary" onClick={endStream}>End Stream</button>
                                                </>
                                          ) : (
                                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/live')}>Back</button>
                                          )}
                                    </div>
                              </div>
                        </div>

                        {isHostMode && !isLive ? (
                              <div className="live-setup-shell">
                                    <div className="live-setup-card">
                                          <span className="home-kicker">Creator setup</span>
                                          <h2>Prepare your Cloudinary live session</h2>
                                          <p>Start the session here, then paste the RTMP URL and stream key into OBS or Streamlabs to begin broadcasting.</p>
                                          <input
                                                type="text"
                                                className="input"
                                                placeholder="Stream title"
                                                value={streamTitle}
                                                onChange={(event) => setStreamTitle(event.target.value)}
                                          />
                                          <textarea
                                                className="input"
                                                placeholder="What are you streaming about?"
                                                value={streamDescription}
                                                onChange={(event) => setStreamDescription(event.target.value)}
                                                rows={3}
                                          />
                                          {streamError ? <p className="live-error-text">{streamError}</p> : null}
                                          <div className="live-setup-actions">
                                                <button type="button" className="btn btn-primary" onClick={startStream} disabled={isStarting}>
                                                      {isStarting ? 'Preparing...' : 'Start Session'}
                                                </button>
                                                <button type="button" className="btn btn-secondary" onClick={() => navigate('/live')}>Cancel</button>
                                          </div>
                                    </div>
                              </div>
                        ) : null}

                        {isViewMode && !isLive && !streamError ? (
                              <div className="live-loading-overlay">
                                    <div className="loader mb-md" />
                                    <p>{isConnected ? 'Connecting to stream...' : 'Connecting to realtime service...'}</p>
                              </div>
                        ) : null}

                        {waitingForPlayback ? (
                              <div className="live-loading-overlay">
                                    <div className="loader mb-md" />
                                    <h3>{isHostMode ? 'Stream session is ready' : 'Waiting for live video'}</h3>
                                    <p style={{ maxWidth: '42ch', textAlign: 'center' }}>
                                          {playbackHint || (isHostMode
                                                ? 'Open OBS or Streamlabs and start streaming with the RTMP URL and stream key shown on the right.'
                                                : 'The room is open, but the broadcaster has not started sending the stream yet.')}
                                    </p>
                                    {checkingPlayback ? <small>Checking Cloudinary playback...</small> : null}
                              </div>
                        ) : null}

                        {streamError ? (
                              <div className="live-loading-overlay">
                                    <h3>{streamError}</h3>
                                    <div className="live-setup-actions">
                                          {isViewMode ? (
                                                <button type="button" className="btn btn-primary" onClick={retryStreamConnection}>
                                                      Retry Stream
                                                </button>
                                          ) : null}
                                          <button type="button" className="btn btn-secondary" onClick={() => navigate('/live')}>Back to Streams</button>
                                    </div>
                              </div>
                        ) : null}

                        <ReactionsManager socket={socket} />
                  </div>

                  <aside className="livestream-chat-area">
                        <div className="live-chat-header">
                              <div>
                                    <strong>Live chat</strong>
                                    <small>{slowModeEnabled ? `${viewerCount} online • slow mode` : `${viewerCount} online`}</small>
                              </div>
                              {user && isLive ? (
                                    <div className="live-reaction-row">
                                          {REACTION_OPTIONS.map((emoji) => (
                                                <button key={emoji} type="button" onClick={() => sendReaction(emoji)}>
                                                      {emoji}
                                                </button>
                                          ))}
                                    </div>
                              ) : null}
                        </div>

                        {isHostMode && isLive && broadcast ? (
                              <div className="live-host-panel">
                                    <div className="live-host-panel-head">
                                          <div>
                                                <strong>Cloudinary encoder setup</strong>
                                                <p>Use these values in OBS or Streamlabs. Video appears automatically here once Cloudinary receives the feed.</p>
                                          </div>
                                          {copyFeedback ? <span className="live-copy-feedback">{copyFeedback}</span> : null}
                                    </div>

                                    <div className="live-copy-grid">
                                          <CopyField label="RTMP URL" value={broadcast.rtmpUrl} onCopy={copyToClipboard} />
                                          <CopyField label="Stream Key" value={broadcast.streamKey} onCopy={copyToClipboard} secret />
                                          <CopyField label="Ingest URL" value={broadcast.ingestUrl} onCopy={copyToClipboard} />
                                          <CopyField label="Player Link" value={playbackUrl} onCopy={copyToClipboard} />
                                          <CopyField label="HLS URL" value={hlsUrl} onCopy={copyToClipboard} />
                                          <CopyField label="HLS Public ID" value={hlsPublicId} onCopy={copyToClipboard} />
                                    </div>
                              </div>
                        ) : null}

                        <div className="live-chat-list">
                              {comments.length === 0 ? (
                                    <p className="live-chat-empty">No comments yet. Start the conversation.</p>
                              ) : (
                                    comments.map((comment, index) => (
                                          <div key={`${comment.timestamp || index}-${index}`} className="live-chat-item">
                                                {comment.avatar ? (
                                                      <img src={resolveAssetUrl(comment.avatar)} alt={comment.username} />
                                                ) : (
                                                      <span className="live-chat-avatar-fallback">{comment.username?.charAt(0) || 'Z'}</span>
                                                )}
                                                <div>
                                                      <strong>{comment.username}</strong>
                                                      <p>{comment.comment}</p>
                                                </div>
                                          </div>
                                    ))
                              )}
                              <div ref={commentsEndRef} />
                        </div>

                        <form onSubmit={sendComment} className="live-chat-form">
                              <input
                                    type="text"
                                    value={commentText}
                                    onChange={(event) => setCommentText(event.target.value)}
                                    placeholder={slowModeEnabled && !isHostMode ? 'Host enabled slow mode for chat.' : 'Say something helpful...'}
                                    disabled={!isLive || (slowModeEnabled && !isHostMode)}
                              />
                              <button type="submit" disabled={!isLive || (slowModeEnabled && !isHostMode)}>Send</button>
                        </form>
                  </aside>
            </div>
      );
};

export default LiveStream;
