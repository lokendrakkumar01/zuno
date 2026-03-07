import { createContext, useState, useEffect, useRef, useContext } from "react";
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

      const myVideo = useRef();
      const userVideo = useRef();
      const connectionRef = useRef();
      const callStartTime = useRef(null);
      const targetUserIdRef = useRef(null);  // Target user ID for the call
      const callTimeoutRef = useRef(null);   // Call auto-cancel after 45s

      // Use refs to avoid stale closure bugs in timeout callbacks
      const callAcceptedRef = useRef(false);
      const isCallingRef = useRef(false);

      // Keep refs in sync with state
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
                  // Store caller ID so leaveCall can reach them
                  const callerId = data.from?._id || data.from?.id || data.from;
                  if (callerId && !targetUserIdRef.current) {
                        targetUserIdRef.current = callerId.toString();
                  }
            };

            const handleCallAccepted = (signal) => {
                  setCallAccepted(true);
                  callAcceptedRef.current = true;
                  callStartTime.current = Date.now();
                  // Clear the ring timeout - call was answered
                  if (callTimeoutRef.current) {
                        clearTimeout(callTimeoutRef.current);
                        callTimeoutRef.current = null;
                  }
                  if (connectionRef.current) {
                        connectionRef.current.signal(signal);
                  }
            };

            // Caller cancelled before callee answered
            const handleCallCancelled = () => {
                  setShowCallModal(null);
                  setReceivingCall(false);
                  setCallerSignal(null);
                  setCaller(null);
                  setCallType(null);
                  targetUserIdRef.current = null;
            };

            const handleCallEndedEvent = () => {
                  leaveCall(false);
            };

            socket.on("callUser", handleCallUser);
            socket.on("callAccepted", handleCallAccepted);
            socket.on("callCancelled", handleCallCancelled);
            socket.on("callEnded", handleCallEndedEvent);

            // Protection against accidental page refresh dropping the call
            const handleBeforeUnload = (e) => {
                  if (isCallingRef.current || callAcceptedRef.current) {
                        e.preventDefault();
                        e.returnValue = "You have an active call. Refreshing will end the call.";
                        return e.returnValue;
                  }
            };

            const handleUnload = () => {
                  if (isCallingRef.current || callAcceptedRef.current) {
                        // Attempt to notify the other person before the browser kills the connection
                        const otherPartyId = targetUserIdRef.current
                              || caller?._id?.toString() || caller?.id?.toString()
                              || (typeof caller === 'string' ? caller : null);

                        // Using beacon or standard socket emit before page completely dies
                        if (socket && otherPartyId) {
                              socket.emit("leaveCall", { to: otherPartyId });
                        }
                  }
            };

            window.addEventListener('beforeunload', handleBeforeUnload);
            window.addEventListener('unload', handleUnload);

            return () => {
                  socket.off("callUser", handleCallUser);
                  socket.off("callAccepted", handleCallAccepted);
                  socket.off("callCancelled", handleCallCancelled);
                  socket.off("callEnded", handleCallEndedEvent);
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
            } catch (e) {
                  console.log('Audio play blocked:', e);
            }
      };

      useEffect(() => {
            let interval;
            if (showCallModal === 'incoming') {
                  playRingtone();
                  interval = setInterval(playRingtone, 2500);
            }
            return () => {
                  if (interval) clearInterval(interval);
            };
      }, [showCallModal]);

      const startCall = async (targetUserId, type, otherUserData) => {
            setCallType(type);
            setIsCalling(true);
            isCallingRef.current = true;
            setCaller(otherUserData);
            targetUserIdRef.current = targetUserId?.toString(); // ✅ Save for cleanup
            setShowCallModal('calling'); // ✅ Show outgoing call screen

            try {
                  const mediaStream = await navigator.mediaDevices.getUserMedia({
                        video: type === 'video' ? {
                              width: { ideal: 1280, max: 1920 },
                              height: { ideal: 720, max: 1080 },
                              frameRate: { ideal: 30, max: 60 }
                        } : false,
                        audio: {
                              echoCancellation: true,
                              noiseSuppression: true,
                              autoGainControl: true
                        }
                  });
                  setStream(mediaStream);
                  if (myVideo.current) {
                        myVideo.current.srcObject = mediaStream;
                  }

                  const peer = new Peer({
                        initiator: true,
                        trickle: false,   // Single SDP offer — no race conditions
                        stream: mediaStream,
                        config: ICE_SERVERS
                  });

                  // With trickle: false, this fires exactly ONCE with the full offer
                  peer.on("signal", (data) => {
                        socket.emit("callUser", {
                              userToCall: targetUserId,
                              signalData: data,
                              from: user,
                              callType: type
                        });
                  });

                  peer.on("stream", (remoteStream) => {
                        if (userVideo.current) {
                              userVideo.current.srcObject = remoteStream;
                        }
                  });

                  peer.on("error", (err) => {
                        console.error("Peer error:", err);
                        // Clean up on peer error
                        leaveCall(true);
                  });

                  peer.on("close", () => {
                        console.log("Peer connection closed");
                  });

                  connectionRef.current = peer;

                  // Auto-cancel after 45 seconds if unanswered
                  // Use ref to avoid stale closure bug
                  callTimeoutRef.current = setTimeout(() => {
                        if (!callAcceptedRef.current) {
                              leaveCall(true);
                        }
                  }, 45000);

            } catch (err) {
                  console.error('Failed to get local stream:', err);
                  setIsCalling(false);
                  isCallingRef.current = false;
                  setShowCallModal(null);
                  targetUserIdRef.current = null;
                  alert('Could not access microphone/camera. Please check permissions.');
            }
      };

      const answerCall = async () => {
            setShowCallModal(null);
            setCallAccepted(true);
            callAcceptedRef.current = true;
            callStartTime.current = Date.now();

            try {
                  const mediaStream = await navigator.mediaDevices.getUserMedia({
                        video: callType === 'video' ? {
                              width: { ideal: 1280, max: 1920 },
                              height: { ideal: 720, max: 1080 },
                              frameRate: { ideal: 30, max: 60 }
                        } : false,
                        audio: {
                              echoCancellation: true,
                              noiseSuppression: true,
                              autoGainControl: true
                        }
                  });
                  setStream(mediaStream);
                  if (myVideo.current) {
                        myVideo.current.srcObject = mediaStream;
                  }

                  const peer = new Peer({
                        initiator: false,
                        trickle: false,  // Single SDP answer
                        stream: mediaStream,
                        config: ICE_SERVERS
                  });

                  // Fires exactly once with the full answer SDP
                  peer.on("signal", (data) => {
                        const callerId = targetUserIdRef.current
                              || caller?._id || caller?.id
                              || (typeof caller === 'string' ? caller : null);
                        socket.emit("answerCall", { signal: data, to: callerId });
                  });

                  peer.on("stream", (remoteStream) => {
                        if (userVideo.current) {
                              userVideo.current.srcObject = remoteStream;
                        }
                  });

                  peer.on("error", (err) => {
                        console.error("Peer error:", err);
                        leaveCall(false);
                  });

                  peer.on("close", () => {
                        console.log("Peer connection closed");
                  });

                  // Signal the peer with the stored offer
                  peer.signal(callerSignal);
                  connectionRef.current = peer;
            } catch (err) {
                  console.error('Failed to answer call:', err);
                  setCallAccepted(false);
                  callAcceptedRef.current = false;
                  setReceivingCall(false);
                  setShowCallModal(null);
                  alert('Could not access microphone/camera. Please check permissions.');
            }
      };

      const toggleMute = () => {
            if (stream) {
                  stream.getAudioTracks().forEach((track) => {
                        track.enabled = !track.enabled;
                  });
                  setIsMuted(!stream.getAudioTracks()[0]?.enabled);
            }
      };

      const toggleVideo = () => {
            if (stream) {
                  stream.getVideoTracks().forEach((track) => {
                        track.enabled = !track.enabled;
                  });
                  setIsVideoOff(!stream.getVideoTracks()[0]?.enabled);
            }
      };

      const leaveCall = async (emitEvent = true) => {
            // Clear the ring timeout
            if (callTimeoutRef.current) {
                  clearTimeout(callTimeoutRef.current);
                  callTimeoutRef.current = null;
            }

            // Determine the other party's ID (use ref — always fresh)
            const otherPartyId = targetUserIdRef.current
                  || caller?._id?.toString() || caller?.id?.toString()
                  || (typeof caller === 'string' ? caller : null);

            // Emit cancel (if caller hung up before answer) or end (if call was active)
            if (emitEvent && socket && otherPartyId) {
                  if (isCallingRef.current && !callAcceptedRef.current) {
                        // Caller is cancelling before the callee answered
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

            // Clean up state
            setCallEnded(true);
            setIsCalling(false);
            isCallingRef.current = false;
            setReceivingCall(false);
            setCallAccepted(false);
            callAcceptedRef.current = false;
            setShowCallModal(null);

            if (connectionRef.current) {
                  connectionRef.current.destroy();
                  connectionRef.current = null;
            }
            if (stream) {
                  stream.getTracks().forEach(track => track.stop());
                  setStream(null);
            }

            // Delayed cleanup so the UI can show "call ended" briefly
            setTimeout(() => {
                  setCallEnded(false);
                  setCallType(null);
                  setCaller(null);
                  setCallerSignal(null);
                  setIsMuted(false);
                  setIsVideoOff(false);
                  callStartTime.current = null;
                  targetUserIdRef.current = null;
            }, 800);
      };

      return (
            <CallContext.Provider value={{
                  stream, setStream, myVideo, userVideo,
                  receivingCall, caller, callerSignal,
                  callAccepted, callEnded, callType,
                  isCalling, showCallModal, setShowCallModal,
                  isMuted, isVideoOff,
                  startCall, answerCall, leaveCall,
                  toggleMute, toggleVideo
            }}>
                  {children}
            </CallContext.Provider>
      );
};
