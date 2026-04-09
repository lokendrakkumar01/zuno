import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
      LiveKitRoom,
      VideoConference
} from '@livekit/components-react';
import '@livekit/components-styles';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { API_URL } from '../config';

const REACTION_OPTIONS = ['❤️', '😂', '👏', '🔥'];

const normalizeLiveKitUrl = (value) => {
      if (!value) {
            return null;
      }

      const trimmed = value.trim().replace(/\/+$/, '');

      if (trimmed.startsWith('https://')) {
            return `wss://${trimmed.slice('https://'.length)}`;
      }

      if (trimmed.startsWith('http://')) {
            return `ws://${trimmed.slice('http://'.length)}`;
      }

      return trimmed;
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

            return () => {
                  socket.off('newStreamComment', handleComment);
            };
      }, [socket]);

      return reactions.map((reaction) => (
            <div key={reaction.id} className="floating-reaction" style={{ left: `${reaction.left}%` }}>
                  {reaction.emoji}
            </div>
      ));
});

const LiveStream = () => {
      const { hostId } = useParams();
      const { user, token } = useAuth();
      const { socket, isConnected } = useSocketContext();
      const navigate = useNavigate();

      const isHostMode = hostId === 'host';
      const isViewMode = Boolean(hostId && hostId !== 'host');

      const [streamTitle, setStreamTitle] = useState('');
      const [streamDescription, setStreamDescription] = useState('');
      const [streamInfo, setStreamInfo] = useState(null);
      const [comments, setComments] = useState([]);
      const [commentText, setCommentText] = useState('');
      const [viewerCount, setViewerCount] = useState(0);
      const [isLive, setIsLive] = useState(false);
      const [activeStreams, setActiveStreams] = useState([]);
      const [loadingStreams, setLoadingStreams] = useState(true);
      const [streamError, setStreamError] = useState('');
      const [isStarting, setIsStarting] = useState(false);
      const [slowModeEnabled, setSlowModeEnabled] = useState(false);

      const [lkToken, setLkToken] = useState(null);
      const [lkUrl, setLkUrl] = useState(null);
      const [lkRoomName, setLkRoomName] = useState(null);

      const commentsEndRef = useRef(null);

      useEffect(() => {
            commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, [comments]);

      const loadActiveStreams = useCallback(async () => {
            if (isHostMode || isViewMode) return;

            setLoadingStreams(true);

            try {
                  const res = await fetch(`${API_URL}/livestream/active`);
                  const data = await res.json();
                  setActiveStreams(data.success ? data.data.streams || [] : []);
            } catch {
                  setActiveStreams([]);
            } finally {
                  setLoadingStreams(false);
            }
      }, [isHostMode, isViewMode]);

      useEffect(() => {
            if (isHostMode || isViewMode) return undefined;

            loadActiveStreams();
            const interval = setInterval(loadActiveStreams, 10000);

            return () => clearInterval(interval);
      }, [isHostMode, isViewMode, loadActiveStreams]);

      useEffect(() => {
            if (!isViewMode || !hostId) return undefined;

            let ignore = false;

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
                        }
                  } catch {
                        if (!ignore) {
                              setStreamInfo(null);
                        }
                  }
            };

            loadStreamInfo();

            return () => {
                  ignore = true;
            };
      }, [hostId, isViewMode]);

      useEffect(() => {
            if (!socket) return undefined;

            const handleViewerJoined = ({ viewerCount: nextViewerCount }) => setViewerCount(nextViewerCount || 0);
            const handleViewerLeft = ({ viewerCount: nextViewerCount }) => setViewerCount(nextViewerCount || 0);
            const handleNewComment = (data) => {
                  if (data.comment?.startsWith('REACTION:')) return;
                  setComments((prev) => [...prev.slice(-199), data]);
            };
            const handleStreamEnded = () => {
                  setIsLive(false);
                  setStreamError('This stream has ended.');
                  setLkToken(null);
                  setLkUrl(null);
                  setLkRoomName(null);
            };
            const handleStreamNotFound = () => setStreamError('Stream not found or already offline.');
            const handleStreamJoined = (payload) => {
                  setViewerCount(payload.viewerCount || 0);
                  setSlowModeEnabled(Boolean(payload.slowMode));
            };
            const handleSlowModeUpdated = (payload) => {
                  setSlowModeEnabled(Boolean(payload.enabled));
            };

            socket.on('viewerJoined', handleViewerJoined);
            socket.on('viewerLeft', handleViewerLeft);
            socket.on('newStreamComment', handleNewComment);
            socket.on('streamEnded', handleStreamEnded);
            socket.on('streamNotFound', handleStreamNotFound);
            socket.on('streamJoined', handleStreamJoined);
            socket.on('slowModeUpdated', handleSlowModeUpdated);

            return () => {
                  socket.off('viewerJoined', handleViewerJoined);
                  socket.off('viewerLeft', handleViewerLeft);
                  socket.off('newStreamComment', handleNewComment);
                  socket.off('streamEnded', handleStreamEnded);
                  socket.off('streamNotFound', handleStreamNotFound);
                  socket.off('streamJoined', handleStreamJoined);
                  socket.off('slowModeUpdated', handleSlowModeUpdated);
            };
      }, [socket]);

      const handleRoomError = useCallback((message) => {
            setStreamError(message);
      }, []);

      const warmupLocalMedia = useCallback(async () => {
            if (!navigator?.mediaDevices?.getUserMedia) {
                  return;
            }

            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            mediaStream.getTracks().forEach((track) => track.stop());
      }, []);

      const startStream = useCallback(async () => {
            if (!user || !socket) return;

            try {
                  setIsStarting(true);
                  setStreamError('');

                  if (!isConnected) {
                        throw new Error('Realtime connection is still getting ready. Please wait a moment and try again.');
                  }

                  await warmupLocalMedia();

                  const title = streamTitle || `${user.displayName || user.username}'s Live`;
                  const res = await fetch(`${API_URL}/livestream/token`, {
                        method: 'POST',
                        headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({
                              isHost: true,
                              title,
                              description: streamDescription
                        })
                  });
                  const data = await res.json();

                  if (!data.success) {
                        throw new Error(data.message || 'Failed to get stream token');
                  }

                  const roomUrl = normalizeLiveKitUrl(data.data.wsUrl);
                  const roomName = data.data.roomName;
                  const nextInfo = {
                        hostId: user._id,
                        roomId: roomName,
                        hostUsername: user.username,
                        hostDisplayName: user.displayName || user.username,
                        hostAvatar: user.avatar,
                        title,
                        description: streamDescription
                  };

                  setStreamInfo(nextInfo);
                  setStreamTitle(nextInfo.title);
                  setLkToken(data.data.token);
                  setLkUrl(roomUrl);
                  setLkRoomName(roomName);
                  setIsLive(true);
                  setComments([]);
                  setViewerCount(0);
                  setSlowModeEnabled(false);

                  socket.emit('startStream', {
                        hostId: user._id,
                        title: nextInfo.title,
                        description: streamDescription,
                        roomId: roomName
                  });
            } catch (error) {
                  const permissionBlocked = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
                  setStreamError(
                        permissionBlocked
                              ? 'Camera and microphone permission blocked. Allow access in the browser and try again.'
                              : (error.message || 'Could not start the stream.')
                  );
            } finally {
                  setIsStarting(false);
            }
      }, [isConnected, socket, streamDescription, streamTitle, token, user, warmupLocalMedia]);

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
            setLkToken(null);
            setLkUrl(null);
            setLkRoomName(null);
            navigate('/live');
      }, [navigate, socket, token, user]);

      useEffect(() => {
            if (!isViewMode || !socket || !user || !hostId) return undefined;

            let ignore = false;

            const joinStream = async () => {
                  try {
                        const roomName = streamInfo?.roomId || streamInfo?.id || `stream_${hostId}`;
                        const res = await fetch(`${API_URL}/livestream/token`, {
                              method: 'POST',
                              headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`
                              },
                              body: JSON.stringify({ isHost: false, roomName })
                        });
                        const data = await res.json();

                        if (!data.success) {
                              throw new Error(data.message || 'Failed to connect');
                        }

                        if (ignore) return;

                        setLkToken(data.data.token);
                        setLkUrl(normalizeLiveKitUrl(data.data.wsUrl));
                        setLkRoomName(data.data.roomName || roomName);
                        setIsLive(true);
                        setStreamError('');
                        socket.emit('joinStream', { hostId, viewerId: user._id });
                  } catch (error) {
                        if (!ignore) {
                              setStreamError(error.message || 'Connection error');
                        }
                  }
            };

            joinStream();

            return () => {
                  ignore = true;
                  socket.emit('leaveStreamView', { hostId, viewerId: user._id });
            };
      }, [hostId, isViewMode, socket, streamInfo, token, user]);

      const sendComment = (event) => {
            event.preventDefault();
            if (!commentText.trim() || !socket) return;
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
            const nextSlowMode = !slowModeEnabled;
            setSlowModeEnabled(nextSlowMode);
            socket.emit('setSlowMode', { enabled: nextSlowMode });
      };

      const sendReaction = (emoji) => {
            if (!socket) return;

            socket.emit('streamComment', {
                  hostId: isHostMode ? user?._id : hostId,
                  comment: `REACTION:${emoji}`,
                  username: user?.username,
                  avatar: user?.avatar
            });
      };

      if (!hostId) {
            return (
                  <div className="live-dashboard-page">
                        <div className="container live-dashboard-shell">
                              <section className="live-dashboard-hero">
                                    <div>
                                          <span className="home-kicker">Stable streaming</span>
                                          <h1>Live rooms that open fast and stay focused</h1>
                                          <p>
                                                Real-time comments, quick join flow, and a cleaner watch layout for both desktop and mobile.
                                          </p>
                                    </div>

                                    {user && (
                                          <button type="button" onClick={() => navigate('/live/host')} className="btn btn-primary">
                                                Go Live
                                          </button>
                                    )}
                              </section>

                              <section className="live-dashboard-strip">
                                    <div className="live-summary-card">
                                          <span>Active now</span>
                                          <strong>{activeStreams.length}</strong>
                                    </div>
                                    <div className="live-summary-card">
                                          <span>Experience</span>
                                          <strong>Low-lag</strong>
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
                                          <p>Start the next session and bring your audience in instantly.</p>
                                          {user && (
                                                <button type="button" className="btn btn-secondary" onClick={() => navigate('/live/host')}>
                                                      Start Stream
                                                </button>
                                          )}
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
                                                                        <img src={stream.hostAvatar} alt={stream.hostDisplayName} />
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

      return (
            <div className="livestream-layout">
                  <div className="livestream-video-area">
                        {lkToken && lkUrl ? (
                              <LiveKitRoom
                                    connect={Boolean(lkToken && lkUrl)}
                                    video={isHostMode ? { resolution: { width: 1280, height: 720, frameRate: 24 } } : false}
                                    audio={isHostMode ? { echoCancellation: true, noiseSuppression: true } : false}
                                    token={lkToken}
                                    serverUrl={lkUrl}
                                    data-lk-theme="default"
                                    style={{ width: '100%', height: '100%' }}
                                    onError={(error) => handleRoomError(error.message || 'Live room connection failed.')}
                                    onMediaDeviceFailure={(_, kind) => {
                                          const label = kind === 'videoinput' ? 'camera' : 'microphone';
                                          handleRoomError(`Could not access your ${label}. Check browser permission and device availability.`);
                                    }}
                                    onDisconnected={() => {
                                          if (isViewMode) {
                                                setIsLive(false);
                                                setStreamError('Disconnected from the stream.');
                                          }
                                    }}
                              >
                                    <VideoConference />
                              </LiveKitRoom>
                        ) : null}

                        <div className="live-video-overlay">
                              <div className="live-video-topbar">
                                    <div>
                                          <span className="live-badge">LIVE</span>
                                          <h2>{liveHeading}</h2>
                                          <p>{streamDescription || streamInfo?.description || 'Realtime chat, streaming and stable room controls.'}</p>
                                          {lkRoomName ? <small className="live-room-label">Room: {lkRoomName}</small> : null}
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

                        {isHostMode && !isLive && (
                              <div className="live-setup-shell">
                                    <div className="live-setup-card">
                                          <span className="home-kicker">Creator setup</span>
                                          <h2>Start a polished stream</h2>
                                          <p>Pick a clear title, optionally add context, and launch into a room built for fast join and stable response.</p>

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

                                          {streamError && <p className="live-error-text">{streamError}</p>}

                                          <div className="live-setup-actions">
                                                <button type="button" className="btn btn-primary" onClick={startStream} disabled={isStarting}>
                                                      {isStarting ? 'Starting...' : 'Go Live'}
                                                </button>
                                                <button type="button" className="btn btn-secondary" onClick={() => navigate('/live')}>Cancel</button>
                                          </div>
                                    </div>
                              </div>
                        )}

                        {isViewMode && !isLive && !streamError && (
                              <div className="live-loading-overlay">
                                    <div className="loader mb-md" />
                                    <p>Connecting to stream...</p>
                              </div>
                        )}

                        {streamError && (
                              <div className="live-loading-overlay">
                                    <h3>{streamError}</h3>
                                    <button type="button" className="btn btn-secondary" onClick={() => navigate('/live')}>Back to Streams</button>
                              </div>
                        )}

                        <ReactionsManager socket={socket} />
                  </div>

                  <aside className="livestream-chat-area">
                        <div className="live-chat-header">
                              <div>
                                    <strong>Live chat</strong>
                                    <small>{slowModeEnabled ? `${viewerCount} online • slow mode` : `${viewerCount} online`}</small>
                              </div>
                              {user && isLive && (
                                    <div className="live-reaction-row">
                                          {REACTION_OPTIONS.map((emoji) => (
                                                <button key={emoji} type="button" onClick={() => sendReaction(emoji)}>
                                                      {emoji}
                                                </button>
                                          ))}
                                    </div>
                              )}
                        </div>

                        <div className="live-chat-list">
                              {comments.length === 0 ? (
                                    <p className="live-chat-empty">No comments yet. Start the conversation.</p>
                              ) : (
                                    comments.map((comment, index) => (
                                          <div key={`${comment.timestamp || index}-${index}`} className="live-chat-item">
                                                {comment.avatar ? (
                                                      <img src={comment.avatar} alt={comment.username} />
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

                        {user ? (
                              <form onSubmit={sendComment} className="live-chat-form">
                                    <input
                                          type="text"
                                          value={commentText}
                                          onChange={(event) => setCommentText(event.target.value)}
                                          placeholder={slowModeEnabled && !isHostMode ? 'Host enabled slow mode for chat.' : 'Say something helpful...'}
                                          disabled={slowModeEnabled && !isHostMode}
                                    />
                                    <button type="submit" disabled={slowModeEnabled && !isHostMode}>Send</button>
                              </form>
                        ) : (
                              <div className="live-chat-login-note">
                                    <p>Log in to comment or send reactions.</p>
                              </div>
                        )}
                  </aside>
            </div>
      );
};

export default LiveStream;
