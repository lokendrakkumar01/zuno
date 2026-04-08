import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import zunoLogo from '../../assets/zuno-logo.png';

const Login = () => {
      const [email, setEmail] = useState('');
      const [password, setPassword] = useState('');
      const [showPassword, setShowPassword] = useState(false);
      const [error, setError] = useState('');
      const [loading, setLoading] = useState(false);
      const [wakingUp, setWakingUp] = useState(false);
      const [retryInfo, setRetryInfo] = useState(null); // { attempt, maxRetries, retryIn }
      const [countdown, setCountdown] = useState(0);
      const countdownRef = useRef(null);
      const { login } = useAuth();
      const { t } = useLanguage();
      const navigate = useNavigate();

      // Countdown timer for retry
      useEffect(() => {
            if (countdown > 0) {
                  countdownRef.current = setTimeout(() => setCountdown(c => c - 1), 1000);
            }
            return () => clearTimeout(countdownRef.current);
      }, [countdown]);

      const handleSubmit = async (e) => {
            e.preventDefault();
            setError('');
            setWakingUp(false);
            setRetryInfo(null);
            setCountdown(0);
            setLoading(true);

            const result = await login(email, password, (info) => {
                  // Called when auto-retry is happening
                  setWakingUp(true);
                  setRetryInfo(info);
                  setCountdown(info.retryIn);
                  setError(`⏳ Server is waking up... Auto-retrying (${info.attempt}/${info.maxRetries})`);
            });

            if (result.success) {
                  navigate('/');
            } else {
                  if (result.status === 'waking_up') {
                        setWakingUp(true);
                        setError('Server is still waking up. Please click Login again in 30 seconds.');
                  } else {
                        setWakingUp(false);
                        setError(result.message || 'Login failed. Please check your credentials.');
                  }
            }
            setLoading(false);
            setRetryInfo(null);
      };

      const getButtonLabel = () => {
            if (!loading) return `✨ ${t('login')}`;
            if (wakingUp && retryInfo) {
                  return (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '18px' }}>⏳</span>
                              Retrying ({retryInfo.attempt}/{retryInfo.maxRetries})
                              {countdown > 0 && <span style={{ fontSize: '13px', opacity: 0.75 }}>in {countdown}s</span>}
                        </span>
                  );
            }
            return (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>⏳</span>
                        Signing in…
                  </span>
            );
      };

      return (
            <div className="auth-page">
                  {/* Background Elements */}
                  <div style={{
                        position: 'fixed', top: '20%', left: '10%',
                        width: '300px', height: '300px',
                        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)',
                        animation: 'float 8s ease-in-out infinite', zIndex: 0
                  }} />
                  <div style={{
                        position: 'fixed', bottom: '20%', right: '10%',
                        width: '250px', height: '250px',
                        background: 'radial-gradient(circle, rgba(236, 72, 153, 0.08) 0%, transparent 70%)',
                        animation: 'float 6s ease-in-out infinite reverse', zIndex: 0
                  }} />

                  <div className="auth-card" style={{ position: 'relative', zIndex: 1 }}>
                        <Link to="/welcome" className="logo" style={{ justifyContent: 'center', marginBottom: 'var(--space-xl)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <img src={zunoLogo} alt="ZUNO" className="animate-pulse" style={{ height: '50px', borderRadius: '8px' }} />
                              <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-accent-primary)' }}>ZUNO</span>
                        </Link>

                        <h1 className="auth-title animate-fadeInUp">Welcome Back</h1>
                        <p className="auth-subtitle animate-fadeInUp">Continue your journey with ZUNO</p>

                        {/* Error / Waking Up Banner */}
                        {error && (
                              <div
                                    className="card p-md mb-lg animate-fadeIn"
                                    style={{
                                          background: wakingUp ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                          borderColor: wakingUp ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                                          display: 'flex', alignItems: 'flex-start', gap: '10px'
                                    }}
                              >
                                    <span style={{ fontSize: '18px', flexShrink: 0 }}>
                                          {wakingUp ? '⏳' : '⚠️'}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                          <p style={{
                                                color: wakingUp ? '#f59e0b' : '#ef4444',
                                                fontSize: 'var(--font-size-sm)', margin: 0, fontWeight: 500
                                          }}>{error}</p>

                                          {/* Waking up progress bar */}
                                          {wakingUp && retryInfo && (
                                                <div style={{ marginTop: '8px' }}>
                                                      <div style={{
                                                            height: '3px',
                                                            background: 'rgba(245,158,11,0.2)',
                                                            borderRadius: '99px',
                                                            overflow: 'hidden'
                                                      }}>
                                                            <div style={{
                                                                  height: '100%',
                                                                  width: `${((retryInfo.attempt - 1) / retryInfo.maxRetries) * 100}%`,
                                                                  background: '#f59e0b',
                                                                  borderRadius: '99px',
                                                                  transition: 'width 0.5s ease'
                                                            }} />
                                                      </div>
                                                </div>
                                          )}
                                    </div>
                                    {!loading && (
                                          <button
                                                onClick={() => { setError(''); setWakingUp(false); setRetryInfo(null); setCountdown(0); }}
                                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0, flexShrink: 0 }}
                                          >✕</button>
                                    )}
                              </div>
                        )}

                        <form onSubmit={handleSubmit} className="auth-form">
                              <div className="input-group animate-fadeInUp stagger-2">
                                    <label className="input-label">Email Address</label>
                                    <input
                                          type="email"
                                          className="input"
                                          placeholder="Enter your email"
                                          value={email}
                                          onChange={(e) => { setEmail(e.target.value); if (error && !wakingUp) setError(''); }}
                                          required
                                          autoComplete="email"
                                          disabled={loading}
                                    />
                              </div>

                              <div className="input-group animate-fadeInUp stagger-3">
                                    <label className="input-label">Password</label>
                                    <div style={{ position: 'relative' }}>
                                          <input
                                                type={showPassword ? 'text' : 'password'}
                                                className="input"
                                                placeholder="Enter your password"
                                                value={password}
                                                onChange={(e) => { setPassword(e.target.value); if (error && !wakingUp) setError(''); }}
                                                required
                                                autoComplete="current-password"
                                                disabled={loading}
                                                style={{ width: '100%', paddingRight: '48px' }}
                                          />
                                          <button
                                                type="button"
                                                onClick={() => setShowPassword(p => !p)}
                                                disabled={loading}
                                                style={{
                                                      position: 'absolute', right: '12px', top: '50%',
                                                      transform: 'translateY(-50%)',
                                                      background: 'none', border: 'none',
                                                      color: '#64748b', cursor: 'pointer', fontSize: '16px',
                                                      lineHeight: 1, padding: '4px'
                                                }}
                                                title={showPassword ? 'Hide password' : 'Show password'}
                                          >
                                                {showPassword ? '🙈' : '👁️'}
                                          </button>
                                    </div>
                              </div>

                              <button
                                    type="submit"
                                    className="btn btn-primary btn-lg animate-fadeInUp stagger-4"
                                    disabled={loading}
                                    style={{ width: '100%', marginTop: 'var(--space-md)' }}
                              >
                                    {getButtonLabel()}
                              </button>
                        </form>

                        <div className="auth-divider mt-xl mb-lg animate-fadeIn">
                              <span>{t('newToZuno')}</span>
                        </div>

                        <Link
                              to="/register"
                              className="btn btn-secondary animate-fadeInUp"
                              style={{ width: '100%' }}
                        >
                              🚀 {t('createAccount')}
                        </Link>

                        {/* Trust Badges */}
                        <div className="flex justify-center gap-lg mt-xl animate-fadeIn" style={{ opacity: 0.6 }}>
                              <span className="text-xs">🔒 Secure</span>
                              <span className="text-xs">🧘 No Tracking</span>
                              <span className="text-xs">💚 Privacy First</span>
                        </div>
                  </div>
            </div>
      );
};

export default Login;
