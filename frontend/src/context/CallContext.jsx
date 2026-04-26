import { createContext, useState, useEffect, useRef, useContext, useCallback } from "react";
import Peer from "simple-peer";
import { useSocketContext } from "./SocketContext";
import { useAuth } from "./AuthContext";
import { API_URL } from "../config";
import GroupCallOverlay from "../components/GroupCallOverlay";

// Detect if running on Android (Capacitor app or Android browser)
const isAndroid = () => {
      try {
            if (window.Capacitor || window.cordova) return true;
            const ua = navigator.userAgent || '';
            return /android/i.test(ua);
      } catch {
            return false;
      }
};

// Detect if screen share is supported
const supportsScreenShare = () => {
      if (isAndroid()) return false;
      return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
};

const CallContext = createContext();
const ACTIVE_CALL_SESSION_KEY = 'zuno_active_call_session_v1';
const ACTIVE_CALL_MAX_RESUME_AGE_MS = 20000;

const readPersistedCallSession = () => {
      try {
            const raw = window.sessionStorage.getItem(ACTIVE_CALL_SESSION_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed?.targetUserId ? parsed : null;
      } catch {
            return null;
      }
};

const persistCallSession = (session) => {
      try {
            window.sessionStorage.setItem(
                  ACTIVE_CALL_SESSION_KEY,
                  JSON.stringify({
                        ...session,
                        updatedAt: Date.now()
                  })
            );
      } catch {
            // Session persistence is optional.
      }
};

const clearPersistedCallSession = () => {
      try {
            window.sessionStorage.removeItem(ACTIVE_CALL_SESSION_KEY);
      } catch {
            // Ignore storage failures.
      }
};

// Load ICE servers from environment or use reliable fallbacks
const getIceServers = () => {
  // Try to load from environment first
  if (process.env.REACT_APP_TURN_SERVERS) {
    try {
      const envServers = JSON.parse(process.env.REACT_APP_TURN_SERVERS);
      if (Array.isArray(envServers) && envServers.length > 0) {
        return {
          iceServers: envServers,
          iceTransportPolicy: 'all',
          iceCandidatePoolSize: 10,
          rtcpMuxPolicy: 'require',
          bundlePolicy: 'max-bundle'
        };
      }
    } catch (e) {
      console.warn('Invalid REACT_APP_TURN_SERVERS format, using fallbacks');
    }
  }

  // Reliable fallback configuration
  return {
    iceServers: [
      // Public STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      
      // Free TURN servers (remove invalid/fake ones)
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
    ],
    iceTransportPolicy: 'all',
    iceCandidatePoolSize: 10,
    rtcpMuxPolicy: 'require',
    bundlePolicy: 'max-bundle'
  };
};

const ICE_SERVERS = getIceServers();

export const useCallContext = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
      const { socket, isConnected } = useSocketContext();
      const { user, token } = useAuth();

      const [stream, setStream] = useState(null);
      const [remoteStream, setRemoteStream] = useState(null);
      const [receivingCall, setReceivingCall] = useState(false);
      const [caller, setCaller] = useState(null);
      const [callerSignal, setCallerSignal] = useState(null);
      const [callAccepted, setCallAccepted] = useState(false);
      const [callEnded, setCallEnded] = useState(false);
      const [callType, setCallType] = useState(null); // 'voice' or 'video'
      const [isCalling, setIsCalling] = useState(false);
      const [showCallModal, setShowCallModal] = useState(null);

      // Group Call State
      const [activeGroupCall, setActiveGroupCall] = useState(null); // { groupId, groupName, participants, callType }
  const [incomingGroupCall, setIncomingGroupCall] = useState(null); // { signal, from, groupId, callType, groupName, participants }

      // Hardware Controls
      const [isMuted, setIsMuted] = useState(false);
      const [isVideoOff, setIsVideoOff] = useState(false);

      // Screen Share
      const [isScreenSharing, setIsScreenSharing] = useState(false);
      const screenTrackRef = useRef(null);

      // Speaker/output toggle
      const [isSpeakerOn, setIsSpeakerOn] = useState(true);

      // Camera facing mode (for mobile flip)
      const [facingMode, setFacingMode] = useState('user'); // 'user' = front, 'environment' = back

      // Toast notifications (replaces alert)
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
      const pageUnloadRef = useRef(false);
      const restoredSessionRef = useRef(false);

      // Refs to avoid stale closures in event handlers
      const callAcceptedRef = useRef(false);
      const isCallingRef = useRef(false);
      const callerRef = useRef(null);

      useEffect(() => { callAcceptedRef.current = callAccepted; }, [callAccepted]);
      useEffect(() => { isCallingRef.current = isCalling; }, [isCalling]);
      useEffect(() => { callerRef.current = caller; }, [caller]);

      useEffect(() => {
            pageUnloadRef.current = false;
      }, []);

      useEffect(() => {
            if (!user?._id || (!isCalling && !callAccepted) || !callType) return;

            const otherPartyId = targetUserIdRef.current
                  || callerRef.current?._id?.toString()
                  || callerRef.current?.id?.toString()
                  || (typeof callerRef.current === 'string' ? callerRef.current : null);

            if (!otherPartyId) return;

            const otherUser = typeof callerRef.current === 'string' || !callerRef.current
                  ? { _id: otherPartyId }
                  : {
                        _id: callerRef.current._id || callerRef.current.id || otherPartyId,
                        username: callerRef.current.username,
                        displayName: callerRef.current.displayName,
                        avatar: callerRef.current.avatar
                  };

            persistCallSession({
                  ownerUserId: user._id,
                  targetUserId: otherPartyId,
                  callType,
                  otherUser,
                  direction: isCalling ? 'outgoing' : 'incoming'
            });
      }, [callAccepted, callType, isCalling, user?._id, caller]);

      useEffect(() => {
            if (!socket || !user?._id || restoredSessionRef.current || isCalling || callAccepted || receivingCall) return;

            const persisted = readPersistedCallSession();
            if (!persisted) return;

            if (persisted.ownerUserId !== user._id) {
                  clearPersistedCallSession();
                  return;
            }

            if (Date.now() - (persisted.updatedAt || 0) > ACTIVE_CALL_MAX_RESUME_AGE_MS) {
                  clearPersistedCallSession();
                  return;
            }

            restoredSessionRef.current = true;

            const timer = window.setTimeout(() => {
                  showCallToast('Reconnecting your last call...', 'info');
                  startCall(
                        persisted.targetUserId,
                        persisted.callType || 'voice',
                        persisted.otherUser || { _id: persisted.targetUserId },
                        { resume: true }
                  );
            }, 900);

            return () => window.clearTimeout(timer);
            // startCall is intentionally omitted to avoid reconnect loops while state is being restored.
            // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [socket, user?._id, isCalling, callAccepted, receivingCall, showCallToast]);

      useEffect(() => {
            if (!socket) return;

            const handleCallUser = (data) => {
                  setReceivingCall(true);
                  setCaller(data.from);
                  callerRef.current = data.from;
                  setCallerSignal(data.signal);
                  setCallType(data.callType);
                  setShowCallModal('incoming');
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
                  // Signal the peer with the answer
                  if (connectionRef.current) {
                        try { connectionRef.current.signal(signal); } catch (e) { console.error('Signal error:', e); }
                  }
            };

            const handleCallCancelled = () => {
                  clearPersistedCallSession();
                  restoredSessionRef.current = false;
                  setShowCallModal(null);
                  setReceivingCall(false);
                  setCallerSignal(null);
                  setCaller(null);
                  setCallType(null);
                  targetUserIdRef.current = null;
                  showCallToast('📵 Call was cancelled', 'info');
            };

            const handleGroupCallIncoming = (data) => {
                  // data: { signal, from, groupId, callType }
                  // Only accept if not already in a call, otherwise automatically ignore (busy)
                  if (activeGroupCall || isCallingRef.current || callAcceptedRef.current) return;
                  
                  // Store incoming call info to show UI
                  setIncomingGroupCall(data);
                  setShowCallModal('groupIncoming');
            };

            const handleCallEndedEvent = () => leaveCall(false);

            // For trickle=false, we don't need webrtcSignal events — but keep for compatibility
            const handleWebrtcSignal = (signal) => {
                  if (connectionRef.current) {
                        try { 
                              connectionRef.current.signal(signal); 
                        } catch (e) { 
                              console.error('WebRTC Signal error:', e);
                              showCallToast('⚠️ Connection issue. Retrying...', 'warning');
                        }
                  }
            };

            socket.on("callUser", handleCallUser);
            socket.on("callAccepted", handleCallAccepted);
            socket.on("callCancelled", handleCallCancelled);
            socket.on("callEnded", handleCallEndedEvent);
            socket.on("webrtcSignal", handleWebrtcSignal);
            socket.on("groupCallIncoming", handleGroupCallIncoming);

            // Warn before page unload during active call
            const handleBeforeUnload = (e) => {
                  if (isCallingRef.current || callAcceptedRef.current) {
                        e.preventDefault();
                        e.returnValue = "You have an active call. Refreshing will end the call.";
                        return e.returnValue;
                  }
            };

            const handlePageHide = () => {
                  if (isCallingRef.current || callAcceptedRef.current) {
                        pageUnloadRef.current = true;
                  }
            };

            window.addEventListener('beforeunload', handleBeforeUnload);
            window.addEventListener('pagehide', handlePageHide);

            return () => {
                  socket.off("callUser", handleCallUser);
                  socket.off("callAccepted", handleCallAccepted);
                  socket.off("callCancelled", handleCallCancelled);
                  socket.off("callEnded", handleCallEndedEvent);
                  socket.off("webrtcSignal", handleWebrtcSignal);
                  socket.off("groupCallIncoming", handleGroupCallIncoming);
                  window.removeEventListener('beforeunload', handleBeforeUnload);
                  window.removeEventListener('pagehide', handlePageHide);
            };
      }, [socket]);

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
                  gainNode.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.1);
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

      const getMediaStream = async (type) => {
            const constraints = {
                  video: type === 'video' ? {
                        facingMode: { ideal: facingMode },
                        width: { ideal: 1280, max: 1920 },
                        height: { ideal: 720, max: 1080 }
                  } : false,
                  audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 44100
                  }
            };
            return await navigator.mediaDevices.getUserMedia(constraints);
      };

      const startCall = async (targetUserId, type, otherUserData, options = {}) => {
            if (!socket || !isConnected) {
                  showCallToast('Realtime connection is still getting ready. Please try again in a moment.', 'warning');
                  return;
            }

            pageUnloadRef.current = false;
            setCallEnded(false);
            setCallType(type);
            setIsCalling(true);
            isCallingRef.current = true;
            setCaller(otherUserData);
            callerRef.current = otherUserData;
            targetUserIdRef.current = targetUserId?.toString();
            setShowCallModal('calling');

            try {
                  const mediaStream = await getMediaStream(type);
                  setStream(mediaStream);
                  if (myVideo.current) {
                        myVideo.current.srcObject = mediaStream;
                        myVideo.current.muted = true; // Always mute self-view
                  }

                  if (options.resume) {
                        showCallToast('Trying to reconnect the call...', 'info');
                  }

                  // Use trickle: true for extremely fast connection times (allows ICE candidates to flow instantly)
                  const peer = new Peer({
                        initiator: true,
                        trickle: true,
                        stream: mediaStream,
                        config: ICE_SERVERS,
                        sdpTransform: (sdp) => {
                              // Prefer opus audio codec for better voice quality
                              return sdp.replace('useinbandfec=1', 'useinbandfec=1; stereo=1; maxaveragebitrate=510000');
                        }
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
                              socket.emit("webrtcSignal", {
                                    signal: data,
                                    to: targetUserId
                              });
                        }
                  });

                  peer.on("stream", (remoteStreamMedia) => {
                        setRemoteStream(remoteStreamMedia);
                        if (userVideo.current) {
                              userVideo.current.srcObject = remoteStreamMedia;
                              userVideo.current.play().catch(() => { });
                        }
                  });

                  peer.on("connect", () => {
                        console.log('WebRTC peer connected!');
                  });

                  peer.on("error", (err) => {
                        console.error('Peer error:', err);
                        showCallToast('⚠️ Connection dropped. Please try again.', 'error');
                        leaveCall(true);
                  });
                  
                  peer.on("close", () => {
                        console.log('Peer connection closed');
                        leaveCall(false);
                  });

                  connectionRef.current = peer;

                  // Auto-cancel after 40s if unanswered
                  callTimeoutRef.current = setTimeout(() => {
                        if (!callAcceptedRef.current) {
                              showCallToast('📵 No answer — call timed out', 'info');
                              leaveCall(true);
                        }
                  }, 40000);

            } catch (err) {
                  console.error('Call initialization failed:', err);
                  setIsCalling(false);
                  isCallingRef.current = false;
                  setShowCallModal(null);
                  targetUserIdRef.current = null;
                  clearPersistedCallSession();
                  restoredSessionRef.current = false;
                  if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                        showCallToast('🎙️ No microphone/camera found. Please connect a device.', 'error');
                  } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                        showCallToast('🔒 Camera/microphone access denied. Please allow permissions in your browser settings.', 'error');
                  } else if (err.name === 'NotReadableError') {
                        showCallToast('📷 Camera or microphone is already in use by another app.', 'error');
                  } else {
                        showCallToast('⚠️ Could not start call. Check your camera/mic permissions.', 'error');
                  }
                  leaveCall(false);
            }
      };

      const answerCall = async () => {
            if (!socket || !isConnected) {
                  showCallToast('Realtime connection is not ready, so the call cannot be answered yet.', 'warning');
                  return;
            }

            pageUnloadRef.current = false;
            setShowCallModal(null);
            setCallAccepted(true);
            callAcceptedRef.current = true;
            callStartTime.current = Date.now();

            try {
                  const mediaStream = await getMediaStream(callType);
                  setStream(mediaStream);
                  if (myVideo.current) {
                        myVideo.current.srcObject = mediaStream;
                        myVideo.current.muted = true;
                  }

                  const callerId = targetUserIdRef.current
                        || callerRef.current?._id || callerRef.current?.id
                        || (typeof callerRef.current === 'string' ? callerRef.current : null);

                  // Use trickle: true for extremely fast answer signaling
                  const peer = new Peer({
                        initiator: false,
                        trickle: true,
                        stream: mediaStream,
                        config: ICE_SERVERS
                  });

                  let isFirstAnswer = true;
                  peer.on("signal", (data) => {
                        if (isFirstAnswer) {
                              socket.emit("answerCall", { signal: data, to: callerId });
                              isFirstAnswer = false;
                        } else {
                              socket.emit("webrtcSignal", { signal: data, to: callerId });
                        }
                  });

                  peer.on("stream", (remoteStreamMedia) => {
                        setRemoteStream(remoteStreamMedia);
                        if (userVideo.current) {
                              userVideo.current.srcObject = remoteStreamMedia;
                              userVideo.current.play().catch(() => { });
                        }
                  });

                  peer.on("connect", () => {
                        console.log('WebRTC peer connected!');
                  });

                  peer.on("error", (err) => {
                        console.error("Peer error:", err);
                        showCallToast('⚠️ Call connection lost. Please try again.', 'error');
                        leaveCall(false);
                  });

                  peer.on("close", () => { leaveCall(false); });

                  // Signal the peer with the caller's offer
                  peer.signal(callerSignal);
                  connectionRef.current = peer;

            } catch (err) {
                  console.error('Failed to answer call:', err);
                  setCallAccepted(false);
                  callAcceptedRef.current = false;
                  setReceivingCall(false);
                  setShowCallModal(null);

                  const callerId = targetUserIdRef.current
                        || callerRef.current?._id || callerRef.current?.id
                        || (typeof callerRef.current === 'string' ? callerRef.current : null);
                  if (socket && callerId) socket.emit("cancelCall", { to: callerId });

                  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                        showCallToast('🔒 Camera/microphone access denied. Cannot answer call.', 'error');
                  } else if (err.name === 'NotReadableError') {
                        showCallToast('📷 Camera or microphone is already in use by another app.', 'error');
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

      // Screen Share
      const startScreenShare = async () => {
            // Screen share NOT supported on Android
            if (!supportsScreenShare()) {
                  showCallToast('📱 Screen sharing is not available on mobile devices.', 'info');
                  return;
            }
            try {
                  const screenStream = await navigator.mediaDevices.getDisplayMedia({
                        video: { cursor: 'always', displaySurface: 'monitor' },
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
                  if (myVideo.current && stream) {
                        const newStream = new MediaStream([screenTrack, ...stream.getAudioTracks()]);
                        myVideo.current.srcObject = newStream;
                  }

                  setIsScreenSharing(true);

                  // Auto-stop when user clicks "Stop sharing" in browser chrome UI
                  screenTrack.onended = () => stopScreenShare();
            } catch (err) {
                  if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
                        // User cancelled — no toast needed
                  } else {
                        showCallToast('⚠️ Screen share failed. Try again or use desktop.', 'error');
                  }
            }
      };

      // Flip Camera (mobile only: switch front/back)
      const flipCamera = async () => {
            if (!stream) return;
            const newFacing = facingMode === 'user' ? 'environment' : 'user';
            try {
                  const newStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: { exact: newFacing } },
                        audio: false
                  });
                  const newVideoTrack = newStream.getVideoTracks()[0];

                  // Replace in peer connection
                  if (connectionRef.current) {
                        const sender = connectionRef.current._pc?.getSenders?.().find(s => s.track?.kind === 'video');
                        if (sender) await sender.replaceTrack(newVideoTrack);
                  }

                  // Stop old video track
                  stream.getVideoTracks().forEach(t => t.stop());

                  // Build new combined stream
                  const combinedStream = new MediaStream([newVideoTrack, ...stream.getAudioTracks()]);
                  setStream(combinedStream);
                  if (myVideo.current) myVideo.current.srcObject = combinedStream;

                  setFacingMode(newFacing);
                  showCallToast(newFacing === 'user' ? '📷 Switched to front camera' : '📷 Switched to back camera', 'info');
            } catch (err) {
                  showCallToast('⚠️ Could not flip camera.', 'error');
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

      // Speaker toggle
      const toggleSpeaker = async () => {
            const newSpeaker = !isSpeakerOn;
            setIsSpeakerOn(newSpeaker);
            // Try setSinkId (desktop/supported browsers)
            if (userVideo.current && userVideo.current.setSinkId) {
                  try {
                        const devices = await navigator.mediaDevices.enumerateDevices();
                        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
                        // Try to find earpiece or speaker by label
                        let target = audioOutputs.find(d => {
                              const label = d.label.toLowerCase();
                              return newSpeaker
                                    ? label.includes('speaker') || label.includes('loudspeaker')
                                    : label.includes('earpiece') || label.includes('ear');
                        });
                        // Fallback: toggle between default outputs
                        if (!target && audioOutputs.length > 1) {
                              target = audioOutputs[newSpeaker ? 0 : 1];
                        }
                        if (target) await userVideo.current.setSinkId(target.deviceId);
                  } catch (e) { /* setSinkId not supported - gracefully ignore */ }
            }
            // Android: toggle muted state as a visual indicator (audio routing handled by OS)
            showCallToast(newSpeaker ? '🔊 Speaker on' : '🔈 Earpiece mode', 'info');
      };

      const leaveCall = async (emitEvent = true) => {
            if (callTimeoutRef.current) {
                  clearTimeout(callTimeoutRef.current);
                  callTimeoutRef.current = null;
            }

            if (pageUnloadRef.current) {
                  if (connectionRef.current) {
                        connectionRef.current.destroy();
                        connectionRef.current = null;
                  }
                  return;
            }

            // Stop screen share cleanly
            if (screenTrackRef.current) {
                  screenTrackRef.current.stop();
                  screenTrackRef.current = null;
            }
            setIsScreenSharing(false);

            const otherPartyId = targetUserIdRef.current
                  || callerRef.current?._id?.toString() || callerRef.current?.id?.toString()
                  || (typeof callerRef.current === 'string' ? callerRef.current : null);

            if (emitEvent && socket && otherPartyId) {
                  if (isCallingRef.current && !callAcceptedRef.current) {
                        socket.emit("cancelCall", { to: otherPartyId });
                  } else {
                        socket.emit("leaveCall", { to: otherPartyId });
                  }
            }

            // Log call duration to chat if the initiator
            if (isCallingRef.current && otherPartyId) {
                  const typeLabel = callType === 'video' ? '📹 Video' : '📞 Voice';
                  let callLogMessage;
                  if (callAcceptedRef.current && callStartTime.current) {
                        const durationSeconds = Math.floor((Date.now() - callStartTime.current) / 1000);
                        const mins = Math.floor(durationSeconds / 60);
                        const secs = durationSeconds % 60;
                        callLogMessage = `${typeLabel} Call • ${mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}`;
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
            clearPersistedCallSession();
            restoredSessionRef.current = false;
            setCallEnded(true);
            setIsCalling(false);
            isCallingRef.current = false;
            setReceivingCall(false);
            setCallAccepted(false);
            callAcceptedRef.current = false;
            setShowCallModal(null);

            // Clean up connection
            if (connectionRef.current) {
                  try {
                        connectionRef.current.destroy();
                  } catch (e) {
                        console.error('Error destroying peer connection:', e);
                  }
                  connectionRef.current = null;
            }

            // Always stop ALL tracks cleanly (prevents camera LED staying on)
            if (stream) {
                  stream.getTracks().forEach(track => {
                        try {
                              track.stop();
                        } catch (e) {
                              console.error('Error stopping track:', e);
                        }
                  });
                  setStream(null);
            }
            if (remoteStream) {
                  remoteStream.getTracks().forEach(track => {
                        try {
                              track.stop();
                        } catch (e) {
                              console.error('Error stopping remote track:', e);
                        }
                  });
                  setRemoteStream(null);
            }

            // Clean up video elements
            if (myVideo.current) {
                  myVideo.current.srcObject = null;
            }
            if (userVideo.current) {
                  userVideo.current.srcObject = null;
            }

            setTimeout(() => {
                  setCallEnded(false);
                  setCallType(null);
                  setCaller(null);
                  callerRef.current = null;
                  setCallerSignal(null);
                  setIsMuted(false);
                  setIsVideoOff(false);
                  setIsSpeakerOn(true);
                  callStartTime.current = null;
                  targetUserIdRef.current = null;
            }, 800);
      };

      const rejectCall = () => {
            clearPersistedCallSession();
            restoredSessionRef.current = false;
            const callerId = targetUserIdRef.current
                  || callerRef.current?._id?.toString() || callerRef.current?.id?.toString()
                  || (typeof callerRef.current === 'string' ? callerRef.current : null);

            if (socket && callerId) socket.emit('cancelCall', { to: callerId });

            setShowCallModal(null);
            setReceivingCall(false);
            setCallerSignal(null);
            setCaller(null);
            callerRef.current = null;
            setCallType(null);
            targetUserIdRef.current = null;
      };

      const startGroupCall = (groupId, groupName, participants, callType = 'video') => {
            setActiveGroupCall({ groupId, groupName, participants, callType });
      };

      const acceptGroupCall = () => {
            if (!incomingGroupCall) return;
            
            // Set active group call and clear incoming
            setActiveGroupCall({
                  groupId: incomingGroupCall.groupId,
                  groupName: incomingGroupCall.groupName || 'Group Call',
                  participants: incomingGroupCall.participants || [],
                  callType: incomingGroupCall.callType
            });
            
            setIncomingGroupCall(null);
            setShowCallModal(null);
      };

      const rejectGroupCall = () => {
            if (!incomingGroupCall || !socket) return;
            
            // Notify caller that we rejected
            socket.emit('groupCallRejected', {
                  to: incomingGroupCall.from,
                  groupId: incomingGroupCall.groupId
            });
            
            setIncomingGroupCall(null);
            setShowCallModal(null);
      };

      return (
            <CallContext.Provider value={{
                  stream, remoteStream, setStream, myVideo, userVideo,
                  receivingCall, caller, callerSignal,
                  callAccepted, callEnded, callType,
                  isCalling, showCallModal, setShowCallModal,
                  isMuted, isVideoOff,
                  isScreenSharing, isSpeakerOn,
                  facingMode,
                  callToast,
                  startCall, answerCall, leaveCall, rejectCall,
                  toggleMute, toggleVideo,
                  startScreenShare, stopScreenShare,
                  toggleSpeaker, flipCamera,
                  isAndroid: isAndroid(),
                  supportsScreenShare: supportsScreenShare(),
                  activeGroupCall, startGroupCall,
                  incomingGroupCall, acceptGroupCall, rejectGroupCall
            }}>
                  {children}
                  {/* Group Call Overlay rendered globally when active */}
                  {activeGroupCall && (
                        <GroupCallOverlay
                              groupId={activeGroupCall.groupId}
                              groupName={activeGroupCall.groupName}
                              participants={activeGroupCall.participants}
                              callType={activeGroupCall.callType}
                              onEnd={() => setActiveGroupCall(null)}
                        />
                  )}
            </CallContext.Provider>
      );
};
