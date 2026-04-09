import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LiveKitRoom, RoomAudioRenderer, VideoConference, ControlBar } from '@livekit/components-react';
import '@livekit/components-styles';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { API_URL } from '../config';

const REACTION_OPTIONS = ['❤️', '😂', '👏', '🔥'];

const ReactionsManager = memo(({ socket }) => {
      const [reactions, setReactions] = useState([]);

      useEffect(() => {
            if (!socket) return;

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
      const { user, token } = useAuth();
      const { socket } = useSocketContext();
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
            if (isHostMode || isViewMode) return;

            loadActiveStreams();
            const interval = setInterval(loadActiveStreams, 10000);
            return () => clearInterval(interval);
      }, [isHostMode, isViewMode, loadActiveStreams]);

      useEffect(() => {
            if (!isViewMode || !hostId) return;

            let ignore = false;

            const loadStreamInfo = async () => {
                  try {
                        const res = await fetch(`${API_URL}/livestream/${hostId}`);
                        const data = await res.json();

                        if (!ignore && data.success) {
                              setStreamInfo(data.data.stream);
                              setStreamTitle(data.data.stream?.title || '');
                              setStreamDescription(data.data.stream?.description || '');
                              setViewerCount(data.data.stream?.viewerCount || 0);
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
            if (!socket) return;

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
            };

            socket.on('viewerJoined', handleViewerJoined);
            socket.on('viewerLeft', handleViewerLeft);
            socket.on('newStreamComment', handleNewComment);
            socket.on('streamEnded', handleStreamEnded);
            socket.on('streamNotFound', () => setStreamError('Stream not found or already offline.'));
            socket.on('streamJoined', (payload) => {
                  setViewerCount(payload.viewerCount || 0);
            });

            return () => {
                  socket.off('viewerJoined', handleViewerJoined);
                  socket.off('viewerLeft', handleViewerLeft);
                  socket.off('newStreamComment', handleNewComment);
                  socket.off('streamEnded', handleStreamEnded);
                  socket.off('streamNotFound');
                  socket.off('streamJoined');
            };
      }, [socket]);

      const startStream = useCallback(async () => {
            if (!user || !socket) return;

            try {
                  setStreamError('');
                  const res = await fetch(`${API_URL}/livestream/token`, {
                        method: 'POST',
                        headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({
                              isHost: true,
                              title: streamTitle || `${user.displayName || user.username}'s Live`,
                              description: streamDescription
                        })
                  });
                  const data = await res.json();

                  if (!data.success) {
                        throw new Error(data.message || 'Failed to get stream token');
                  }

                  const nextInfo = {
                        hostId: user._id,
                        hostUsername: user.username,
                        hostDisplayName: user.displayName || user.username,
                        hostAvatar: user.avatar,
                        title: streamTitle || `${user.displayName || user.username}'s Live`,
                        description: streamDescription
                  };

                  setStreamInfo(nextInfo);
                  setStreamTitle(nextInfo.title);
                  setLkToken(data.data.token);
                  setLkUrl(data.data.wsUrl);
                  setLkRoomName(data.data.roomName);
                  setIsLive(true);
                  setComments([]);
                  setViewerCount(0);

                  socket.emit('startStream', {
                        hostId: user._id,
                        title: nextInfo.title,
                        description: streamDescription,
                        roomId: data.data.roomName
                  });
            } catch (err) {
                  setStreamError(err.message || 'Could not start the stream.');
            }
      }, [socket, streamDescription, streamTitle, token, user]);

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
            if (!isViewMode || !socket || !user || !hostId) return;

            let ignore = false;

            const joinStream = async () => {
                  try {
                        const res = await fetch(`${API_URL}/livestream/token`, {
                              method: 'POST',
                              headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`
                              },
                              body: JSON.stringify({ isHost: false, roomName: `stream_${hostId}` })
                        });
                        const data = await res.json();

                        if (!data.success) {
                              throw new Error(data.message || 'Failed to connect');
                        }

                        if (ignore) return;

                        setLkToken(data.data.token);
                        setLkUrl(data.data.wsUrl);
                        setLkRoomName(data.data.roomName);
                        setIsLive(true);
                        setStreamError('');
                        socket.emit('joinStream', { hostId, viewerId: user._id });
                  } catch (err) {
                        if (!ignore) {
                              setStreamError(err.message || 'Connection error');
                        }
                  }
            };

            joinStream();

            return () => {
                  ignore = true;
                  socket.emit('leaveStreamView', { hostId, viewerId: user._id });
            };
      }, [hostId, isViewMode, socket, token, user]);

      const sendComment = (event) => {
            event.preventDefault();
            if (!commentText.trim() || !socket) return;

            socket.emit('streamComment', {
                  hostId: isHostMode ? user?._id : hostId,
                  comment: commentText.trim(),
                  username: user?.username,
                  avatar: user?.avatar
            });

            setCommentText('');
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
                                          {user && <button type="button" className="btn btn-secondary" onClick={() => navigate('/live/host')}>Start Stream</button>}
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
                                    <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>Go to Login</button>
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
                                    video={isHostMode}
                                    audio={isHostMode}
                                    token={lkToken}
                                    serverUrl={lkUrl}
                                    data-lk-theme="default"
                                    style={{ width: '100%', height: '100%' }}
                                    onDisconnected={() => {
                                          if (isViewMode) {
                                                setIsLive(false);
                                                setStreamError('Disconnected from the stream.');
                                          }
                                    }}
                              >
                                    <VideoConference />
                                    <RoomAudioRenderer />
                                    {isHostMode && (
                                          <div className="live-control-bar-wrap">
                                                <ControlBar controls={{ leave: false }} />
                                          </div>
                                    )}
                              </LiveKitRoom>
                        ) : null}

                        <div className="live-video-overlay">
                              <div className="live-video-topbar">
                                    <div>
                                          <span className="live-badge">LIVE</span>
                                          <h2>{liveHeading}</h2>
                                          <p>{streamDescription || streamInfo?.description || 'Realtime chat, streaming and stable room controls.'}</p>
                                    </div>

                                    <div className="live-topbar-actions">
                                          <span className="live-viewer-pill">{viewerCount} watching</span>
                                          {isHostMode && isLive ? (
                                                <button type="button" className="btn btn-secondary" onClick={endStream}>End Stream</button>
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
                                                <button type="button" className="btn btn-primary" onClick={startStream}>Go Live</button>
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
                                    <small>{viewerCount} online</small>
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
                                          placeholder="Say something helpful..."
                                    />
                                    <button type="submit">Send</button>
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
