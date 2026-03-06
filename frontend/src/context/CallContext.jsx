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
      const targetUserIdRef = useRef(null); // Store target ID for cleanup
      const callTimeoutRef = useRef(null);  // Call auto-cancel after 45s

      useEffect(() => {
            if (!socket) return;

            const handleCallUser = (data) => {
                  setReceivingCall(true);
                  setCaller(data.from);
                  setCallerSignal(data.signal);
                  setCallType(data.callType);
                  setShowCallModal('incoming');
            };

            const handleCallAccepted = (signal) => {
                  setCallAccepted(true);
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
            };

            const handleCallEndedEvent = () => {
                  leaveCall(false);
            };

            socket.on("callUser", handleCallUser);
            socket.on("callAccepted", handleCallAccepted);
            socket.on("callCancelled", handleCallCancelled);
            socket.on("callEnded", handleCallEndedEvent);

            return () => {
                  socket.off("callUser", handleCallUser);
                  socket.off("callAccepted", handleCallAccepted);
                  socket.off("callCancelled", handleCallCancelled);
                  socket.off("callEnded", handleCallEndedEvent);
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
            setCaller(otherUserData);
            targetUserIdRef.current = targetUserId; // Save for cleanup

            try {
                  const mediaStream = await navigator.mediaDevices.getUserMedia({
                        video: type === 'video',
                        audio: true
                  });
                  setStream(mediaStream);
                  if (myVideo.current) {
                        myVideo.current.srcObject = mediaStream;
                  }

                  const peer = new Peer({
                        initiator: true,
                        trickle: false,   // ✅ Single SDP offer — no race condition
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
                  });

                  connectionRef.current = peer;

                  // Auto-cancel after 45 seconds if unanswered
                  callTimeoutRef.current = setTimeout(() => {
                        if (!callAccepted) {
                              leaveCall(true);
                        }
                  }, 45000);

            } catch (err) {
                  console.error('Failed to get local stream:', err);
                  setIsCalling(false);
                  targetUserIdRef.current = null;
                  alert('Could not access microphone/camera. Please check permissions.');
            }
      };

      const answerCall = async () => {
            setShowCallModal(null);
            setCallAccepted(true);
            callStartTime.current = Date.now();

            try {
                  const mediaStream = await navigator.mediaDevices.getUserMedia({
                        video: callType === 'video',
                        audio: true
                  });
                  setStream(mediaStream);
                  if (myVideo.current) {
                        myVideo.current.srcObject = mediaStream;
                  }

                  const peer = new Peer({
                        initiator: false,
                        trickle: false,  // ✅ Single SDP answer
                        stream: mediaStream,
                        config: ICE_SERVERS
                  });

                  // Fires exactly once with the full answer SDP
                  peer.on("signal", (data) => {
                        const callerId = caller?._id || caller?.id || caller;
                        socket.emit("answerCall", { signal: data, to: callerId });
                  });

                  peer.on("stream", (remoteStream) => {
                        if (userVideo.current) {
                              userVideo.current.srcObject = remoteStream;
                        }
                  });

                  peer.on("error", (err) => {
                        console.error("Peer error:", err);
                  });

                  // Signal the peer with the stored offer
                  peer.signal(callerSignal);
                  connectionRef.current = peer;
            } catch (err) {
                  console.error('Failed to answer call:', err);
                  setCallAccepted(false);
                  setReceivingCall(false);
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

            // Determine the other party's ID
            const otherPartyId = targetUserIdRef.current
                  || caller?._id || caller?.id
                  || (typeof caller === 'string' ? caller : null);

            // Emit cancel (if caller hung up before answer) or end (if call was active)
            if (emitEvent && socket && otherPartyId) {
                  if (isCalling && !callAccepted) {
                        // Caller is cancelling before the callee answered
                        socket.emit("cancelCall", { to: otherPartyId });
                  } else {
                        socket.emit("leaveCall", { to: otherPartyId });
                  }
            }

            // Log call duration to chat if the caller initiated it
            if (isCalling && otherPartyId) {
                  let callLogMessage = '';
                  const typeLabel = callType === 'video' ? '📹 Video' : '📞 Voice';
                  if (callAccepted && callStartTime.current) {
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
            setReceivingCall(false);
            setCallAccepted(false);
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
