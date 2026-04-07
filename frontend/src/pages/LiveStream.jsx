import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { API_URL } from '../config';
import Peer from 'simple-peer';

/* ─────────────────────────────────────────────
   LIVE STREAM PAGE — works as HOST or VIEWER
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

  /* ── Host AV Controls & Reactions ── */
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [reactions, setReactions] = useState([]);

  /* ── Video refs ── */
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // { viewerSocketId: Peer }
  const hostPeerRef = useRef(null); // viewer's connection to host
  const hostSocketIdRef = useRef(null);

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

  /* ── Socket listeners ── */
  useEffect(() => {
    if (!socket) return;

    /* HOST receives new viewer → initiate peer connection */
    socket.on('initPeerWithViewer', ({ viewerSocketId }) => {
      if (!localStreamRef.current) return;
      const peer = new Peer({ initiator: true, trickle: true, stream: localStreamRef.current });
      peer.on('signal', signal => socket.emit('streamSignal', { to: viewerSocketId, signal }));
      peer.on('error', () => {});
      peersRef.current[viewerSocketId] = peer;
    });

    /* VIEWER receives stream signal from host */
    socket.on('streamSignal', ({ signal, from }) => {
      if (isHostMode) {
        // Host receives viewer's answer signal
        if (peersRef.current[from]) peersRef.current[from].signal(signal);
      } else {
        // Viewer receives host's offer signal
        if (hostPeerRef.current) {
          hostPeerRef.current.signal(signal);
        }
      }
    });

    socket.on('viewerJoined', ({ viewerCount: vc }) => setViewerCount(vc));
    socket.on('viewerLeft', ({ viewerCount: vc }) => setViewerCount(vc));
    socket.on('newStreamComment', (data) => {
      // Intercept Reactions
      if (data.comment?.startsWith('REACTION:')) {
        const emoji = data.comment.split(':')[1];
        const newReaction = { id: Date.now() + Math.random(), emoji, left: Math.random() * 80 + 10 };
        setReactions(prev => [...prev.slice(-30), newReaction]); // keep memory light
        return;
      }
      setComments(prev => [...prev.slice(-200), data]);
    });
    socket.on('streamEnded', () => {
      setIsLive(false);
      setStreamError('Stream has ended.');
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });
    socket.on('streamNotFound', () => setStreamError('Stream not found or has already ended.'));
    socket.on('streamJoined', ({ viewerCount: vc, hostSocketId: hsid }) => {
      setViewerCount(vc);
      hostSocketIdRef.current = hsid;
    });

    return () => {
      socket.off('initPeerWithViewer');
      socket.off('streamSignal');
      socket.off('viewerJoined');
      socket.off('viewerLeft');
      socket.off('newStreamComment');
      socket.off('streamEnded');
      socket.off('streamNotFound');
      socket.off('streamJoined');
    };
  }, [socket, isHostMode]);

  /* ── START STREAM (host) ── */
  const startStream = useCallback(async () => {
    if (!user || !socket) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // Register stream on backend
      await fetch(`${API_URL}/livestream/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: streamTitle || `${user.displayName || user.username}'s Live`, description: streamDesc })
      });

      const roomId = `stream_${user._id}`;
      socket.emit('startStream', { hostId: user._id, title: streamTitle, roomId });
      setIsLive(true);
    } catch (err) {
      setStreamError('Could not access camera/microphone. Please check permissions.');
    }
  }, [user, socket, token, streamTitle, streamDesc]);

  /* ── END STREAM (host) ── */
  const endStream = useCallback(async () => {
    if (!user || !socket) return;
    socket.emit('endStream', { hostId: user._id });
    await fetch(`${API_URL}/livestream/end`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    Object.values(peersRef.current).forEach(p => p.destroy());
    peersRef.current = {};
    setIsLive(false);
    navigate('/live');
  }, [user, socket, token, navigate]);

  /* ── HOST AV CONTROLS ── */
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const toggleScreenShare = async () => {
    if (!localStreamRef.current) return;
    try {
      if (!isScreenSharing) {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = displayStream.getVideoTracks()[0];
        
        screenTrack.onended = () => {
          // Revert back to webcam
          const webcamTrack = localStreamRef.current.getVideoTracks()[0];
          Object.values(peersRef.current).forEach(peer => peer.replaceTrack(screenTrack, webcamTrack, localStreamRef.current));
          setIsScreenSharing(false);
        };

        const webcamTrack = localStreamRef.current.getVideoTracks()[0];
        Object.values(peersRef.current).forEach(peer => peer.replaceTrack(webcamTrack, screenTrack, localStreamRef.current));
        
        if (localVideoRef.current) localVideoRef.current.srcObject = displayStream;
        setIsScreenSharing(true);
      } else {
        // Stop screen share manually
        const webcamTrack = localStreamRef.current.getVideoTracks()[0];
        if (localVideoRef.current && localVideoRef.current.srcObject) {
          const activeScreenTracks = localVideoRef.current.srcObject.getVideoTracks();
          activeScreenTracks.forEach(t => t.stop());
        }
        Object.values(peersRef.current).forEach(peer => {
          // Find currently active track in peer to replace
          const activeTrackInPeer = peer.streams[0]?.getVideoTracks()[0];
          if(activeTrackInPeer) peer.replaceTrack(activeTrackInPeer, webcamTrack, localStreamRef.current);
        });
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        setIsScreenSharing(false);
      }
    } catch (err) {
      console.warn("Screen sharing failed/cancelled:", err);
    }
  };

  /* ── JOIN STREAM (viewer) ── */
  useEffect(() => {
    if (!isViewMode || !socket || !user) return;
    const viewerId = user._id;

    const peer = new Peer({ initiator: false, trickle: true });
    hostPeerRef.current = peer;

    peer.on('signal', signal => {
      const target = hostSocketIdRef.current || hostId;
      socket.emit('streamSignal', { to: target, signal });
    });
    peer.on('stream', remoteStream => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      setIsLive(true);
    });
    peer.on('error', (err) => {
      console.error("WebRTC Error:", err);
      // Only set error if we don't have a stream yet
      if (!setIsLive) setStreamError('Connection error. Try refreshing.');
    });

    socket.emit('joinStream', { hostId, viewerId });

    return () => {
      peer.destroy();
      socket.emit('leaveStreamView', { hostId, viewerId });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewMode, socket, hostId]);

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
    // Visually show locally immediately for low latency feel
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
      <div className="livestream-video-area">
        {/* Stream video */}
        {isHostMode
          ? <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        }

        {/* Overlay: Title + Viewer count */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '16px', background: 'linear-gradient(to bottom,rgba(0,0,0,0.7),transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isLive && (
              <span style={{ background: '#ef4444', color: 'white', borderRadius: '6px', padding: '4px 12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
                LIVE
              </span>
            )}
            <span style={{ fontWeight: 700, fontSize: '16px' }}>{streamTitle || (isViewMode ? 'Live Stream' : 'My Stream')}</span>
          </div>
          <span style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '20px', padding: '4px 12px', fontSize: '13px' }}>👁 {viewerCount}</span>
        </div>

        {/* Host Setup Form (before going live) */}
        {isHostMode && !isLive && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: '32px', gap: '16px' }}>
            <div style={{ fontSize: '3rem' }}>🎥</div>
            <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.5rem' }}>Start Your Live Stream</h2>
            <input
              type="text"
              placeholder="Stream title (e.g. Tech Talk Live)"
              value={streamTitle}
              onChange={e => setStreamTitle(e.target.value)}
              style={{ width: '100%', maxWidth: '400px', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '15px' }}
            />
            <textarea
              placeholder="Description (optional)"
              value={streamDesc}
              onChange={e => setStreamDesc(e.target.value)}
              rows={2}
              style={{ width: '100%', maxWidth: '400px', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '14px', resize: 'none' }}
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
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }}>
            <div style={{ width: '50px', height: '50px', border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#ef4444', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '16px' }}>Connecting to stream...</p>
          </div>
        )}

        {/* Stream error state */}
        {streamError && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📡</div>
            <p style={{ color: '#f87171', fontWeight: 700, fontSize: '18px' }}>{streamError}</p>
            <button onClick={() => navigate('/live')} style={{ marginTop: '16px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '10px', padding: '10px 24px', cursor: 'pointer' }}>
              ← Back to Streams
            </button>
          </div>
        )}

        {/* Floating Reactions */}
        {reactions.map(r => (
          <div key={r.id} className="floating-reaction" style={{ left: `${r.left}%` }}>
            {r.emoji}
          </div>
        ))}

        {/* Host Controls */}
        {isHostMode && isLive && (
          <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '16px', background: 'rgba(0,0,0,0.6)', padding: '12px 24px', borderRadius: '16px', backdropFilter: 'blur(10px)', zIndex: 10 }}>
            <button
              onClick={toggleMute}
              style={{ background: isMuted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)', color: isMuted ? '#ef4444' : 'white', border: `1px solid ${isMuted ? '#ef4444' : 'rgba(255,255,255,0.2)'}`, borderRadius: '10px', height: '44px', width: '44px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer', transition: 'all 0.2s' }}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
            <button
              onClick={toggleVideo}
              style={{ background: isVideoOff ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)', color: isVideoOff ? '#ef4444' : 'white', border: `1px solid ${isVideoOff ? '#ef4444' : 'rgba(255,255,255,0.2)'}`, borderRadius: '10px', height: '44px', width: '44px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer', transition: 'all 0.2s' }}
              title={isVideoOff ? "Turn on camera" : "Turn off camera"}
            >
              {isVideoOff ? '🚫' : '📷'}
            </button>
            <button
              onClick={toggleScreenShare}
              style={{ background: isScreenSharing ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)', color: isScreenSharing ? '#818cf8' : 'white', border: `1px solid ${isScreenSharing ? '#6366f1' : 'rgba(255,255,255,0.2)'}`, borderRadius: '10px', height: '44px', width: '44px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer', transition: 'all 0.2s' }}
              title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
            >
              {isScreenSharing ? '💻' : '📺'}
            </button>
            <button
              onClick={endStream}
              style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', padding: '0 24px', fontWeight: 700, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(239,68,68,0.4)' }}
            >
              ⏹ End Stream
            </button>
          </div>
        )}
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
