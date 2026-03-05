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
                  // Don't show toast if we are currently chatting with this user
                  const isOnChatPage = location.pathname === `/messages/${newMessage.sender._id || newMessage.sender}`;

                  if (!isOnChatPage || document.hidden) {
                        // Play a synthesized notification sound
                        playNotificationSound();

                        // Show a styled toast
                        const senderName = newMessage.sender?.displayName || newMessage.sender?.username || 'Someone';
                        const textPreview = newMessage.text ?
                              (newMessage.text.length > 30 ? newMessage.text.substring(0, 30) + '...' : newMessage.text) :
                              (newMessage.media?.type === 'video' ? '🎬 Video message' : '📷 Photo message');

                        toast.info(
                              <div onClick={() => navigate(`/messages/${newMessage.sender._id || newMessage.sender}`)} style={{ cursor: 'pointer' }}>
                                    <strong style={{ display: 'block' }}>{senderName}</strong>
                                    <span style={{ fontSize: '0.9em', opacity: 0.9 }}>{textPreview}</span>
                              </div>,
                              {
                                    position: "top-right",
                                    autoClose: 4000,
                                    hideProgressBar: false,
                                    closeOnClick: true,
                                    pauseOnHover: true,
                                    draggable: true,
                                    icon: "💬"
                              }
                        );

                        // Fire native browser notification if granted and the tab is hidden or backgrounded
                        if ('Notification' in window && Notification.permission === 'granted') {
                              const nativeNotification = new Notification(`New message from ${senderName}`, {
                                    body: textPreview,
                                    icon: '/favicon.ico', // Update if there's a specific app icon
                                    tag: 'zuno-chat',    // prevent spam
                              });

                              nativeNotification.onclick = () => {
                                    window.focus(); // Focus the browser tab
                                    navigate(`/messages/${newMessage.sender._id || newMessage.sender}`);
                                    nativeNotification.close();
                              };
                        }
                  }
            };

            socket.on("newMessage", handleNewMessage);

            return () => {
                  socket.off("newMessage", handleNewMessage);
            };
      }, [socket, location.pathname, navigate]);

      return null; // This component just handles logic, UI is via toast
};

export default GlobalNotification;
