import { useCallback, useEffect, useRef, useState } from 'react';
import { closePeer, createPeerConnection, getLocalStream, stopStream } from '../utils/webrtc';

export const useCall = ({ socket, user }) => {
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const peerRef = useRef(null);
  const timeoutRef = useRef(null);

  const cleanup = useCallback(() => {
    clearTimeout(timeoutRef.current);
    closePeer(peerRef.current);
    peerRef.current = null;
    stopStream(localStream);
    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
    setActiveCall(null);
    setMuted(false);
    setCameraOff(false);
  }, [localStream]);

  const buildPeer = useCallback((peerId) => createPeerConnection({
    onIceCandidate: (candidate) => socket?.emit('ice-candidate', { to: peerId, candidate }),
    onTrack: setRemoteStream,
    onConnectionFailed: () => socket?.emit('ice-candidate', { to: peerId, restart: true })
  }), [socket]);

  const startCall = useCallback(async (to, callType = 'video') => {
    try {
      const stream = await getLocalStream(callType === 'video');
      setLocalStream(stream);
      const peer = buildPeer(to);
      peerRef.current = peer;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('call-user', { to, offer, callType, caller: user });
      setActiveCall({ peerId: to, callType, state: 'calling' });
      timeoutRef.current = setTimeout(() => {
        socket.emit('call-rejected', { to, reason: 'timeout' });
        cleanup();
      }, 30000);
    } catch (error) {
      cleanup();
      throw error;
    }
  }, [buildPeer, cleanup, socket, user]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    try {
      const stream = await getLocalStream(incomingCall.callType === 'video');
      setLocalStream(stream);
      const peer = buildPeer(incomingCall.from);
      peerRef.current = peer;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('call-accepted', { to: incomingCall.from, answer });
      setActiveCall({ peerId: incomingCall.from, callType: incomingCall.callType, state: 'active' });
      setIncomingCall(null);
    } catch (error) {
      cleanup();
      throw error;
    }
  }, [buildPeer, cleanup, incomingCall, socket]);

  const rejectCall = useCallback(() => {
    if (incomingCall) socket?.emit('call-rejected', { to: incomingCall.from });
    cleanup();
  }, [cleanup, incomingCall, socket]);

  const endCall = useCallback(() => {
    if (activeCall?.peerId) socket?.emit('call-ended', { to: activeCall.peerId });
    cleanup();
  }, [activeCall, cleanup, socket]);

  const toggleMute = useCallback(() => {
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = muted;
    });
    setMuted((value) => !value);
  }, [localStream, muted]);

  const toggleCamera = useCallback(() => {
    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = cameraOff;
    });
    setCameraOff((value) => !value);
  }, [cameraOff, localStream]);

  useEffect(() => {
    if (!socket) return undefined;

    const onIncoming = (payload) => {
      setIncomingCall(payload);
      timeoutRef.current = setTimeout(() => rejectCall(), 30000);
    };
    const onAccepted = async ({ answer }) => {
      try {
        clearTimeout(timeoutRef.current);
        await peerRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
        setActiveCall((call) => call ? { ...call, state: 'active' } : call);
      } catch (error) {
        cleanup();
      }
    };
    const onIce = async ({ candidate }) => {
      try {
        if (candidate) await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Failed to add ICE candidate', error);
      }
    };

    socket.on('incoming-call', onIncoming);
    socket.on('call-accepted', onAccepted);
    socket.on('ice-candidate', onIce);
    socket.on('call-rejected', cleanup);
    socket.on('call-ended', cleanup);

    return () => {
      socket.off('incoming-call', onIncoming);
      socket.off('call-accepted', onAccepted);
      socket.off('ice-candidate', onIce);
      socket.off('call-rejected', cleanup);
      socket.off('call-ended', cleanup);
    };
  }, [cleanup, rejectCall, socket]);

  return {
    incomingCall,
    activeCall,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera
  };
};

export default useCall;
