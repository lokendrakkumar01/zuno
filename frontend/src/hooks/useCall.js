/**
 * useCall.js — FIX: PROBLEM 2 (Calling broken/slow)
 *
 * Complete WebRTC call lifecycle:
 *  startCall   → emits callUser         → receiver gets incoming-call
 *  acceptCall  → emits acceptCall        → caller gets call-accepted
 *  rejectCall  → emits rejectCall        → caller gets call-rejected
 *  endCall     → emits endCall           → peer gets call-ended
 *  ICE trickle → emits iceCandidate      → peer gets ice-candidate
 *
 * Other fixes:
 *  - createPeerConnection is done AFTER getUserMedia (correct order)
 *  - ICE candidates gathered via onicecandidate and sent incrementally
 *  - Remote description set before createAnswer (was failing before)
 *  - 30 s auto-cancel if no answer
 *  - Proper cleanup (stop all tracks, close peer) on every exit path
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── WebRTC config ────────────────────────────────────────────────────────────

const ICE_SERVERS = {
  iceServers: [
    // Public STUN (free, no credential needed)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Free TURN relay (openrelay — good for demos; use Metered/Twilio in prod)
    { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  iceCandidatePoolSize: 10,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stopStream = (stream) => {
  if (!stream) return;
  stream.getTracks().forEach((t) => { try { t.stop(); } catch {} });
};

const closePeer = (pc) => {
  if (!pc) return;
  try { pc.close(); } catch {}
};

/** Safe getUserMedia — falls back to audio-only if camera unavailable */
const getUserMedia = async (withVideo = true) => {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: withVideo ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
  } catch (err) {
    if (withVideo && err.name !== 'NotAllowedError') {
      // Camera unavailable — retry with audio only
      return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
    throw err;
  }
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useCall = ({ socket, user }) => {
  const [incomingCall, setIncomingCall] = useState(null);   // { from, signal, callType, caller }
  const [activeCall,   setActiveCall]   = useState(null);   // { peerId, callType, state }
  const [localStream,  setLocalStream]  = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted,        setMuted]        = useState(false);
  const [cameraOff,    setCameraOff]    = useState(false);
  const [callError,    setCallError]    = useState('');

  const peerRef     = useRef(null);   // RTCPeerConnection
  const timeoutRef  = useRef(null);
  const streamRef   = useRef(null);   // keep ref in sync for cleanup

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    clearTimeout(timeoutRef.current);
    closePeer(peerRef.current);
    peerRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
    setActiveCall(null);
    setMuted(false);
    setCameraOff(false);
  }, []);

  // ── Create RTCPeerConnection ───────────────────────────────────────────────

  const createPeer = useCallback((peerId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // ICE trickle — send each candidate as it's gathered
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socket?.connected) {
        socket.emit('iceCandidate', { to: peerId, candidate });
      }
    };

    // When remote track arrives, set remoteStream
    pc.ontrack = ({ streams }) => {
      if (streams[0]) setRemoteStream(streams[0]);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setCallError('Connection dropped. Please try again.');
        cleanup();
      }
    };

    return pc;
  }, [cleanup, socket]);

  // ── Start outgoing call — FIX PROBLEM 2 ───────────────────────────────────

  const startCall = useCallback(async (to, callType = 'video') => {
    if (!socket?.connected) {
      setCallError('Not connected to server. Please wait and retry.');
      return;
    }

    setCallError('');

    try {
      const stream = await getUserMedia(callType === 'video');
      streamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeer(to);
      peerRef.current = pc;

      // Add all tracks before creating offer
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      // FIX PROBLEM 2: emit callUser with SDP offer
      socket.emit('callUser', {
        userToCall: to,
        signalData: pc.localDescription,
        callType,
        from: user,
      });

      setActiveCall({ peerId: to, callType, state: 'calling' });

      // Auto-cancel after 30 s
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        socket.emit('rejectCall', { to, reason: 'timeout' });
        setCallError('No answer.');
        cleanup();
      }, 30_000);

    } catch (err) {
      setCallError(err.message || 'Could not start call');
      cleanup();
    }
  }, [cleanup, createPeer, socket, user]);

  // ── Accept incoming call — FIX PROBLEM 2 ──────────────────────────────────

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    clearTimeout(timeoutRef.current);
    setCallError('');

    try {
      const stream = await getUserMedia(incomingCall.callType === 'video');
      streamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeer(incomingCall.from);
      peerRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // FIX PROBLEM 2: set remote description FIRST, then create answer
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('acceptCall', {
        to:     incomingCall.from,
        signal: pc.localDescription,
      });

      setActiveCall({ peerId: incomingCall.from, callType: incomingCall.callType, state: 'active' });
      setIncomingCall(null);

    } catch (err) {
      setCallError(err.message || 'Could not answer call');
      cleanup();
    }
  }, [cleanup, createPeer, incomingCall, socket]);

  // ── Reject / End ───────────────────────────────────────────────────────────

  const rejectCall = useCallback(() => {
    if (incomingCall) {
      socket?.emit('rejectCall', { to: incomingCall.from, reason: 'rejected' });
    }
    cleanup();
  }, [cleanup, incomingCall, socket]);

  const endCall = useCallback(() => {
    if (activeCall?.peerId) {
      socket?.emit('endCall', { to: activeCall.peerId });
    }
    cleanup();
  }, [activeCall, cleanup, socket]);

  // ── Media controls ─────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = muted; });
    setMuted((v) => !v);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = cameraOff; });
    setCameraOff((v) => !v);
  }, [cameraOff]);

  // ── Socket event listeners — FIX PROBLEM 2 ────────────────────────────────

  useEffect(() => {
    if (!socket) return undefined;

    /** Receiver: incoming call from caller */
    const onIncoming = (payload) => {
      // payload = { from, signal (SDP offer), callType, caller }
      setIncomingCall(payload);
      clearTimeout(timeoutRef.current);
      // Auto-reject after 30 s if user ignores
      timeoutRef.current = setTimeout(() => {
        socket.emit('rejectCall', { to: payload.from, reason: 'timeout' });
        setIncomingCall(null);
      }, 30_000);
    };

    /** Caller: receiver accepted — set remote description */
    const onAccepted = async ({ signal }) => {
      clearTimeout(timeoutRef.current);
      try {
        if (peerRef.current && signal) {
          await peerRef.current.setRemoteDescription(
            new RTCSessionDescription(signal)
          );
        }
        setActiveCall((c) => c ? { ...c, state: 'active' } : c);
      } catch (err) {
        setCallError('Failed to complete connection: ' + err.message);
        cleanup();
      }
    };

    /** ICE candidate from peer — add to local peer connection */
    const onIce = async ({ candidate }) => {
      try {
        if (candidate && peerRef.current?.remoteDescription) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch {
        // ignore stale candidates
      }
    };

    const onRejected = () => {
      setCallError('Call was declined.');
      cleanup();
    };

    const onEnded = () => {
      cleanup();
    };

    // Subscribe — cover all event name variants from the backend
    socket.on('incoming-call',  onIncoming);
    socket.on('callUser',       onIncoming);   // legacy

    socket.on('call-accepted',  onAccepted);
    socket.on('callAccepted',   onAccepted);

    socket.on('ice-candidate',  onIce);
    socket.on('webrtcSignal',   onIce);        // legacy alias

    socket.on('call-rejected',  onRejected);
    socket.on('callCancelled',  onRejected);

    socket.on('call-ended',     onEnded);
    socket.on('callEnded',      onEnded);

    return () => {
      socket.off('incoming-call',  onIncoming);
      socket.off('callUser',       onIncoming);
      socket.off('call-accepted',  onAccepted);
      socket.off('callAccepted',   onAccepted);
      socket.off('ice-candidate',  onIce);
      socket.off('webrtcSignal',   onIce);
      socket.off('call-rejected',  onRejected);
      socket.off('callCancelled',  onRejected);
      socket.off('call-ended',     onEnded);
      socket.off('callEnded',      onEnded);
      clearTimeout(timeoutRef.current);
    };
  }, [cleanup, socket]);

  return {
    incomingCall,
    activeCall,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    callError,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
};

export default useCall;
