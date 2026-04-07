import { useRef, useEffect, useState } from 'react';
import Peer from 'simple-peer';
import { useSocketContext } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

/* ──────────────────────────────────────────
   GROUP CALL OVERLAY — Mesh WebRTC (max 4)
   Appears over app when a group call is active
────────────────────────────────────────── */
const GroupCallOverlay = ({ groupId, groupName, participants, callType, onEnd }) => {
  const { socket } = useSocketContext();
  const { user } = useAuth();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { userId: MediaStream }
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType !== 'video');
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const peersRef = useRef({}); // { userId: Peer }
  const localVideoRef = useRef(null);
  const timerRef = useRef(null);

  /* ── Start local media ── */
  useEffect(() => {
    const constraints = callType === 'video'
      ? { video: { facingMode: 'user' }, audio: true }
      : { audio: true, video: false };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      })
      .catch(() => toast.error('Could not access camera/microphone'));

    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => {
      clearInterval(timerRef.current);
    };
  }, [callType]);

  /* ── Call each participant when stream is ready ── */
  useEffect(() => {
    if (!localStream || !socket || !participants?.length) return;

    // Call up to 3 other participants (max 4 total in mesh)
    const others = participants
      .filter(p => (p._id || p) !== (user?._id || user?.id))
      .slice(0, 3);

    others.forEach(participant => {
      const targetId = participant._id || participant;
      const peer = new Peer({ initiator: true, trickle: true, stream: localStream });

      peer.on('signal', signal => {
        socket.emit('groupCallUser', {
          targetUserId: targetId,
          groupId,
          from: user._id,
          callType,
          signalData: signal
        });
      });

      peer.on('stream', remoteStream => {
        setRemoteStreams(prev => ({ ...prev, [targetId]: remoteStream }));
      });

      peer.on('close', () => {
        setRemoteStreams(prev => { const n = { ...prev }; delete n[targetId]; return n; });
      });

      peersRef.current[targetId] = peer;
    });

    return () => {
      Object.values(peersRef.current).forEach(p => p.destroy());
      peersRef.current = {};
    };
  }, [localStream, participants, socket, groupId, user, callType]);

  /* ── Answer incoming peer signals ── */
  useEffect(() => {
    if (!socket || !localStream) return;

    const handleIncoming = ({ signal, from, groupId: gId }) => {
      if (gId !== groupId) return;
      if (peersRef.current[from]) {
        peersRef.current[from].signal(signal);
        return;
      }
      // New peer joining
      const peer = new Peer({ initiator: false, trickle: true, stream: localStream });
      peer.on('signal', answerSignal => {
        socket.emit('groupCallAnswer', { to: from, signal: answerSignal, from: user._id, groupId });
      });
      peer.on('stream', remoteStream => {
        setRemoteStreams(prev => ({ ...prev, [from]: remoteStream }));
      });
      peer.on('close', () => {
        setRemoteStreams(prev => { const n = { ...prev }; delete n[from]; return n; });
      });
      peer.signal(signal);
      peersRef.current[from] = peer;
    };

    const handleAccepted = ({ signal, from, groupId: gId }) => {
      if (gId !== groupId) return;
      if (peersRef.current[from]) peersRef.current[from].signal(signal);
    };

    const handleLeft = ({ userId: leftId, groupId: gId }) => {
      if (gId !== groupId) return;
      peersRef.current[leftId]?.destroy();
      delete peersRef.current[leftId];
      setRemoteStreams(prev => { const n = { ...prev }; delete n[leftId]; return n; });
    };

    socket.on('groupCallIncoming', handleIncoming);
    socket.on('groupCallAccepted', handleAccepted);
    socket.on('groupCallParticipantLeft', handleLeft);

    return () => {
      socket.off('groupCallIncoming', handleIncoming);
      socket.off('groupCallAccepted', handleAccepted);
      socket.off('groupCallParticipantLeft', handleLeft);
    };
  }, [socket, localStream, groupId, user]);

  /* ── Controls ── */
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => { t.enabled = isMuted; });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => { t.enabled = isVideoOff; });
      setIsVideoOff(!isVideoOff);
    }
  };

  const leaveCall = () => {
    localStream?.getTracks().forEach(t => t.stop());
    Object.values(peersRef.current).forEach(p => p.destroy());
    peersRef.current = {};
    const otherIds = participants.filter(p => (p._id || p) !== (user?._id || user?.id)).map(p => p._id || p);
    socket?.emit('groupCallLeft', { groupId, participants: otherIds });
    onEnd?.();
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const remoteEntries = Object.entries(remoteStreams);
  const totalVideos = 1 + remoteEntries.length; // local + remotes
  const gridCols = totalVideos <= 1 ? 1 : totalVideos <= 2 ? 2 : totalVideos <= 4 ? 2 : 2;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0a0a14', display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '16px', color: 'white' }}>📞 {groupName || 'Group Call'}</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
            {totalVideos} participant{totalVideos !== 1 ? 's' : ''} • {formatDuration(callDuration)}
          </div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
          {callType === 'video' ? '🎥 Video' : '🎙 Voice'}
        </div>
      </div>

      {/* Video Grid */}
      <div style={{
        flex: 1, display: 'grid', gap: '4px', padding: '8px',
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        alignContent: 'center'
      }}>
        {/* Local Video */}
        <div style={{ position: 'relative', background: '#1a1a2e', borderRadius: '12px', overflow: 'hidden', minHeight: '200px' }}>
          {callType === 'video'
            ? <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: isVideoOff ? 'none' : 'block' }} />
            : null
          }
          {(callType !== 'video' || isVideoOff) && (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: 'white', fontWeight: 700 }}>
                {user?.displayName?.charAt(0) || user?.username?.charAt(0) || '?'}
              </div>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', borderRadius: '6px', padding: '3px 8px', fontSize: '12px', color: 'white', fontWeight: 600 }}>
            You {isMuted ? '🔇' : ''}
          </div>
        </div>

        {/* Remote Videos */}
        {remoteEntries.map(([uid, stream]) => {
          const participant = participants?.find(p => (p._id || p) === uid);
          return (
            <RemoteVideo key={uid} stream={stream} participant={participant} />
          );
        })}

        {/* Empty slots (show waiting state for pending participants) */}
        {remoteEntries.length === 0 && (
          <div style={{ background: '#1a1a2e', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>Waiting for others to join...</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding: '20px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <CallBtn onClick={toggleMute} active={isMuted} label={isMuted ? 'Unmute' : 'Mute'} icon={isMuted ? '🔇' : '🎙'} color={isMuted ? '#374151' : 'rgba(255,255,255,0.15)'} />
        {callType === 'video' && (
          <CallBtn onClick={toggleVideo} active={isVideoOff} label={isVideoOff ? 'Cam On' : 'Cam Off'} icon={isVideoOff ? '📷' : '🎥'} color={isVideoOff ? '#374151' : 'rgba(255,255,255,0.15)'} />
        )}
        <CallBtn onClick={leaveCall} label="Leave" icon="📵" color="#ef4444" large />
      </div>
    </div>
  );
};

const RemoteVideo = ({ stream, participant }) => {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);
  const name = participant?.displayName || participant?.username || 'Participant';
  return (
    <div style={{ position: 'relative', background: '#1a1a2e', borderRadius: '12px', overflow: 'hidden', minHeight: '200px' }}>
      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', borderRadius: '6px', padding: '3px 8px', fontSize: '12px', color: 'white', fontWeight: 600 }}>
        {name}
      </div>
    </div>
  );
};

const CallBtn = ({ onClick, label, icon, color, large, active }) => (
  <button
    onClick={onClick}
    style={{
      background: color || 'rgba(255,255,255,0.15)',
      border: 'none', borderRadius: large ? '50%' : '14px',
      width: large ? '64px' : '56px', height: large ? '64px' : '56px',
      cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '2px', transition: 'transform 0.15s, opacity 0.2s',
      transform: 'scale(1)'
    }}
    title={label}
    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.08)'}
    onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
  >
    <span style={{ fontSize: large ? '24px' : '20px' }}>{icon}</span>
    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{label}</span>
  </button>
);

export default GroupCallOverlay;
