import { createContext, useState, useEffect, useRef, useContext } from "react";
import Peer from "simple-peer";
import { useSocketContext } from "./SocketContext";
import { useAuth } from "./AuthContext";
import { API_URL } from "../config";
import { useNavigate } from "react-router-dom";

const CallContext = createContext();

// Free public STUN servers for faster and more reliable hole punching
const ICE_SERVERS = {
      iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
      ]
};

export const useCallContext = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
      const { socket } = useSocketContext();
      const { user, token } = useAuth();
      const navigate = useNavigate();

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

      useEffect(() => {
            if (!socket) return;

            const handleCallUser = (data) => {
                  setReceivingCall(true);
                  setCaller(data.from); // Ideally data.from should be an object: {_id, displayName, avatar, username} -> let's assume it is!
                  setCallerSignal(data.signal);
                  setCallType(data.callType);
                  setShowCallModal('incoming');
            };

            const handleCallAccepted = (signal) => {
                  setCallAccepted(true);
                  callStartTime.current = Date.now();
                  if (connectionRef.current) {
                        connectionRef.current.signal(signal);
                  }
            };

            const handleCallEndedEvent = () => {
                  leaveCall(false); // Don't emit to other user because they sent the end signal
            };

            socket.on("callUser", handleCallUser);
            socket.on("callAccepted", handleCallAccepted);
            socket.on("callEnded", handleCallEndedEvent);

            return () => {
                  socket.off("callUser", handleCallUser);
                  socket.off("callAccepted", handleCallAccepted);
                  socket.off("callEnded", handleCallEndedEvent);
            };
      }, [socket]);

      const playRingtone = () => {
            try {
                  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                  const oscillator = audioCtx.createOscillator();
                  const gainNode = audioCtx.createGain();

                  oscillator.type = 'sine';
                  oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
                  oscillator.frequency.setValueAtTime(480, audioCtx.currentTime + 0.1);

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

      // Play ringtone while ringing
      useEffect(() => {
            let interval;
            if (showCallModal === 'incoming') {
                  playRingtone();
                  interval = setInterval(playRingtone, 2000);
            }
            return () => {
                  if (interval) clearInterval(interval);
            };
      }, [showCallModal]);

      const startCall = async (targetUserId, type, otherUserData) => {
            setCallType(type);
            setIsCalling(true);
            setCaller(otherUserData); // Store the person we are calling to display their info

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
                        trickle: true, // Enable trickle for faster connection
                        stream: mediaStream,
                        config: ICE_SERVERS
                  });

                  // With trickle: true, this will fire multiple times
                  peer.on("signal", (data) => {
                        socket.emit("callUser", {
                              userToCall: targetUserId,
                              signalData: data,
                              from: user, // pass our full user object (or at least ID, username, avatar)
                              callType: type
                        });
                  });

                  peer.on("stream", (remoteStream) => {
                        if (userVideo.current) {
                              userVideo.current.srcObject = remoteStream;
                        }
                  });

                  connectionRef.current = peer;
            } catch (err) {
                  console.error('Failed to get local stream. Please check permissions.', err);
                  setIsCalling(false);
                  alert('Could not access microphone/camera. Please ensure permissions are granted in your browser or device settings.');
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
                        trickle: true, // Enable trickle for faster connection
                        stream: mediaStream,
                        config: ICE_SERVERS
                  });

                  peer.on("signal", (data) => {
                        // Determine caller ID (could be ._id or just an ID string depending on implementation)
                        const callerId = caller?._id || caller?.id || caller;
                        socket.emit("answerCall", { signal: data, to: callerId });
                  });

                  peer.on("stream", (remoteStream) => {
                        if (userVideo.current) {
                              userVideo.current.srcObject = remoteStream;
                        }
                  });

                  peer.signal(callerSignal);
                  connectionRef.current = peer;
            } catch (err) {
                  console.error('Failed to answer call. Please check permissions.', err);
                  setCallAccepted(false);
                  setReceivingCall(false);
                  alert('Could not access microphone/camera. Please ensure permissions are granted in your browser or device settings.');
            }
      };

      const toggleMute = () => {
            if (stream) {
                  stream.getAudioTracks().forEach((track) => {
                        track.enabled = !track.enabled;
                  });
                  setIsMuted(!stream.getAudioTracks()[0].enabled);
            }
      };

      const toggleVideo = () => {
            if (stream) {
                  stream.getVideoTracks().forEach((track) => {
                        track.enabled = !track.enabled;
                  });
                  setIsVideoOff(!stream.getVideoTracks()[0].enabled);
            }
      };

      const leaveCall = async (emitEvent = true) => {
            // Build Call Log if initiator
            if (isCalling && caller) {
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

                  const otherPartyId = caller._id || caller.id || caller;

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
                  stream.getTracks().forEach(track => {
                        track.stop();
                  });
                  setStream(null);
            }
            if (emitEvent && socket) {
                  const otherPartyId = caller?._id || caller?.id || caller;
                  if (otherPartyId) {
                        socket.emit("leaveCall", { to: otherPartyId });
                  }
            }

            // Re-render cleanup
            setTimeout(() => {
                  setCallEnded(false);
                  setCallType(null);
                  setCaller(null);
                  setCallerSignal(null);
                  setIsMuted(false);
                  setIsVideoOff(false);
                  callStartTime.current = null;
            }, 1000);
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
