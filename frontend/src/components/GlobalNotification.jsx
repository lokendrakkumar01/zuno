import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocketContext } from '../context/SocketContext';
import { useCallContext } from '../context/CallContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const DEFAULT_NOTIFICATION_SETTINGS = {
      pushNotifications: true,
      emailNotifications: true,
      likesNotifications: true,
      commentsNotifications: true,
      followsNotifications: true,
      mentionsNotifications: true,
      sharesNotifications: true
};

const playNotificationSound = () => {
      try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880.0, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
      } catch (error) {
            console.log('Audio blocked:', error);
      }
};

const GlobalNotification = () => {
      const { socket } = useSocketContext();
      const { answerCall, rejectCall } = useCallContext();
      const { user } = useAuth();
      const location = useLocation();
      const navigate = useNavigate();
      const callToastId = useRef(null);
      const recentEventsRef = useRef(new Map());

      const notificationSettings = {
            ...DEFAULT_NOTIFICATION_SETTINGS,
            ...(user?.notificationSettings || {})
      };

      const shouldAllow = (settingKey = 'pushNotifications') => {
            if (!notificationSettings.pushNotifications) return false;
            if (settingKey === 'pushNotifications') return true;
            return notificationSettings[settingKey] !== false;
      };

      const isThrottled = (key, ttl = 2500) => {
            const now = Date.now();
            const lastSeen = recentEventsRef.current.get(key) || 0;
            if (now - lastSeen < ttl) return true;
            recentEventsRef.current.set(key, now);
            return false;
      };

      useEffect(() => {
            if (!notificationSettings.pushNotifications) return;

            if ('Notification' in window && Notification.permission === 'default') {
                  Notification.requestPermission().catch(() => {});
            }
      }, [notificationSettings.pushNotifications]);

      useEffect(() => {
            if (!socket || !user?._id) return undefined;

            const showNativeNotification = (title, body, tag, onClick) => {
                  if (!notificationSettings.pushNotifications) return;
                  if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;

                  const nativeNotification = new Notification(title, { body, tag });
                  nativeNotification.onclick = () => {
                        window.focus();
                        nativeNotification.close();
                        onClick?.();
                  };
            };

            const handleNewMessage = (newMessage) => {
                  if (!shouldAllow()) return;

                  const senderId = (newMessage.sender?._id || newMessage.sender || '').toString();
                  const currentUserId = (user?._id || user?.id || '').toString();
                  if (!senderId || senderId === currentUserId) return;

                  const pathSegments = location.pathname.split('/').filter(Boolean);
                  const pathUserId = pathSegments[pathSegments.length - 1];
                  const isOnChatPage = location.pathname.startsWith('/messages') && pathUserId === senderId;
                  if (isOnChatPage || isThrottled(`message:${newMessage._id || senderId}:${newMessage.createdAt || ''}`)) return;

                  const senderName = newMessage.sender?.displayName || newMessage.sender?.username || 'Someone';
                  const textPreview = newMessage.text
                        ? (newMessage.text.length > 40 ? `${newMessage.text.substring(0, 40)}...` : newMessage.text)
                        : (newMessage.media?.type === 'video' ? 'Video message' : 'Photo message');
                  const navigateId = senderId || (typeof newMessage.sender === 'string' ? newMessage.sender : '');

                  playNotificationSound();
                  toast.info(
                        <div onClick={() => navigate(`/messages/${navigateId}`)} style={{ cursor: 'pointer' }}>
                              <strong style={{ display: 'block' }}>{senderName}</strong>
                              <span style={{ fontSize: '0.9em', opacity: 0.9 }}>{textPreview}</span>
                        </div>,
                        { position: 'top-right', autoClose: 4000, icon: 'DM', toastId: `msg-${newMessage._id || senderId}` }
                  );

                  showNativeNotification(
                        `New message from ${senderName}`,
                        textPreview,
                        `zuno-msg-${senderId}`,
                        () => navigate(`/messages/${navigateId}`)
                  );
            };

            const handleIncomingCall = (data) => {
                  if (!shouldAllow()) return;
                  if (isThrottled(`call:${data.from?._id || data.from?.id || 'incoming'}`, 1500)) return;

                  const callerName = data.from?.displayName || data.from?.username || 'Someone';
                  const callTypeLabel = data.callType === 'video' ? 'Video Call' : 'Voice Call';

                  playNotificationSound();
                  callToastId.current = toast.info(
                        <div style={{ lineHeight: 1.5 }}>
                              <strong style={{ display: 'block', fontSize: '1em', marginBottom: '4px' }}>
                                    {callTypeLabel} - {callerName}
                              </strong>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    <button
                                          onClick={() => {
                                                toast.dismiss(callToastId.current);
                                                rejectCall();
                                          }}
                                          style={{
                                                flex: 1,
                                                background: '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '6px',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                fontSize: '0.85rem'
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
                                                flex: 1,
                                                background: '#10b981',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '6px',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                fontSize: '0.85rem'
                                          }}
                                    >
                                          Answer
                                    </button>
                              </div>
                        </div>,
                        {
                              position: 'top-right',
                              autoClose: 45000,
                              closeOnClick: false,
                              closeButton: false,
                              icon: data.callType === 'video' ? 'Video' : 'Call',
                              toastId: 'incoming-call'
                        }
                  );

                  showNativeNotification(
                        `${callTypeLabel} from ${callerName}`,
                        'Open ZUNO to answer',
                        'zuno-call',
                        () => window.focus()
                  );
            };

            const handleCallCancelled = () => {
                  toast.dismiss('incoming-call');
                  callToastId.current = null;
            };

            const handleCallEnded = () => {
                  toast.dismiss('incoming-call');
                  callToastId.current = null;
            };

            const handleProfileNotification = (notification) => {
                  const typeToSettingKey = {
                        comment: 'commentsNotifications',
                        helpful: 'likesNotifications',
                        follow: 'followsNotifications',
                        unfollow: 'followsNotifications',
                        follow_request: 'followsNotifications',
                        follow_request_accepted: 'followsNotifications',
                        follow_request_rejected: 'followsNotifications'
                  };

                  const settingKey = typeToSettingKey[notification.type] || 'pushNotifications';
                  if (!shouldAllow(settingKey)) return;
                  if (isThrottled(`notification:${notification._id || notification.type}:${notification.createdAt || ''}`)) return;

                  const actorName = notification.actor?.displayName || notification.actor?.username || 'Someone';
                  const iconByType = {
                        comment: 'Comment',
                        helpful: 'Like',
                        follow: 'Follow',
                        unfollow: 'Unfollow',
                        follow_request: 'Request',
                        follow_request_accepted: 'Accepted',
                        follow_request_rejected: 'Declined'
                  };

                  playNotificationSound();
                  toast.info(
                        <div onClick={() => navigate(notification.actionUrl || '/profile')} style={{ cursor: 'pointer' }}>
                              <strong>{notification.title}</strong>
                              <p style={{ fontSize: '0.85em' }}>{notification.body || `${actorName} sent an update.`}</p>
                        </div>,
                        {
                              position: 'top-right',
                              autoClose: 5000,
                              icon: iconByType[notification.type] || 'Alert',
                              toastId: `notification-${notification._id || notification.type}`
                        }
                  );

                  showNativeNotification(
                        notification.title,
                        notification.body || `${actorName} sent an update.`,
                        `zuno-notification-${notification.type}`,
                        () => navigate(notification.actionUrl || '/profile')
                  );
            };

            const handleGlobalBroadcast = (data) => {
                  if (!shouldAllow()) return;
                  if (isThrottled(`broadcast:${data.timestamp || data.message}`, 5000)) return;

                  playNotificationSound();

                  let icon = 'Broadcast';
                  if (data.type === 'success') icon = 'Done';
                  if (data.type === 'warning') icon = 'Warn';
                  if (data.type === 'error') icon = 'Error';

                  toast(
                        <div style={{ padding: '4px' }}>
                              <strong style={{ display: 'block', fontSize: '1.1em', marginBottom: '4px' }}>System Broadcast</strong>
                              <p style={{ fontSize: '0.95em', margin: 0 }}>{data.message}</p>
                        </div>,
                        {
                              position: 'top-center',
                              autoClose: 10000,
                              icon,
                              type: data.type === 'error' ? 'error' : data.type === 'warning' ? 'warning' : data.type === 'success' ? 'success' : 'info'
                        }
                  );
            };

            const handleStreamStarted = (data) => {
                  if (!shouldAllow()) return;
                  if (data.hostId === user?._id || data.hostId === user?.id) return;
                  if (isThrottled(`stream-started:${data.hostId}:${data.roomId || ''}`, 5000)) return;

                  playNotificationSound();
                  toast.info(
                        <div onClick={() => navigate(`/live/${data.hostId}`)} style={{ cursor: 'pointer' }}>
                              <strong style={{ color: '#ef4444' }}>Live Stream Started</strong>
                              <p style={{ fontSize: '0.85em', marginTop: '4px' }}>{data.title || 'Tap to join the stream'}</p>
                        </div>,
                        { position: 'top-center', autoClose: 8000, icon: 'Live' }
                  );
            };

            socket.on('newMessage', handleNewMessage);
            socket.on('callUser', handleIncomingCall);
            socket.on('callCancelled', handleCallCancelled);
            socket.on('callEnded', handleCallEnded);
            socket.on('notification:new', handleProfileNotification);
            socket.on('globalBroadcast', handleGlobalBroadcast);
            socket.on('streamStarted', handleStreamStarted);

            return () => {
                  socket.off('newMessage', handleNewMessage);
                  socket.off('callUser', handleIncomingCall);
                  socket.off('callCancelled', handleCallCancelled);
                  socket.off('callEnded', handleCallEnded);
                  socket.off('notification:new', handleProfileNotification);
                  socket.off('globalBroadcast', handleGlobalBroadcast);
                  socket.off('streamStarted', handleStreamStarted);
            };
      }, [
            socket,
            location.pathname,
            navigate,
            answerCall,
            rejectCall,
            user?._id,
            notificationSettings.pushNotifications,
            notificationSettings.likesNotifications,
            notificationSettings.commentsNotifications,
            notificationSettings.followsNotifications
      ]);

      return null;
};

export default GlobalNotification;
