import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocketContext } from '../../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../config';
import { useAuth } from '../../context/AuthContext';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

const NotificationDropdown = () => {
  const { notifications, unreadCount, markAllRead, markNotificationRead, setNotifications, setUnreadCount } = useSocketContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { token } = useAuth();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchInitialNotifications = async () => {
    if (!token || notifications.length > 0) return;
    setIsLoading(true);
    try {
      const res = await fetchWithTimeout(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications || []);
        setUnreadCount(data.data.unreadCount || 0);
      }
    } catch (e) {
      console.warn('Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDropdown = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && notifications.length === 0) {
      fetchInitialNotifications();
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      markNotificationRead(notif._id);
      try {
        await fetchWithTimeout(`${API_URL}/notifications/${notif._id}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {}
    }
    setIsOpen(false);
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
  };

  const handleMarkAllRead = async () => {
    markAllRead();
    try {
      await fetchWithTimeout(`${API_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {}
  };

  const getIcon = (type) => {
    switch (type) {
      case 'follow': return '👤';
      case 'like': return '❤️';
      case 'comment': return '💬';
      case 'message': return '✉️';
      default: return '🔔';
    }
  };

  return (
    <div className="notification-dropdown-wrapper" ref={dropdownRef}>
      <button type="button" className="shell-icon-btn" onClick={toggleDropdown} aria-label="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="nav-unread-badge notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="notification-dropdown-panel"
          >
            <div className="notification-header">
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button type="button" onClick={handleMarkAllRead} className="mark-read-btn">
                  Mark all read
                </button>
              )}
            </div>

            <div className="notification-list">
              {isLoading && <div className="notification-empty">Loading...</div>}
              {!isLoading && notifications.length === 0 && (
                <div className="notification-empty">No new notifications</div>
              )}
              {notifications.map((notif) => (
                <div
                  key={notif._id}
                  className={`notification-item ${!notif.isRead ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="notification-icon">{getIcon(notif.type)}</div>
                  <div className="notification-content">
                    <p className="notification-title">{notif.title}</p>
                    <p className="notification-body">{notif.body}</p>
                  </div>
                  {!notif.isRead && <div className="notification-unread-dot" />}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .notification-dropdown-wrapper { position: relative; }
        .notification-badge { position: absolute; top: 0; right: 0; transform: translate(25%, -25%); font-size: 0.65rem; padding: 2px 5px; }
        .notification-dropdown-panel {
          position: absolute; top: calc(100% + 10px); right: -60px; width: 340px;
          background: var(--color-bg-primary); border: 1px solid var(--color-border);
          border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.15);
          z-index: 100; overflow: hidden; display: flex; flex-direction: column;
        }
        @media (max-width: 768px) {
          .notification-dropdown-panel { position: fixed; top: 70px; right: 10px; left: 10px; width: auto; max-width: none; }
        }
        .notification-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 16px; border-bottom: 1px solid var(--color-border-light);
          background: var(--color-bg-secondary);
        }
        .notification-header h3 { margin: 0; font-size: 0.95rem; font-weight: 600; }
        .mark-read-btn { background: none; border: none; color: var(--color-primary); font-size: 0.8rem; cursor: pointer; }
        .mark-read-btn:hover { text-decoration: underline; }
        .notification-list { max-height: 400px; overflow-y: auto; }
        .notification-empty { padding: 30px; text-align: center; color: var(--color-text-muted); font-size: 0.85rem; }
        .notification-item {
          display: flex; gap: 12px; padding: 12px 16px; align-items: flex-start;
          border-bottom: 1px solid var(--color-border-light); cursor: pointer; transition: background 0.2s;
        }
        .notification-item:hover { background: var(--color-bg-hover); }
        .notification-item.unread { background: rgba(var(--color-primary-rgb), 0.05); }
        .notification-icon { font-size: 1.2rem; background: var(--color-bg-secondary); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
        .notification-content { flex: 1; }
        .notification-title { margin: 0 0 4px 0; font-size: 0.85rem; font-weight: 600; color: var(--color-text-primary); }
        .notification-body { margin: 0; font-size: 0.8rem; color: var(--color-text-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .notification-unread-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-primary); margin-top: 6px; }
      `}</style>
    </div>
  );
};

export default NotificationDropdown;
