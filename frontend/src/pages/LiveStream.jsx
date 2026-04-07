import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { API_URL } from '../config';
import { LiveKitRoom, RoomAudioRenderer, VideoConference, ControlBar, useRoomContext, VideoTrack } from '@livekit/components-react';
import '@livekit/components-styles';

/* ─────────────────────────────────────────────
   LIVE STREAM PAGE (LiveKit SFU Powered)
   Route /live          → list active streams
   Route /live/:hostId  → watch a stream
   Route /live/host     → start your own stream
───────────────────────────────────────────── */

const LiveStream = () => {
  const { hostId } = useParams(); // undefined = dashboard, 'host' = hosting mode, else = viewMode
  const { user, token } = useAuth();
  const { socket } = useSocketContext();
  const navigate = useNavigate();

  const isHostMode = hostId === 'host';
  const isViewMode = hostId && hostId !== 'host';

  /* ── Shared state ── */
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDesc, setStreamDesc] = useState('');
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [activeStreams, setActiveStreams] = useState([]);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [streamError, setStreamError] = useState('');

  /* ── LiveKit State ── */
  const [lkToken, setLkToken] = useState(null);
  const [lkUrl, setLkUrl] = useState(null);
  const [lkRoomName, setLkRoomName] = useState(null);

  /* ── Host AV Controls & Reactions ── */
  const [reactions, setReactions] = useState([]);

  /* ── Chat scroll ── */
  const commentsEndRef = useRef(null);
  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments]);

  /* ── Fetch active streams ── */
  useEffect(() => {
    if (isHostMode || isViewMode) return;
    const fetchStreams = async () => {
      setLoadingStreams(true);
      try {
        const res = await fetch(`${API_URL}/livestream/active`);
        const data = await res.json();
        if (data.success) setActiveStreams(data.data.streams || []);
      } catch { setActiveStreams([]); }
      finally { setLoadingStreams(false); }
    };
    fetchStreams();
    const interval = setInterval(fetchStreams, 10000);
    return () => clearInterval(interval);
  }, [isHostMode, isViewMode]);

  /* ── Socket listeners (For Chat & Reactions) ── */
  useEffect(() => {
    if (!socket) return;
    socket.on('viewerJoined', ({ viewerCount: vc }) => setViewerCount(vc));
    socket.on('viewerLeft', ({ viewerCount: vc }) => setViewerCount(vc));
    socket.on('newStreamComment', (data) => {
      if (data.comment?.startsWith('REACTION:')) {
        const emoji = data.comment.split(':')[1];
        const reactionId = Date.now() + Math.random();
        const newReaction = { id: reactionId, emoji, left: Math.random() * 80 + 10 };
        setReactions(prev => [...prev.slice(-30), newReaction]);
        setTimeout(() => setReactions(prev => prev.filter(r => r.id !== reactionId)), 2500);
        return;
      }
      setComments(prev => [...prev.slice(-200), data]);
    });
    socket.on('streamEnded', () => {
      setIsLive(false);
      setStreamError('Stream has ended.');
      setLkToken(null);
    });
    socket.on('streamNotFound', () => setStreamError('Stream not found or has already ended.'));

    return () => {
      socket.off('viewerJoined');
      socket.off('viewerLeft');
      socket.off('newStreamComment');
      socket.off('streamEnded');
      socket.off('streamNotFound');
    };
  }, [socket]);

  /* ── START STREAM (host) ── */
  const startStream = useCallback(async () => {
    if (!user || !socket) return;
    try {
      setStreamError('');
      const res = await fetch(`${API_URL}/livestream/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isHost: true, title: streamTitle || `${user.displayName || user.username}'s Live` })
      });
      const data = await res.json();
      
      if (!data.success) throw new Error(data.message || 'Failed to get stream token');

      setLkToken(data.data.token);
      setLkUrl(data.data.wsUrl);
      setLkRoomName(data.data.roomName);
      
      // Tell socket to start tracking Chat room
      socket.emit('startStream', { hostId: user._id, title: streamTitle, roomId: data.data.roomName });
      setIsLive(true);
    } catch (err) {
      setStreamError(err.message || 'Could not start stream. Please check configuration.');
    }
  }, [user, socket, token, streamTitle]);

  /* ── END STREAM (host) ── */
  const endStream = useCallback(async () => {
    if (!user || !socket) return;
    socket.emit('endStream', { hostId: user._id });
    await fetch(`${API_URL}/livestream/end`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setIsLive(false);
    setLkToken(null);
    navigate('/live');
  }, [user, socket, token, navigate]);

  /* ── JOIN STREAM (viewer) ── */
  useEffect(() => {
    if (!isViewMode || !socket || !user || !hostId) return;

    const joinStream = async () => {
      try {
        const res = await fetch(`${API_URL}/livestream/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ isHost: false, roomName: `stream_${hostId}` })
        });
        const data = await res.json();
        
        if (!data.success) throw new Error(data.message || 'Failed to connect');

        setLkToken(data.data.token);
        setLkUrl(data.data.wsUrl);
        setLkRoomName(data.data.roomName);
        
        socket.emit('joinStream', { hostId, viewerId: user._id });
        setIsLive(true);
      } catch (err) {
        setStreamError(err.message || 'Connection error');
      }
    };
    joinStream();

    return () => {
      socket.emit('leaveStreamView', { hostId, viewerId: user._id });
    };
  }, [isViewMode, socket, hostId, user, token]);

  /* ── SEND COMMENT ── */
  const sendComment = (e) => {
    e.preventDefault();
    if (!commentText.trim() || !socket) return;
    socket.emit('streamComment', {
      hostId: isHostMode ? user._id : hostId,
      comment: commentText.trim(),
      username: user?.username,
      avatar: user?.avatar
    });
    setCommentText('');
  };

  /* ── SEND REACTION ── */
  const sendReaction = (emoji) => {
    if (!socket) return;
    const newReaction = { id: Date.now() + Math.random(), emoji, left: Math.random() * 80 + 10 };
    setReactions(prev => [...prev.slice(-30), newReaction]);
    socket.emit('streamComment', {
      hostId: isHostMode ? user._id : hostId,
      comment: `REACTION:${emoji}`,
      username: user?.username,
      avatar: user?.avatar
    });
  };

  /* ────────────────────────────────
     RENDER: STREAM DASHBOARD
  ──────────────────────────────── */
  if (!hostId) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>
              🔴 <span style={{ background: 'linear-gradient(135deg,#ef4444,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Live Streams</span>
            </h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '4px', fontSize: '14px' }}>Watch or start a live stream</p>
          </div>
          {user && (
            <button
              onClick={() => navigate('/live/host')}
              style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 24px', fontWeight: 700, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(239,68,68,0.4)' }}
            >
              🎥 Go Live
            </button>
          )}
        </div>

        {loadingStreams ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid var(--color-border)', borderTopColor: '#ef4444', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <p>Loading live streams...</p>
          </div>
        ) : activeStreams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--color-surface)', borderRadius: '20px', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📡</div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px' }}>No Live Streams Right Now</h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>Be the first to go live!</p>
            {user && (
              <button onClick={() => navigate('/live/host')} style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 28px', fontWeight: 700, cursor: 'pointer' }}>
                🔴 Start Stream
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '16px' }}>
            {activeStreams.map(stream => (
              <div
                key={stream.id}
                onClick={() => navigate(`/live/${stream.hostId}`)}
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s,box-shadow 0.2s' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ height: '140px', background: 'linear-gradient(135deg,#1a1a2e,#16213e)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '10px', left: '10px', background: '#ef4444', color: 'white', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '7px', height: '7px', background: 'white', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
                    LIVE
                  </div>
                  <div style={{ fontSize: '3rem' }}>📡</div>
                </div>
                <div style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    {stream.hostAvatar ? (
                      <img src={stream.hostAvatar} alt={stream.hostUsername} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                        {stream.hostDisplayName?.charAt(0)}
                      </div>
                    )}
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{stream.hostDisplayName}</span>
                  </div>
                  <p style={{ fontWeight: 700, margin: '0 0 4px', fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stream.title}</p>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>
                    👁 {stream.viewerCount || 0} watching
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ────────────────────────────────
     RENDER: HOST / VIEWER MODE
  ──────────────────────────────── */
  return (
    <div className="livestream-layout">
      {/* Video Area */}
      <div className="livestream-video-area" style={{ position: 'relative', background: '#000' }}>
        
        {lkToken && lkUrl ? (
          <LiveKitRoom
            video={isHostMode} // Only host publishes video immediately
            audio={isHostMode} // Only host publishes audio immediately
            token={lkToken}
            serverUrl={lkUrl}
            data-lk-theme="default"
            style={{ width: '100%', height: '100%' }}
            onDisconnected={() => {
                if(isViewMode) { setStreamError('Disconnected from Host.'); setIsLive(false); }
            }}
          >
            <VideoConference />
            <RoomAudioRenderer />
            {isHostMode && (
                 <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px', zIndex: 100 }}>
                     <ControlBar controls={{ leave: false }} style={{ background: 'rgba(0,0,0,0.6)' }} />
                 </div>
            )}
          </LiveKitRoom>
        ) : null}

        {/* Overlay: Title + Viewer count */}
        {isLive && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '16px', background: 'linear-gradient(to bottom,rgba(0,0,0,0.7),transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ background: '#ef4444', color: 'white', borderRadius: '6px', padding: '4px 12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
                    LIVE
                </span>
                <span style={{ fontWeight: 700, fontSize: '16px' }}>{streamTitle || (isViewMode ? 'Live Stream' : 'My Stream')}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {isHostMode && (
                    <button onClick={endStream} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>End Stream</button>
                )}
                <span style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '20px', padding: '4px 12px', fontSize: '13px' }}>👁 {viewerCount}</span>
            </div>
            </div>
        )}

        {/* Host Setup Form (before going live) */}
        {isHostMode && !isLive && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: '32px', gap: '16px', zIndex: 20 }}>
            <div style={{ fontSize: '3rem' }}>🎥</div>
            <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.5rem' }}>Start Your Live Stream</h2>
            <input
              type="text"
              placeholder="Stream title (e.g. Tech Talk Live)"
              value={streamTitle}
              onChange={e => setStreamTitle(e.target.value)}
              style={{ width: '100%', maxWidth: '400px', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '15px' }}
            />
            {streamError && <p style={{ color: '#f87171', fontSize: '14px', margin: 0 }}>{streamError}</p>}
            <button
              onClick={startStream}
              style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: 'white', border: 'none', borderRadius: '12px', padding: '14px 40px', fontWeight: 800, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 20px rgba(239,68,68,0.5)' }}
            >
              🔴 Go Live
            </button>
          </div>
        )}

        {/* Viewer: Not connected yet */}
        {isViewMode && !isLive && !streamError && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', zIndex: 20 }}>
            <div style={{ width: '50px', height: '50px', border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#ef4444', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '16px' }}>Connecting to stream via SFU...</p>
          </div>
        )}

        {/* Stream error state */}
        {streamError && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', zIndex: 30 }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📡</div>
            <p style={{ color: '#f87171', fontWeight: 700, fontSize: '18px' }}>{streamError}</p>
            <button onClick={() => navigate('/live')} style={{ marginTop: '16px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '10px', padding: '10px 24px', cursor: 'pointer' }}>
              ← Back to Streams
            </button>
          </div>
        )}

        {/* Floating Reactions */}
        {reactions.map(r => (
          <div key={r.id} className="floating-reaction" style={{ left: `${r.left}%`, zIndex: 40 }}>
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Chat Panel */}
      <div className="livestream-chat-area">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: 700, fontSize: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>💬 Live Chat <span style={{ fontWeight: 400, fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginLeft: '6px' }}>{viewerCount} online</span></div>
          {/* Reaction Buttons */}
          {user && isLive && (
            <div style={{ display: 'flex', gap: '4px' }}>
              {['❤️','😂','👏','🔥'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '2px', transition: 'transform 0.1s' }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.8)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {comments.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', fontSize: '13px', marginTop: '40px' }}>No comments yet. Say hi! 👋</p>
          )}
          {comments.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              {c.avatar
                ? <img src={c.avatar} alt={c.username} style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
                : <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>{c.username?.charAt(0)}</div>
              }
              <div>
                <span style={{ fontWeight: 700, fontSize: '12px', color: '#a78bfa' }}>{c.username} </span>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', wordBreak: 'break-word' }}>{c.comment}</span>
              </div>
            </div>
          ))}
          <div ref={commentsEndRef} />
        </div>

        {user && (
          <form onSubmit={sendComment} style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Say something..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '13px', outline: 'none' }}
            />
            <button type="submit" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>→</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LiveStream;
