import { createContext, useState, useEffect, useRef, useContext, useCallback } from "react";
import Peer from "simple-peer";
import { useSocketContext } from "./SocketContext";
import { useAuth } from "./AuthContext";
import { API_URL } from "../config";

const CallContext = createContext();

// Public STUN + free TURN servers for reliable NAT traversal
const ICE_SERVERS = {
      iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
            {
                  urls: 'turn:openrelay.metered.ca:80',
                  username: 'openrelayproject',
                  credential: 'openrelayproject'
            },
            {
                  urls: 'turn:openrelay.metered.ca:443',
                  username: 'openrelayproject',
                  credential: 'openrelayproject'
            }
      ]
};

export const useCallContext = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
      const { socket } = useSocketContext();
      const { user, token } = useAuth();

      const [stream, setStream] = useState(null);
      const [receivingCall, setReceivingCall] = useState(false);
      const [caller, setCaller] = useState(null);
      const [callerSignal, setCallerSignal] = useState(null);
      const [callAccepted, setCallAccepted] = useState(false);
      const [callEnded, setCallEnded] = useState(false);
      const [callType, setCallType] = useState(null); // 'voice' or 'video'
      const [isCalling, setIsCalling] = useState(false);
      const [showCallModal, setShowCallModal] = useState(null);

      // Hardware Controls
      const [isMuted, setIsMuted] = useState(false);
      const [isVideoOff, setIsVideoOff] = useState(false);

      // ── NEW: Screen Share ──
      const [isScreenSharing, setIsScreenSharing] = useState(false);
      const screenTrackRef = useRef(null);

      // ── NEW: Speaker/output toggle (mobile) ──
      const [isSpeakerOn, setIsSpeakerOn] = useState(true);

      // ── NEW: Call Toast notifications (replaces alert) ──
      const [callToast, setCallToast] = useState(null);
      const showCallToast = useCallback((msg, type = 'info') => {
            setCallToast({ msg, type });
            setTimeout(() => setCallToast(null), 4000);
      }, []);

      const myVideo = useRef();
      const userVideo = useRef();
      const connectionRef = useRef();
      const callStartTime = useRef(null);
      const targetUserIdRef = useRef(null);
      const callTimeoutRef = useRef(null);
      const pendingSignals = useRef([]);

      // Refs to avoid stale closures
      const callAcceptedRef = useRef(false);
      const isCallingRef = useRef(false);

      useEffect(() => { callAcceptedRef.current = callAccepted; }, [callAccepted]);
      useEffect(() => { isCallingRef.current = isCalling; }, [isCalling]);

      useEffect(() => {
            if (!socket) return;

            const handleCallUser = (data) => {
                  setReceivingCall(true);
                  setCaller(data.from);
                  setCallerSignal(data.signal);
                  setCallType(data.callType);
                  setShowCallModal('incoming');
                  pendingSignals.current = [];
                  const callerId = data.from?._id || data.from?.id || data.from;
                  if (callerId) targetUserIdRef.current = callerId.toString();
            };

            const handleCallAccepted = (signal) => {
                  setCallAccepted(true);
                  callAcceptedRef.current = true;
                  callStartTime.current = Date.now();
                  if (callTimeoutRef.current) {
                        clearTimeout(callTimeoutRef.current);
                        callTimeoutRef.current = null;
                  }
                  if (connectionRef.current) connectionRef.current.signal(signal);
            };

            const handleCallCancelled = () => {
                  setShowCallModal(null);
                  setReceivingCall(false);
                  setCallerSignal(null);
                  setCaller(null);
                  setCallType(null);
                  targetUserIdRef.current = null;
                  showCallToast('📵 Call was cancelled by the caller', 'info');
            };

            const handleCallEndedEvent = () => leaveCall(false);

            const handleWebrtcSignal = (signal) => {
                  if (connectionRef.current) {
                        connectionRef.current.signal(signal);
                  } else {
                        pendingSignals.current.push(signal);
                  }
            };

            socket.on("callUser", handleCallUser);
            socket.on("callAccepted", handleCallAccepted);
            socket.on("callCancelled", handleCallCancelled);
            socket.on("callEnded", handleCallEndedEvent);
            socket.on("webrtcSignal", handleWebrtcSignal);

            const handleBeforeUnload = (e) => {
                  if (isCallingRef.current || callAcceptedRef.current) {
                        e.preventDefault();
                        e.returnValue = "You have an active call. Refreshing will end the call.";
                        return e.returnValue;
                  }
            };

            const handleUnload = () => {
                  if (isCallingRef.current || callAcceptedRef.current) {
                        const otherPartyId = targetUserIdRef.current
                              || caller?._id?.toString() || caller?.id?.toString()
                              || (typeof caller === 'string' ? caller : null);
                        if (socket && otherPartyId) socket.emit("leaveCall", { to: otherPartyId });
                  }
            };

            window.addEventListener('beforeunload', handleBeforeUnload);
            window.addEventListener('unload', handleUnload);

            return () => {
                  socket.off("callUser", handleCallUser);
                  socket.off("callAccepted", handleCallAccepted);
                  socket.off("callCancelled", handleCallCancelled);
                  socket.off("callEnded", handleCallEndedEvent);
                  socket.off("webrtcSignal", handleWebrtcSignal);
                  window.removeEventListener('beforeunload', handleBeforeUnload);
                  window.removeEventListener('unload', handleUnload);
            };
      }, [socket, caller]);

      // Ringtone for incoming call
      const playRingtone = () => {
            try {
                  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                  const oscillator = audioCtx.createOscillator();
                  const gainNode = audioCtx.createGain();
                  oscillator.type = 'sine';
                  oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
                  oscillator.frequency.setValueAtTime(480, audioCtx.currentTime + 0.15);
                  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                  gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.1);
                  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
                  oscillator.connect(gainNode);
                  gainNode.connect(audioCtx.destination);
                  oscillator.start();
                  oscillator.stop(audioCtx.currentTime + 1.5);
            } catch (e) { /* blocked */ }
      };

      useEffect(() => {
            let interval;
            if (showCallModal === 'incoming') {
                  playRingtone();
                  interval = setInterval(playRingtone, 2500);
            }
            return () => { if (interval) clearInterval(interval); };
      }, [showCallModal]);

      const startCall = async (targetUserId, type, otherUserData) => {
            setCallType(type);
            setIsCalling(true);
            isCallingRef.current = true;
            setCaller(otherUserData);
            targetUserIdRef.current = targetUserId?.toString();
            setShowCallModal('calling');
            pendingSignals.current = [];

            try {
                  const mediaConstraints = {
                        video: type === 'video' ? {
                              facingMode: 'user',
                              width: { ideal: 1280, max: 1920 },
                              height: { ideal: 720, max: 1080 },
                              frameRate: { ideal: 30, max: 60 }
                        } : false,
                        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
                  };

                  const mediaStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
                  setStream(mediaStream);
                  if (myVideo.current) myVideo.current.srcObject = mediaStream;

                  const peer = new Peer({
                        initiator: true,
                        trickle: true,
                        stream: mediaStream,
                        config: ICE_SERVERS
                  });

                  let isFirstSignal = true;
                  peer.on("signal", (data) => {
                        if (isFirstSignal) {
                              socket.emit("callUser", {
                                    userToCall: targetUserId,
                                    signalData: data,
                                    from: user,
                                    callType: type
                              });
                              isFirstSignal = false;
                        } else {
                              socket.emit("webrtcSignal", { to: targetUserId, signal: data });
                        }
                  });

                  peer.on("stream", (remoteStream) => {
                        if (userVideo.current) userVideo.current.srcObject = remoteStream;
                  });

                  peer.on("error", (err) => {
                        console.error("Peer error:", err);
                        showCallToast('⚠️ Call connection failed. Please try again.', 'error');
                        leaveCall(true);
                  });

                  peer.on("close", () => { leaveCall(false); });

                  connectionRef.current = peer;

                  // Auto-cancel after 30s if unanswered
                  callTimeoutRef.current = setTimeout(() => {
                        if (!callAcceptedRef.current) {
                              showCallToast('📵 No answer — call timed out', 'info');
                              leaveCall(true);
                        }
                  }, 30000);

            } catch (err) {
                  console.error('Failed to get local stream:', err);
                  setIsCalling(false);
                  isCallingRef.current = false;
                  setShowCallModal(null);
                  targetUserIdRef.current = null;
                  // Friendly toast instead of alert
                  if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                        showCallToast('🎙️ No microphone/camera found. Please connect a device.', 'error');
                  } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                        showCallToast('🔒 Camera/microphone access denied. Please allow permissions in your browser.', 'error');
                  } else {
                        showCallToast('⚠️ Could not start call. Check your camera/mic permissions.', 'error');
                  }
            }
      };

      const answerCall = async () => {
            setShowCallModal(null);
            setCallAccepted(true);
            callAcceptedRef.current = true;
            callStartTime.current = Date.now();

            try {
                  const mediaConstraints = {
                        video: callType === 'video' ? {
                              facingMode: 'user',
                              width: { ideal: 1280, max: 1920 },
                              height: { ideal: 720, max: 1080 },
                              frameRate: { ideal: 30, max: 60 }
                        } : false,
                        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
                  };

                  const mediaStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
                  setStream(mediaStream);
                  if (myVideo.current) myVideo.current.srcObject = mediaStream;

                  const peer = new Peer({
                        initiator: false,
                        trickle: true,
                        stream: mediaStream,
                        config: ICE_SERVERS
                  });

                  const callerId = targetUserIdRef.current
                        || caller?._id || caller?.id
                        || (typeof caller === 'string' ? caller : null);

                  let isFirstSignal = true;
                  peer.on("signal", (data) => {
                        if (isFirstSignal) {
                              socket.emit("answerCall", { signal: data, to: callerId });
                              isFirstSignal = false;
                        } else {
                              socket.emit("webrtcSignal", { signal: data, to: callerId });
                        }
                  });

                  peer.on("stream", (remoteStream) => {
                        if (userVideo.current) userVideo.current.srcObject = remoteStream;
                  });

                  peer.on("error", (err) => {
                        console.error("Peer error:", err);
                        showCallToast('⚠️ Call connection lost. Please try again.', 'error');
                        leaveCall(false);
                  });

                  peer.on("close", () => { leaveCall(false); });

                  peer.signal(callerSignal);
                  pendingSignals.current.forEach(sig => peer.signal(sig));
                  pendingSignals.current = [];
                  connectionRef.current = peer;

            } catch (err) {
                  console.error('Failed to answer call:', err);
                  setCallAccepted(false);
                  callAcceptedRef.current = false;
                  setReceivingCall(false);
                  setShowCallModal(null);

                  const callerId = targetUserIdRef.current
                        || caller?._id || caller?.id
                        || (typeof caller === 'string' ? caller : null);
                  if (socket && callerId) socket.emit("cancelCall", { to: callerId });

                  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                        showCallToast('🔒 Camera/microphone access denied. Cannot answer call.', 'error');
                  } else {
                        showCallToast('⚠️ Could not answer call. Check your camera/mic permissions.', 'error');
                  }
            }
      };

      const toggleMute = () => {
            if (stream) {
                  const audioTrack = stream.getAudioTracks()[0];
                  if (audioTrack) {
                        audioTrack.enabled = !audioTrack.enabled;
                        setIsMuted(!audioTrack.enabled);
                  }
            }
      };

      const toggleVideo = () => {
            if (stream) {
                  const videoTrack = stream.getVideoTracks()[0];
                  if (videoTrack) {
                        videoTrack.enabled = !videoTrack.enabled;
                        setIsVideoOff(!videoTrack.enabled);
                  }
            }
      };

      // ── NEW: Screen Share ──
      const startScreenShare = async () => {
            try {
                  const screenStream = await navigator.mediaDevices.getDisplayMedia({
                        video: { cursor: 'always' },
                        audio: false
                  });
                  const screenTrack = screenStream.getVideoTracks()[0];
                  screenTrackRef.current = screenTrack;

                  // Replace video track in peer connection
                  if (connectionRef.current) {
                        const sender = connectionRef.current._pc?.getSenders?.().find(s => s.track?.kind === 'video');
                        if (sender) await sender.replaceTrack(screenTrack);
                  }

                  // Replace local video preview
                  if (myVideo.current) {
                        const newStream = new MediaStream([screenTrack, ...stream.getAudioTracks()]);
                        myVideo.current.srcObject = newStream;
                  }

                  setIsScreenSharing(true);

                  // Auto-stop when user clicks "Stop sharing" in browser UI
                  screenTrack.onended = () => stopScreenShare();
            } catch (err) {
                  if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                        showCallToast('⚠️ Screen share failed. Please try again.', 'error');
                  }
            }
      };

      const stopScreenShare = async () => {
            if (screenTrackRef.current) screenTrackRef.current.stop();

            // Restore camera track
            if (stream && connectionRef.current) {
                  const cameraTrack = stream.getVideoTracks()[0];
                  if (cameraTrack) {
                        const sender = connectionRef.current._pc?.getSenders?.().find(s => s.track?.kind === 'video');
                        if (sender) await sender.replaceTrack(cameraTrack);
                  }
                  if (myVideo.current) myVideo.current.srcObject = stream;
            }

            setIsScreenSharing(false);
            screenTrackRef.current = null;
      };

      // ── NEW: Speaker toggle (mobile) ──
      const toggleSpeaker = async () => {
            const newSpeaker = !isSpeakerOn;
            setIsSpeakerOn(newSpeaker);
            // For mobile browsers that support setSinkId on audio elements
            if (userVideo.current && userVideo.current.setSinkId) {
                  try {
                        const devices = await navigator.mediaDevices.enumerateDevices();
                        const speaker = devices.find(d => d.kind === 'audiooutput' && (newSpeaker ? d.label.toLowerCase().includes('speaker') : d.label.toLowerCase().includes('ear')));
                        if (speaker) await userVideo.current.setSinkId(speaker.deviceId);
                  } catch (e) { /* not supported on this device */ }
            }
      };

      const leaveCall = async (emitEvent = true) => {
            if (callTimeoutRef.current) {
                  clearTimeout(callTimeoutRef.current);
                  callTimeoutRef.current = null;
            }

            // Stop screen share cleanly
            if (screenTrackRef.current) {
                  screenTrackRef.current.stop();
                  screenTrackRef.current = null;
            }
            setIsScreenSharing(false);

            const otherPartyId = targetUserIdRef.current
                  || caller?._id?.toString() || caller?.id?.toString()
                  || (typeof caller === 'string' ? caller : null);

            if (emitEvent && socket && otherPartyId) {
                  if (isCallingRef.current && !callAcceptedRef.current) {
                        socket.emit("cancelCall", { to: otherPartyId });
                  } else {
                        socket.emit("leaveCall", { to: otherPartyId });
                  }
            }

            // Log call duration to chat if the caller initiated it
            if (isCallingRef.current && otherPartyId) {
                  let callLogMessage = '';
                  const typeLabel = callType === 'video' ? '📹 Video' : '📞 Voice';
                  if (callAcceptedRef.current && callStartTime.current) {
                        const durationSeconds = Math.floor((Date.now() - callStartTime.current) / 1000);
                        const mins = Math.floor(durationSeconds / 60);
                        const secs = durationSeconds % 60;
                        const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                        callLogMessage = `${typeLabel} Call • ${durationStr}`;
                  } else {
                        callLogMessage = `❌ Missed ${typeLabel} Call`;
                  }

                  try {
                        await fetch(`${API_URL}/messages/${otherPartyId}`, {
                              method: 'POST',
                              headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                              },
                              body: JSON.stringify({ text: callLogMessage })
                        });
                  } catch (err) {
                        console.error('Failed to save call log:', err);
                  }
            }

            // Cleanup state
            setCallEnded(true);
            setIsCalling(false);
            isCallingRef.current = false;
            setReceivingCall(false);
            setCallAccepted(false);
            callAcceptedRef.current = false;
            setShowCallModal(null);
            pendingSignals.current = [];

            if (connectionRef.current) {
                  connectionRef.current.destroy();
                  connectionRef.current = null;
            }

            // Always stop ALL tracks cleanly
            if (stream) {
                  stream.getTracks().forEach(track => track.stop());
                  setStream(null);
            }

            setTimeout(() => {
                  setCallEnded(false);
                  setCallType(null);
                  setCaller(null);
                  setCallerSignal(null);
                  setIsMuted(false);
                  setIsVideoOff(false);
                  setIsSpeakerOn(true);
                  callStartTime.current = null;
                  targetUserIdRef.current = null;
            }, 800);
      };

      const rejectCall = () => {
            const callerId = targetUserIdRef.current
                  || caller?._id?.toString() || caller?.id?.toString()
                  || (typeof caller === 'string' ? caller : null);

            if (socket && callerId) socket.emit('cancelCall', { to: callerId });

            setShowCallModal(null);
            setReceivingCall(false);
            setCallerSignal(null);
            setCaller(null);
            setCallType(null);
            targetUserIdRef.current = null;
      };

      return (
            <CallContext.Provider value={{
                  stream, setStream, myVideo, userVideo,
                  receivingCall, caller, callerSignal,
                  callAccepted, callEnded, callType,
                  isCalling, showCallModal, setShowCallModal,
                  isMuted, isVideoOff,
                  isScreenSharing, isSpeakerOn,
                  callToast,
                  startCall, answerCall, leaveCall, rejectCall,
                  toggleMute, toggleVideo,
                  startScreenShare, stopScreenShare,
                  toggleSpeaker
            }}>
                  {children}
            </CallContext.Provider>
      );
};
