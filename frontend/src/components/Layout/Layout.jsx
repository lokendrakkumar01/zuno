import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import zunoLogo from '../../assets/zuno-logo.png';
import { API_URL } from '../../config';

const navItems = [
      {
            path: '/',
            label: 'Home',
            match: (pathname) => pathname === '/',
            icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 10.5 12 3l9 7.5" />
                        <path d="M5 9.5V20h14V9.5" />
                  </svg>
            )
      },
      {
            path: '/search',
            label: 'Search',
            match: (pathname) => pathname.startsWith('/search'),
            icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" />
                  </svg>
            )
      },
      {
            path: '/status',
            label: 'Status',
            match: (pathname) => pathname.startsWith('/status'),
            icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                  </svg>
            )
      },
      {
            path: '/messages',
            label: 'Messages',
            match: (pathname) => pathname.startsWith('/messages'),
            icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
                  </svg>
            )
      },
      {
            path: '/live',
            label: 'Live',
            match: (pathname) => pathname.startsWith('/live'),
            icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M5 12a7 7 0 0 1 7-7" />
                        <path d="M19 12a7 7 0 0 0-7-7" />
                        <path d="M2 12A10 10 0 0 1 12 2" />
                        <path d="M22 12A10 10 0 0 0 12 2" />
                  </svg>
            )
      }
];

