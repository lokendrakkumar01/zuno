import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import UserAvatar from '../User/UserAvatar';

const PRIMARY_NOTIFICATION_TIMEOUT_MS = 12000;
const WAKE_NOTIFICATION_TIMEOUT_MS = 25000;

const buildNotificationsCacheKey = (userId) => `zuno_notifications_cache_${userId}`;

const readCachedNotifications = (userId) => {
      if (!userId) return { notifications: [], unreadCount: 0 };

      try {
            const raw = localStorage.getItem(buildNotificationsCacheKey(userId));
            return raw ? JSON.parse(raw) : { notifications: [], unreadCount: 0 };
      } catch {
            return { notifications: [], unreadCount: 0 };
      }
};

const writeCachedNotifications = (userId, notifications, unreadCount) => {
      if (!userId) return;

      try {
            localStorage.setItem(buildNotificationsCacheKey(userId), JSON.stringify({
                  notifications,
                  unreadCount
            }));
      } catch {
            // Cache writes are optional.
      }
};

const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = PRIMARY_NOTIFICATION_TIMEOUT_MS) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

      try {
            const response = await fetch(url, {
                  ...options,
                  signal: controller.signal
            });
            const data = await response.json().catch(() => null);
            return { response, data };
      } finally {
            window.clearTimeout(timeoutId);
      }
};

