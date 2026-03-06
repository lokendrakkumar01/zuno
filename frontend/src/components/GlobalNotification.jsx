import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocketContext } from '../context/SocketContext';
import { useCallContext } from '../context/CallContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const playNotificationSound = () => {
      try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880.00, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
      } catch (e) {
            console.log('Audio blocked:', e);
      }
};

const GlobalNotification = () => {
      const { socket } = useSocketContext();
      const { answerCall, leaveCall } = useCallContext();
      const { user } = useAuth();
      const location = useLocation();
      const navigate = useNavigate();
      const callToastId = useRef(null);

      useEffect(() => {
            // Request native notification permission on mount
            if ('Notification' in window && Notification.permission === 'default') {
                  Notification.requestPermission();
            }
      }, []);

      useEffect(() => {
            if (!socket) return;

            const handleNewMessage = (newMessage) => {
                  const senderId = (newMessage.sender?._id || newMessage.sender || '').toString();
                  const currentUserId = (user?._id || user?.id || '').toString();

                  // Do not notify for our OWN messages!
                  if (senderId === currentUserId) return;

                  const pathSegments = location.pathname.split('/').filter(Boolean);
                  const pathUserId = pathSegments[pathSegments.length - 1];
                  const isOnChatPage = location.pathname.startsWith('/messages') && pathUserId === senderId;

                  // Only notify if not currently viewing this chat
                  if (!isOnChatPage) {
                        playNotificationSound();
                        const senderName = newMessage.sender?.displayName || newMessage.sender?.username || 'Someone';
                        const textPreview = newMessage.text
                              ? (newMessage.text.length > 40 ? newMessage.text.substring(0, 40) + '...' : newMessage.text)
                              : (newMessage.media?.type === 'video' ? '🎬 Video message' : '📷 Photo message');

                        const navigateId = senderId || (typeof newMessage.sender === 'string' ? newMessage.sender : '');

                        toast.info(
                              <div onClick={() => navigate(`/messages/${navigateId}`)} style={{ cursor: 'pointer' }}>
                                    <strong style={{ display: 'block' }}>{senderName}</strong>
                                    <span style={{ fontSize: '0.9em', opacity: 0.9 }}>{textPreview}</span>
                              </div>,
                              { position: "top-right", autoClose: 4000, icon: "💬" }
                        );

                        // Native notification if tab is hidden
                        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
                              const n = new Notification(`New message from ${senderName}`, {
                                    body: textPreview,
                                    tag: `zuno-msg-${senderId}`
                              });
                              n.onclick = () => {
                                    window.focus();
                                    navigate(`/messages/${navigateId}`);
                              };
                        }
                  }
            };

            const handleIncomingCall = (data) => {
                  const callerName = data.from?.displayName || data.from?.username || 'Someone';
                  const callTypeLabel = data.callType === 'video' ? '📹 Video Call' : '📞 Voice Call';

                  // Play ringtone notification
                  playNotificationSound();

                  // Persistent toast with Accept / Decline buttons
                  callToastId.current = toast.info(
                        <div style={{ lineHeight: 1.5 }}>
                              <strong style={{ display: 'block', fontSize: '1em', marginBottom: '4px' }}>
                                    {callTypeLabel} — {callerName}
                              </strong>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    <button
                                          onClick={() => {
                                                toast.dismiss(callToastId.current);
                                                leaveCall(true);
                                          }}
                                          style={{
                                                flex: 1, background: '#ef4444', color: 'white',
                                                border: 'none', borderRadius: '8px', padding: '6px',
                                                cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
                                          }}
                                    >
                                          Decline
                                    </button>
                                    <button
                                          onClick={() => {
                                                toast.dismiss(callToastId.current);
                                                answerCall();
                                          }}
                                          style={{
                                                flex: 1, background: '#10b981', color: 'white',
                                                border: 'none', borderRadius: '8px', padding: '6px',
                                                cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
                                          }}
                                    >
                                          Answer
                                    </button>
                              </div>
                        </div>,
                        {
                              position: "top-right",
                              autoClose: 45000,   // Auto-dismiss after 45s (matches call timeout)
                              closeOnClick: false,
                              closeButton: false,
                              icon: data.callType === 'video' ? '📹' : '📞',
                              toastId: 'incoming-call'
                        }
                  );

                  // Native browser notification if tab is hidden
                  if ('Notification' in window && Notification.permission === 'granted') {
                        const n = new Notification(`${callTypeLabel} from ${callerName}`, {
                              body: 'Open ZUNO to answer',
                              tag: 'zuno-call',
                              requireInteraction: true
                        });
                        n.onclick = () => {
                              window.focus();
                              n.close();
                        };
                  }
            };

            // When the caller cancels before we answer — dismiss the call toast
            const handleCallCancelled = () => {
                  toast.dismiss('incoming-call');
                  callToastId.current = null;
                  toast.info('Caller hung up.', { autoClose: 2000, icon: '📵' });
            };

            // When call ends (after being answered)
            const handleCallEnded = () => {
                  toast.dismiss('incoming-call');
                  callToastId.current = null;
            };

            const handleNewFollow = (data) => {
                  playNotificationSound();
                  toast.success(
                        <div onClick={() => navigate(`/profile/${data.sender.username}`)} style={{ cursor: 'pointer' }}>
                              <strong>New Follower!</strong>
                              <p style={{ fontSize: '0.85em' }}>{data.sender.displayName || data.sender.username} followed you</p>
                        </div>,
                        { position: "top-right", autoClose: 5000, icon: "👤" }
                  );
            };

            const handleNewFollowRequest = (data) => {
                  playNotificationSound();
                  toast.info(
                        <div onClick={() => navigate(`/settings?tab=requests`)} style={{ cursor: 'pointer' }}>
                              <strong>Follow Request</strong>
                              <p style={{ fontSize: '0.85em' }}>{data.sender.displayName || data.sender.username} wants to follow you</p>
                        </div>,
                        { position: "top-right", autoClose: 5000, icon: "🔒" }
                  );
            };

            const handleFollowAccepted = (data) => {
                  playNotificationSound();
                  toast.success(
                        <div onClick={() => navigate(`/profile/${data.sender.username}`)} style={{ cursor: 'pointer' }}>
                              <strong>Request Accepted!</strong>
                              <p style={{ fontSize: '0.85em' }}>{data.sender.displayName || data.sender.username} accepted your follow request</p>
                        </div>,
                        { position: "top-right", autoClose: 5000, icon: "✅" }
                  );
            };

            const handleNewInteraction = (data) => {
                  playNotificationSound();
                  toast.success(
                        <div onClick={() => navigate(`/content/${data.contentId}`)} style={{ cursor: 'pointer' }}>
                              <strong>Helpful Tip!</strong>
                              <p style={{ fontSize: '0.85em' }}>{data.sender.displayName || data.sender.username} marked your post "{data.title}" as helpful</p>
                        </div>,
                        { position: "top-right", autoClose: 5000, icon: "💎" }
                  );
            };

            const handleNewComment = (data) => {
                  playNotificationSound();
                  toast.info(
                        <div onClick={() => navigate(`/content/${data.contentId}`)} style={{ cursor: 'pointer' }}>
                              <strong>New Comment</strong>
                              <p style={{ fontSize: '0.85em' }}>{data.comment.user.displayName || data.comment.user.username} commented on "{data.contentTitle}"</p>
                        </div>,
                        { position: "top-right", autoClose: 5000, icon: "💬" }
                  );
            };

            socket.on("newMessage", handleNewMessage);
            socket.on("callUser", handleIncomingCall);
            socket.on("callCancelled", handleCallCancelled);
            socket.on("callEnded", handleCallEnded);
            socket.on("newFollow", handleNewFollow);
            socket.on("newFollowRequest", handleNewFollowRequest);
            socket.on("followAccepted", handleFollowAccepted);
            socket.on("newInteraction", handleNewInteraction);
            socket.on("newComment", handleNewComment);

            return () => {
                  socket.off("newMessage", handleNewMessage);
                  socket.off("callUser", handleIncomingCall);
                  socket.off("callCancelled", handleCallCancelled);
                  socket.off("callEnded", handleCallEnded);
                  socket.off("newFollow", handleNewFollow);
                  socket.off("newFollowRequest", handleNewFollowRequest);
                  socket.off("followAccepted", handleFollowAccepted);
                  socket.off("newInteraction", handleNewInteraction);
                  socket.off("newComment", handleNewComment);
            };
      }, [socket, location.pathname, navigate, answerCall, leaveCall]);

      return null;
};

export default GlobalNotification;
