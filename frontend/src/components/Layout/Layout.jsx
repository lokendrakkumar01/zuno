import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import { useLanguage } from '../../context/LanguageContext';
import { useState, useEffect, useCallback } from 'react';
import zunoLogo from '../../assets/zuno-logo.png';
import { API_URL } from '../../config';
import { motion, AnimatePresence } from 'framer-motion';

const Layout = () => {
      const { user, isAuthenticated, logout, token } = useAuth();
      const { socket } = useSocketContext();
      const { t } = useLanguage();
      const navigate = useNavigate();
      const location = useLocation();
      const [scrolled, setScrolled] = useState(false);
      const [unreadCount, setUnreadCount] = useState(0);

      useEffect(() => {
            const handleScroll = () => setScrolled(window.scrollY > 20);
            window.addEventListener('scroll', handleScroll, { passive: true });
            return () => window.removeEventListener('scroll', handleScroll);
      }, []);

      // Fetch unread message count
      const fetchUnread = useCallback(async () => {
            if (!isAuthenticated || !token) return;
            try {
                  const res = await fetch(`${API_URL}/messages/unread/count`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) setUnreadCount(data.data.unreadCount);
            } catch (err) { /* silently fail */ }
      }, [isAuthenticated, token]);

      useEffect(() => {
            fetchUnread();
            const interval = setInterval(fetchUnread, 30000);
            return () => clearInterval(interval);
      }, [fetchUnread]);

      // Socket listener for real-time unread updates
      useEffect(() => {
            if (!socket) return;
            const handleNewMessage = () => setTimeout(fetchUnread, 300);
            socket.on('newMessage', handleNewMessage);
            socket.on('messageRead', fetchUnread);
            return () => {
                  socket.off('newMessage', handleNewMessage);
                  socket.off('messageRead', fetchUnread);
            };
      }, [socket, fetchUnread]);

      const handleLogout = () => {
            logout();
            navigate('/login');
      };

      // Check if path is active (supports nested routes like /messages/:id)
      const isActive = (path) => {
            if (path === '/') return location.pathname === '/';
            return location.pathname.startsWith(path);
      };

      // SVG Icons
      const HomeIcon = () => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
      );

      const SearchIcon = () => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
            </svg>
      );

      const StatusIcon = () => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
            </svg>
      );

      const PlusIcon = () => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" />
            </svg>
      );

      const MessagesIcon = () => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
      );

      return (
            <div className="app">
                  {/* Header */}
                  <header className={`header ${scrolled ? 'scrolled' : ''}`}>
                        <div className="container header-inner">
                              <Link to="/" className="logo">
                                    <img src={zunoLogo} alt="ZUNO" style={{ height: '40px', borderRadius: '8px' }} />
                                    <span>ZUNO</span>
                              </Link>

                              {/* Desktop Navigation */}
                              <nav className="nav">
                                    <Link to="/" className={`nav-link ${isActive('/') && location.pathname === '/' ? 'active' : ''}`}>
                                          🏠 {t('home')}
                                    </Link>
                                    {isAuthenticated ? (
                                          <>
                                                <Link to="/status" className={`nav-link ${isActive('/status') ? 'active' : ''}`}>
                                                      ⭕ Status
                                                </Link>
                                                <Link to="/messages" className={`nav-link ${isActive('/messages') ? 'active' : ''}`} style={{ position: 'relative' }}>
                                                      💬 Messages
                                                      {unreadCount > 0 && (
                                                            <span className="nav-unread-badge" style={{
                                                                  position: 'absolute',
                                                                  top: '-6px',
                                                                  right: '-10px',
                                                                  background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                                                                  color: '#fff',
                                                                  borderRadius: '99px',
                                                                  fontSize: '10px',
                                                                  fontWeight: 700,
                                                                  padding: '1px 5px',
                                                                  minWidth: '16px',
                                                                  textAlign: 'center',
                                                                  lineHeight: '14px'
                                                            }}>
                                                                  {unreadCount > 99 ? '99+' : unreadCount}
                                                            </span>
                                                      )}
                                                </Link>
                                                <Link to="/upload" className={`nav-link ${isActive('/upload') ? 'active' : ''}`}>
                                                      ➕ {t('upload')}
                                                </Link>
                                                <Link to="/live" className={`nav-link ${isActive('/live') ? 'active' : ''}`}>
                                                      🔴 Live
                                                </Link>
                                                <Link to="/profile" className={`nav-link ${isActive('/profile') ? 'active' : ''}`}>
                                                      👤 {t('profile')}
                                                </Link>
                                                {user?.role === 'admin' && (
                                                      <Link to="/admin" className="nav-link" style={{ color: 'var(--color-accent-pink)' }}>
                                                            👑 {t('admin')}
                                                      </Link>
                                                )}
                                                <div className="flex items-center gap-sm" style={{ marginLeft: 'var(--space-sm)' }}>
                                                      <div className="avatar avatar-sm" style={{ cursor: 'pointer', overflow: 'hidden' }} onClick={() => navigate('/profile')}>
                                                            {user?.avatar ? (
                                                                  <img src={user.avatar} alt={user.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                  user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U'
                                                            )}
                                                      </div>
                                                </div>
                                          </>
                                    ) : (
                                          <>
                                                <Link to="/login" className="btn btn-ghost btn-sm">{t('login')}</Link>
                                                <Link to="/register" className="btn btn-primary btn-sm">
                                                      {t('join')}
                                                </Link>
                                          </>
                                    )}
                              </nav>
                        </div>
                  </header>

                  {/* Main Content */}
                  <main className="main">
                        <AnimatePresence mode="wait">
                              <motion.div
                                    key={location.pathname}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.15 }}
                                    style={{ width: '100%', height: '100%' }}
                              >
                                    <Outlet />
                              </motion.div>
                        </AnimatePresence>
                  </main>

                  {/* Mobile Bottom Navigation */}
                  <nav className="bottom-nav">
                        <Link to="/" className={`bottom-nav-item ${location.pathname === '/' ? 'active' : ''}`}>
                              <HomeIcon />
                              <span style={{ fontSize: '10px' }}>{t('home')}</span>
                        </Link>
                        <Link to="/search" className={`bottom-nav-item ${isActive('/search') ? 'active' : ''}`}>
                              <SearchIcon />
                              <span style={{ fontSize: '10px' }}>{t('search')}</span>
                        </Link>
                        <Link to="/live" className={`bottom-nav-item ${isActive('/live') ? 'active' : ''}`}>
                              <div style={{ fontSize: '16px', lineHeight: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔴</div>
                              <span style={{ fontSize: '10px' }}>Live</span>
                        </Link>

                        {isAuthenticated ? (
                              <Link to="/upload" className={`bottom-nav-item ${isActive('/upload') ? 'active' : ''}`}>
                                    <div style={{
                                          background: 'var(--gradient-primary)',
                                          borderRadius: '12px',
                                          padding: '10px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
                                    }}>
                                          <PlusIcon />
                                    </div>
                              </Link>
                        ) : (
                              <Link to="/login" className={`bottom-nav-item ${isActive('/login') ? 'active' : ''}`}>
                                    <div style={{
                                          background: 'var(--gradient-primary)',
                                          borderRadius: '12px',
                                          padding: '10px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
                                    }}>
                                          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                                <path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z" />
                                          </svg>
                                    </div>
                                    <span style={{ fontSize: '10px' }}>Login</span>
                              </Link>
                        )}

                        {/* Messages with unread badge */}
                        <Link to="/messages" className={`bottom-nav-item ${isActive('/messages') ? 'active' : ''}`} style={{ position: 'relative' }}>
                              <div style={{ position: 'relative' }}>
                                    <MessagesIcon />
                                    {unreadCount > 0 && (
                                          <span style={{
                                                position: 'absolute',
                                                top: '-6px',
                                                right: '-8px',
                                                background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                                                color: '#fff',
                                                borderRadius: '99px',
                                                fontSize: '9px',
                                                fontWeight: 700,
                                                padding: '1px 4px',
                                                minWidth: '14px',
                                                textAlign: 'center',
                                                lineHeight: '12px'
                                          }}>
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                          </span>
                                    )}
                              </div>
                              <span style={{ fontSize: '10px' }}>Messages</span>
                        </Link>

                        {/* Profile */}
                        <Link to="/profile" className={`bottom-nav-item ${isActive('/profile') ? 'active' : ''}`}>
                              <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    background: 'var(--gradient-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: isActive('/profile') ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                              }}>
                                    {user?.avatar ? (
                                          <img src={user.avatar} alt={user?.displayName || 'User'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : isAuthenticated ? (
                                          <span style={{ fontSize: '14px', color: 'white', fontWeight: 'bold' }}>
                                                {user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                                          </span>
                                    ) : (
                                          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                          </svg>
                                    )}
                              </div>
                        </Link>
                  </nav>
            </div>
      );
};

export default Layout;
