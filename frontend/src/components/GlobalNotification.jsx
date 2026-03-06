import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocketContext } from '../context/SocketContext';
import { toast } from 'react-toastify';

const playNotificationSound = () => {
      try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            // Soft pleasant chime (D5 to A5)
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(880.00, audioCtx.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.3);
      } catch (e) {
            console.log('Audio play blocked by browser or unsupported:', e);
      }
};

const GlobalNotification = () => {
      const { socket } = useSocketContext();
      const location = useLocation();
      const navigate = useNavigate();

      useEffect(() => {
            // Request native notification permission on mount if supported
            if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                  Notification.requestPermission();
            }
      }, []);

      useEffect(() => {
            if (!socket) return;

            const handleNewMessage = (newMessage) => {
                  const senderId = (newMessage.sender?._id || newMessage.sender || '').toString();
                  const pathUserId = location.pathname.split('/').pop();
                  const isOnChatPage = location.pathname.startsWith('/messages/') && pathUserId === senderId;

                  // Show notification if not currently viewing this chat
                  if (!isOnChatPage) {
                        playNotificationSound();
                        const senderName = newMessage.sender?.displayName || newMessage.sender?.username || 'Someone';
                        const textPreview = newMessage.text
                              ? (newMessage.text.length > 30 ? newMessage.text.substring(0, 30) + '...' : newMessage.text)
                              : (newMessage.media?.type === 'video' ? '🎬 Video message' : '📷 Photo message');

                        const navigateId = senderId || (typeof newMessage.sender === 'string' ? newMessage.sender : '');

                        toast.info(
                              <div onClick={() => navigate(`/messages/${navigateId}`)} style={{ cursor: 'pointer' }}>
                                    <strong style={{ display: 'block' }}>{senderName}</strong>
                                    <span style={{ fontSize: '0.9em', opacity: 0.9 }}>{textPreview}</span>
                              </div>,
                              { position: "top-right", autoClose: 4000, icon: "💬" }
                        );

                        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
                              new Notification(`New message from ${senderName}`, { body: textPreview, tag: 'zuno-chat' });
                        }
                  }
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
            socket.on("newFollow", handleNewFollow);
            socket.on("newFollowRequest", handleNewFollowRequest);
            socket.on("followAccepted", handleFollowAccepted);
            socket.on("newInteraction", handleNewInteraction);
            socket.on("newComment", handleNewComment);

            return () => {
                  socket.off("newMessage", handleNewMessage);
                  socket.off("newFollow", handleNewFollow);
                  socket.off("newFollowRequest", handleNewFollowRequest);
                  socket.off("followAccepted", handleFollowAccepted);
                  socket.off("newInteraction", handleNewInteraction);
                  socket.off("newComment", handleNewComment);
            };
      }, [socket, location.pathname, navigate]);

      return null; // This component just handles logic, UI is via toast
};

export default GlobalNotification;
