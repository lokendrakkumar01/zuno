import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';
import zunoLogo from '../../assets/zuno-logo.png';

const Layout = () => {
      const { user, isAuthenticated, logout } = useAuth();
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
                                          🏠 Home
                                    </Link>
                                    {isAuthenticated ? (
                                          <>
                                                <Link to="/upload" className={`nav-link ${isActive('/upload') ? 'active' : ''}`}>
                                                      ➕ Upload
                                                </Link>
                                                <Link to="/profile" className={`nav-link ${isActive('/profile') ? 'active' : ''}`}>
                                                      👤 Profile
                                                </Link>
                                                {user?.role === 'admin' && (
                                                      <Link to="/admin" className="nav-link" style={{ color: 'var(--color-accent-pink)' }}>
                                                            ⚙️ Admin
                                                      </Link>
                                                )}
                                                <div className="flex items-center gap-sm" style={{ marginLeft: 'var(--space-sm)' }}>
                                                      <div className="avatar avatar-sm" style={{ cursor: 'pointer' }} onClick={() => navigate('/profile')}>
                                                            {user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                                                      </div>
                                                </div>
                                          </>
                                    ) : (
                                          <>
                                                <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
                                                <Link to="/register" className="btn btn-primary btn-sm">
                                                      Join ZUNO
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
                              <span className="bottom-nav-icon">🏠</span>
                        </Link>
                        <Link to="/search" className="bottom-nav-item">
                              <span className="bottom-nav-icon">🔍</span>
                        </Link>
                        <Link to="/upload" className={`bottom-nav-item ${isActive('/upload') ? 'active' : ''}`}>
                              <span className="bottom-nav-icon">➕</span>
                        </Link>
                        <Link to="/settings" className={`bottom-nav-item ${isActive('/settings') ? 'active' : ''}`}>
                              <span className="bottom-nav-icon">⚙️</span>
                        </Link>
                        <Link to="/profile" className={`bottom-nav-item ${isActive('/profile') ? 'active' : ''}`}>
                              <div className="avatar avatar-sm" style={{ width: '24px', height: '24px' }}>
                                    {user?.displayName?.charAt(0) || 'U'}
                              </div>
                        </Link>
                  </nav>
            </div>
      );
};

export default Layout;
