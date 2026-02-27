import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useState, useEffect } from 'react';
import zunoLogo from '../../assets/zuno-logo.png';

const Layout = () => {
      const { user, isAuthenticated, logout } = useAuth();
      const { t } = useLanguage();
      const navigate = useNavigate();
      const location = useLocation();
      const [scrolled, setScrolled] = useState(false);

      useEffect(() => {
            const handleScroll = () => {
                  setScrolled(window.scrollY > 20);
            };
            window.addEventListener('scroll', handleScroll);
            return () => window.removeEventListener('scroll', handleScroll);
      }, []);

      const handleLogout = () => {
            logout();
            navigate('/login');
      };

      const isActive = (path) => location.pathname === path;

      // SVG Icons for cleaner look
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

      const PlusIcon = () => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" />
            </svg>
      );

      const SettingsIcon = () => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
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
                                    <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
                                          🏠 {t('home')}
                                    </Link>
                                    {isAuthenticated ? (
                                          <>
                                                <Link to="/upload" className={`nav-link ${isActive('/upload') ? 'active' : ''}`}>
                                                      ➕ {t('upload')}
                                                </Link>
                                                <Link to="/profile" className={`nav-link ${isActive('/profile') ? 'active' : ''}`}>
                                                      👤 {t('profile')}
                                                </Link>
                                                <Link to="/settings" className={`nav-link ${isActive('/settings') ? 'active' : ''}`}>
                                                      ⚙️ {t('settings')}
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
                        <Outlet />
                  </main>

                  {/* Mobile Bottom Navigation */}
                  <nav className="bottom-nav">
                        <Link to="/" className={`bottom-nav-item ${isActive('/') ? 'active' : ''}`}>
                              <HomeIcon />
                              <span style={{ fontSize: '10px' }}>{t('home')}</span>
                        </Link>
                        <Link to="/search" className={`bottom-nav-item ${isActive('/search') ? 'active' : ''}`}>
                              <SearchIcon />
                              <span style={{ fontSize: '10px' }}>{t('search')}</span>
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
                        {isAuthenticated ? (
                              <Link to="/saved" className={`bottom-nav-item ${isActive('/saved') ? 'active' : ''}`}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill={isActive('/saved') ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                    </svg>
                                    <span style={{ fontSize: '10px' }}>Saved</span>
                              </Link>
                        ) : (
                              <Link to="/register" className={`bottom-nav-item ${isActive('/register') ? 'active' : ''}`}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                          <circle cx="8.5" cy="7" r="4"></circle>
                                          <line x1="20" y1="8" x2="20" y2="14"></line>
                                          <line x1="23" y1="11" x2="17" y2="11"></line>
                                    </svg>
                                    <span style={{ fontSize: '10px' }}>Register</span>
                              </Link>
                        )}
                        <Link to="/settings" className={`bottom-nav-item ${isActive('/settings') ? 'active' : ''}`}>
                              <SettingsIcon />
                              <span style={{ fontSize: '10px' }}>{t('settings')}</span>
                        </Link>
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