const NotificationPanel = ({ onProfileRefresh }) => {
      const navigate = useNavigate();
      const { token, user } = useAuth();
      const { socket } = useSocketContext();
      const cachedInbox = useMemo(() => readCachedNotifications(user?._id), [user?._id]);

      const [notifications, setNotifications] = useState(cachedInbox.notifications || []);
      const [pendingRequests, setPendingRequests] = useState([]);
      const [unreadCount, setUnreadCount] = useState(cachedInbox.unreadCount || 0);
      const [loading, setLoading] = useState(() => (cachedInbox.notifications || []).length === 0);
      const [silentRefreshing, setSilentRefreshing] = useState(false);
      const [error, setError] = useState('');
      const [actionLoadingId, setActionLoadingId] = useState('');

      const syncNotificationCache = useCallback((nextNotifications, nextUnreadCount = unreadCount) => {
            setNotifications(nextNotifications);
            setUnreadCount(nextUnreadCount);
            writeCachedNotifications(user?._id, nextNotifications, nextUnreadCount);
      }, [unreadCount, user?._id]);

      const wakeBackend = useCallback(async () => {
            try {
                  await fetch(`${API_URL}/ping`, {
                        cache: 'no-store'
                  });
            } catch {
                  // Best-effort wake request only.
            }
      }, []);

      const fetchNotifications = useCallback(async (showLoader = false) => {
            if (!token || !user?._id) {
                  setLoading(false);
                  setSilentRefreshing(false);
                  return;
            }

            setError('');
            const hasCachedNotifications = notifications.length > 0;

            if (showLoader && !hasCachedNotifications) {
                  setLoading(true);
            } else {
                  setSilentRefreshing(true);
            }

            try {
                  const headers = { Authorization: `Bearer ${token}` };
                  const loadNotificationsRequest = async (timeoutMs) => (
                        fetchJsonWithTimeout(`${API_URL}/notifications?limit=40`, { headers }, timeoutMs)
                  );
                  const loadRequestsRequest = async (timeoutMs) => (
                        fetchJsonWithTimeout(`${API_URL}/users/requests/pending`, { headers }, timeoutMs)
                  );

                  let results = await Promise.allSettled([
                        loadNotificationsRequest(PRIMARY_NOTIFICATION_TIMEOUT_MS),
                        loadRequestsRequest(PRIMARY_NOTIFICATION_TIMEOUT_MS)
                  ]);

                  const shouldWakeAndRetry = results.some((result) => (
                        result.status === 'rejected' && result.reason?.name === 'AbortError'
                  ));

                  if (shouldWakeAndRetry) {
                        await wakeBackend();
                        results = await Promise.allSettled([
                              loadNotificationsRequest(WAKE_NOTIFICATION_TIMEOUT_MS),
                              loadRequestsRequest(WAKE_NOTIFICATION_TIMEOUT_MS)
                        ]);
                  }

                  const [notificationsResult, requestsResult] = results;

                  if (notificationsResult.status === 'fulfilled') {
                        const { response, data } = notificationsResult.value;
                        if (response.ok && data?.success) {
                              const nextNotifications = data.data.notifications || [];
                              const nextUnreadCount = data.data.unreadCount || 0;
                              syncNotificationCache(nextNotifications, nextUnreadCount);
                        }
                  }

                  if (requestsResult.status === 'fulfilled') {
                        const { response, data } = requestsResult.value;
                        if (response.ok && data?.success) {
                              setPendingRequests(data.data.requests || []);
                        }
                  }

                  const notificationsFailed = notificationsResult.status === 'rejected'
                        || (notificationsResult.status === 'fulfilled' && (!notificationsResult.value.response.ok || !notificationsResult.value.data?.success));
                  const requestsFailed = requestsResult.status === 'rejected'
                        || (requestsResult.status === 'fulfilled' && (!requestsResult.value.response.ok || !requestsResult.value.data?.success));

                  if (notificationsFailed && requestsFailed && !hasCachedNotifications) {
                        setError('Inbox is taking longer than usual. Pull to refresh in a few seconds.');
                  }
            } catch (fetchError) {
                  console.error('Failed to fetch notifications:', fetchError);
                  if (!hasCachedNotifications) {
                        setError('Notifications could not be loaded right now. Showing cached activity if available.');
                  }
            } finally {
                  setLoading(false);
                  setSilentRefreshing(false);
            }
      }, [notifications.length, syncNotificationCache, token, user?._id, wakeBackend]);

      useEffect(() => {
            setNotifications(cachedInbox.notifications || []);
            setUnreadCount(cachedInbox.unreadCount || 0);
            setLoading((cachedInbox.notifications || []).length === 0 && Boolean(token && user?._id));
            fetchNotifications((cachedInbox.notifications || []).length === 0);
      }, [cachedInbox.notifications, cachedInbox.unreadCount, fetchNotifications, token, user?._id]);

      useEffect(() => {
            if (!socket || !user?._id) return undefined;

            const handleNotification = (payload) => {
                  if (!payload?._id) return;

                  setNotifications((prev) => {
                        const nextNotifications = [payload, ...prev.filter((entry) => entry._id !== payload._id)].slice(0, 40);
                        writeCachedNotifications(user._id, nextNotifications, unreadCount + (payload.isRead ? 0 : 1));
                        return nextNotifications;
                  });
                  setUnreadCount((prev) => prev + (payload.isRead ? 0 : 1));
                  fetchNotifications(false);
            };

            const handleNotificationRead = ({ ids }) => {
                  setNotifications((prev) => {
                        const nextNotifications = prev.map((entry) => (
                              !ids || ids.length === 0 || ids.includes(entry._id)
                                    ? { ...entry, isRead: true }
                                    : entry
                        ));
                        const nextUnreadCount = nextNotifications.filter((entry) => !entry.isRead).length;
                        writeCachedNotifications(user._id, nextNotifications, nextUnreadCount);
                        setUnreadCount(nextUnreadCount);
                        return nextNotifications;
                  });
            };

            const refreshInbox = () => fetchNotifications(false);

            socket.on('notification:new', handleNotification);
            socket.on('notification:read', handleNotificationRead);
            socket.on('connect', refreshInbox);

            return () => {
                  socket.off('notification:new', handleNotification);
                  socket.off('notification:read', handleNotificationRead);
                  socket.off('connect', refreshInbox);
            };
      }, [fetchNotifications, socket, unreadCount, user?._id]);

      const markNotificationRead = async (notificationId) => {
            if (!token || !notificationId) return;

            setNotifications((prev) => {
                  const nextNotifications = prev.map((entry) => (
                        entry._id === notificationId ? { ...entry, isRead: true } : entry
                  ));
                  const nextUnreadCount = nextNotifications.filter((entry) => !entry.isRead).length;
                  writeCachedNotifications(user?._id, nextNotifications, nextUnreadCount);
                  setUnreadCount(nextUnreadCount);
                  return nextNotifications;
            });

            try {
                  await fetch(`${API_URL}/notifications/${notificationId}/read`, {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${token}` }
                  });
            } catch {
                  // Optimistic update is enough here.
            }
      };

      const markAllRead = async () => {
            if (!token) return;

            const nextNotifications = notifications.map((entry) => ({ ...entry, isRead: true }));
            syncNotificationCache(nextNotifications, 0);

            try {
                  await fetch(`${API_URL}/notifications/read-all`, {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${token}` }
                  });
            } catch {
                  // Best-effort only.
            }
      };

      const handleRequestAction = async (requestUserId, action) => {
            if (!token || !requestUserId) return;

            setActionLoadingId(`${action}:${requestUserId}`);

            try {
                  const res = await fetch(`${API_URL}/users/requests/${requestUserId}/${action}`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                  });
                  const data = await res.json();

                  if (!data.success) {
                        throw new Error(data.message || 'Request update failed');
                  }

                  setPendingRequests((prev) => prev.filter((request) => request._id !== requestUserId));
                  fetchNotifications(false);
                  onProfileRefresh?.();
            } catch (requestError) {
                  console.error(`Failed to ${action} follow request:`, requestError);
                  setError(`Could not ${action} the follow request right now.`);
            } finally {
                  setActionLoadingId('');
            }
      };

      const handleOpenNotification = async (notification) => {
            if (!notification?.isRead) {
                  markNotificationRead(notification._id);
            }

            navigate(notification.actionUrl || '/profile');
      };

      if (loading) {
            return (
                  <div className="card animate-fadeInUp notification-panel">
                        <div className="notification-panel-head">
                              <div>
                                    <h2>Notifications</h2>
                                    <p>Loading your latest profile activity.</p>
                              </div>
                        </div>
                        <div className="notification-skeleton-list">
                              {Array.from({ length: 5 }).map((_, index) => (
                                    <div key={index} className="notification-skeleton-row" />
                              ))}
                        </div>
                  </div>
            );
      }

      return (
            <div className="card animate-fadeInUp notification-panel">
                  <div className="notification-panel-head">
                        <div>
                              <h2>Notifications</h2>
                              <p>{silentRefreshing ? 'Updating activity...' : `${unreadCount} unread updates in your profile inbox.`}</p>
                        </div>
                        <div className="notification-panel-actions">
                              <button type="button" className="btn btn-secondary" onClick={() => fetchNotifications(false)}>
                                    Refresh
                              </button>
                              <button type="button" className="btn btn-primary" onClick={markAllRead} disabled={notifications.length === 0 || unreadCount === 0}>
                                    Mark all read
                              </button>
                        </div>
                  </div>

                  {error && (
                        <div className="notification-inline-banner">
                              {error}
                        </div>
                  )}

                  {pendingRequests.length > 0 && (
                        <section className="notification-section">
                              <div className="notification-section-head">
                                    <strong>Pending follow requests</strong>
                                    <span>{pendingRequests.length}</span>
                              </div>

                              <div className="notification-request-list">
                                    {pendingRequests.map((requestUser) => (
                                          <div key={requestUser._id} className="notification-card notification-card--request">
                                                <div className="notification-card-main">
                                                      <UserAvatar user={requestUser} size={52} />
                                                      <div className="notification-card-copy">
                                                            <strong>{requestUser.displayName || requestUser.username}</strong>
                                                            <p>@{requestUser.username} wants to follow you.</p>
                                                      </div>
                                                </div>
                                                <div className="notification-request-actions">
                                                      <button
                                                            type="button"
                                                            className="btn btn-primary"
                                                            disabled={actionLoadingId === `accept:${requestUser._id}` || !!actionLoadingId}
                                                            onClick={() => handleRequestAction(requestUser._id, 'accept')}
                                                      >
                                                            {actionLoadingId === `accept:${requestUser._id}` ? 'Accepting...' : 'Accept'}
                                                      </button>
                                                      <button
                                                            type="button"
                                                            className="btn btn-ghost"
                                                            disabled={actionLoadingId === `reject:${requestUser._id}` || !!actionLoadingId}
                                                            onClick={() => handleRequestAction(requestUser._id, 'reject')}
                                                      >
                                                            {actionLoadingId === `reject:${requestUser._id}` ? 'Declining...' : 'Decline'}
                                                      </button>
                                                </div>
                                          </div>
                                    ))}
                              </div>
                        </section>
                  )}

                  <section className="notification-section">
                        <div className="notification-section-head">
                              <strong>Recent activity</strong>
                              <span>{notifications.length}</span>
                        </div>

                        {notifications.length === 0 ? (
                              <div className="empty-state" style={{ paddingBlock: '2rem' }}>
                                    <div className="empty-state-icon">Inbox</div>
                                    <h3 className="text-lg font-semibold mb-sm">No notifications yet</h3>
                                    <p className="text-secondary">Follow requests, comments, follows and profile activity will land here.</p>
                              </div>
                        ) : (
                              <div className="notification-list">
                                    {notifications.map((notification) => (
                                          <button
                                                key={notification._id}
                                                type="button"
                                                className={`notification-card ${notification.isRead ? '' : 'unread'}`}
                                                onClick={() => handleOpenNotification(notification)}
                                          >
                                                <div className="notification-card-main">
                                                      <UserAvatar user={notification.actor || { username: 'Z', displayName: 'ZUNO' }} size={48} />
                                                      <div className="notification-card-copy">
                                                            <div className="notification-card-topline">
                                                                  <strong>{notification.title}</strong>
                                                                  {!notification.isRead && <span className="notification-dot" />}
                                                            </div>
                                                            <p>{notification.body}</p>
                                                            <span>{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span>
                                                      </div>
                                                </div>
                                          </button>
                                    ))}
                              </div>
                        )}
                  </section>
            </div>
      );
};

export default NotificationPanel;