const Layout = () => {
      const { user, isAuthenticated, logout, token } = useAuth();
      const { socket, isConnected, onlineUsers } = useSocketContext();
      const { t } = useLanguage();
      const { theme, toggleTheme } = useTheme();
      const navigate = useNavigate();
      const location = useLocation();
      const [scrolled, setScrolled] = useState(false);
      const [unreadCount, setUnreadCount] = useState(0);

      useEffect(() => {
            const handleScroll = () => setScrolled(window.scrollY > 12);
            window.addEventListener('scroll', handleScroll, { passive: true });
            return () => window.removeEventListener('scroll', handleScroll);
      }, []);

      const fetchUnread = useCallback(async () => {
            if (!isAuthenticated || !token) return;

            try {
                  const res = await fetch(`${API_URL}/messages/unread/count`, {
                        headers: { Authorization: `Bearer ${token}` }
                  });
                  const data = await res.json();

                  if (data.success) {
                        setUnreadCount(data.data.unreadCount || 0);
                  }
            } catch {
                  // Keep the last known value for a smoother shell.
            }
      }, [isAuthenticated, token]);

      useEffect(() => {
            fetchUnread();
            const interval = setInterval(fetchUnread, 30000);
            return () => clearInterval(interval);
      }, [fetchUnread]);

      useEffect(() => {
            if (!socket) return;

            const syncUnread = () => window.setTimeout(fetchUnread, 250);
            socket.on('newMessage', syncUnread);
            socket.on('newGroupMessage', syncUnread);
            socket.on('messageRead', syncUnread);

            return () => {
                  socket.off('newMessage', syncUnread);
                  socket.off('newGroupMessage', syncUnread);
                  socket.off('messageRead', syncUnread);
            };
      }, [socket, fetchUnread]);

      const isActive = (item) => item.match(location.pathname);
      const profileLabel = user?.displayName || user?.username || 'Profile';
      const activeUserCount = onlineUsers.length;
      const activeUserLabel = activeUserCount === 1 ? '1 user active' : `${activeUserCount} users active`;

      const ThemeIcon = () =>
            theme === 'light' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
                  </svg>
            ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                  </svg>
            );

      const renderNavLink = (item, mobile = false) => (
            <Link
                  key={`${mobile ? 'mobile' : 'desktop'}-${item.path}`}
                  to={item.path}
                  className={`${mobile ? 'bottom-nav-item' : 'nav-link'} ${isActive(item) ? 'active' : ''}`}
            >
                  <span className="nav-icon-wrap">
                        {item.icon}
                        {item.path === '/messages' && unreadCount > 0 && (
                              <span className="nav-unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                        )}
                  </span>
                  <span>{item.path === '/' ? t('home') : item.path === '/search' ? t('search') : item.label}</span>
            </Link>
      );

      return (
            <div className="app-shell">
                  <header className={`header ${scrolled ? 'scrolled' : ''}`}>
                        <div className="container header-inner">
                              <div className="header-brand-cluster">
                                    <Link to="/" className="logo">
                                          <img src={zunoLogo} alt="ZUNO" className="logo-image" />
                                          <div className="logo-copy">
                                                <span>ZUNO</span>
                                                <small>Social, chat, live and calls</small>
                                          </div>
                                    </Link>

                                    {isAuthenticated && (
                                          <div className={`header-status-pill ${isConnected ? 'online' : 'offline'}`}>
                                                <span className="status-dot" />
                                                <span>{isConnected ? activeUserLabel : 'Realtime reconnecting'}</span>
                                          </div>
                                    )}
                              </div>

                              <nav className="nav nav-desktop">
                                    {navItems.map((item) => renderNavLink(item))}
                              </nav>

                              <div className="header-actions">
                                    {isAuthenticated ? (
                                          <>
                                                <button
                                                      type="button"
                                                      onClick={() => navigate('/upload')}
                                                      className="shell-upload-btn"
                                                >
                                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M12 5v14M5 12h14" />
                                                      </svg>
                                                      <span>{t('upload')}</span>
                                                </button>

                                                <button
                                                      type="button"
                                                      onClick={toggleTheme}
                                                      className="theme-toggle-btn shell-icon-btn"
                                                      aria-label="Toggle theme"
                                                >
                                                      <ThemeIcon />
                                                </button>

                                                <button
                                                      type="button"
                                                      onClick={() => navigate('/profile')}
                                                      className="shell-profile-btn"
                                                      aria-label={profileLabel}
                                                >
                                                      <span className="shell-profile-copy">
                                                            <strong>{profileLabel}</strong>
                                                            <small>@{user?.username}</small>
                                                      </span>
                                                      <span className="avatar avatar-sm shell-avatar">
                                                            {user?.avatar ? (
                                                                  <img src={user.avatar} alt={profileLabel} />
                                                            ) : (
                                                                  (user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U').toUpperCase()
                                                            )}
                                                      </span>
                                                </button>

                                                <button
                                                      type="button"
                                                      onClick={() => {
                                                            logout();
                                                            navigate('/login');
                                                      }}
                                                      className="shell-icon-btn"
                                                      aria-label="Log out"
                                                >
                                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                                            <path d="m16 17 5-5-5-5" />
                                                            <path d="M21 12H9" />
                                                      </svg>
                                                </button>
                                          </>
                                    ) : (
                                          <>
                                                <button
                                                      type="button"
                                                      onClick={toggleTheme}
                                                      className="theme-toggle-btn shell-icon-btn"
                                                      aria-label="Toggle theme"
                                                >
                                                      <ThemeIcon />
                                                </button>
                                                <Link to="/login" className="btn btn-ghost btn-sm">{t('login')}</Link>
                                                <Link to="/register" className="btn btn-primary btn-sm">{t('join')}</Link>
                                          </>
                                    )}
                              </div>
                        </div>
                  </header>

                  <main className="main">
                        <AnimatePresence mode="wait">
                              <motion.div
                                    key={location.pathname}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.16 }}
                                    style={{ width: '100%', height: '100%' }}
                              >
                                    <Outlet />
                              </motion.div>
                        </AnimatePresence>
                  </main>

                  <nav className="bottom-nav">
                        {renderNavLink(navItems[0], true)}
                        {renderNavLink(navItems[1], true)}

                        <Link to={isAuthenticated ? '/upload' : '/login'} className="bottom-nav-item bottom-nav-create">
                              <span className="bottom-nav-create-pill">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M12 5v14M5 12h14" />
                                    </svg>
                              </span>
                              <span>{isAuthenticated ? 'Create' : 'Login'}</span>
                        </Link>

                        {renderNavLink(navItems[3], true)}

                        <Link to="/profile" className={`bottom-nav-item ${location.pathname.startsWith('/profile') || location.pathname.startsWith('/u/') ? 'active' : ''}`}>
                              <span className="nav-icon-wrap bottom-profile-avatar">
                                    {user?.avatar ? (
                                          <img src={user.avatar} alt={profileLabel} />
                                    ) : (
                                          <span>{(user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U').toUpperCase()}</span>
                                    )}
                              </span>
                              <span>Profile</span>
                        </Link>
                  </nav>
            </div>
      );
};

export default Layout;
