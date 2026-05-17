import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import zunoLogo from '../../assets/zuno-logo.png';

const VerifyEmail = () => {
      const [params] = useSearchParams();
      const initialEmail = useMemo(() => params.get('email') || '', [params]);
      const [email, setEmail] = useState(initialEmail);
      const [otp, setOtp] = useState('');
      const [message, setMessage] = useState('');
      const [error, setError] = useState('');
      const [loading, setLoading] = useState(false);
      const [resending, setResending] = useState(false);
      const [cooldown, setCooldown] = useState(0);
      const timerRef = useRef(null);
      const { verifyEmailOtp, resendOtp, isAuthenticated } = useAuth();
      const navigate = useNavigate();

      useEffect(() => {
            if (isAuthenticated) navigate('/', { replace: true });
      }, [isAuthenticated, navigate]);

      useEffect(() => {
            if (cooldown <= 0) return undefined;
            timerRef.current = window.setTimeout(() => setCooldown((current) => current - 1), 1000);
            return () => window.clearTimeout(timerRef.current);
      }, [cooldown]);

      const handleOtpChange = (event) => {
            const nextOtp = event.target.value.replace(/\D/g, '').slice(0, 6);
            setOtp(nextOtp);
            if (error) setError('');
            if (message) setMessage('');
      };

      const handleSubmit = async (event) => {
            event.preventDefault();
            const normalizedEmail = email.trim().toLowerCase();

            if (!normalizedEmail || otp.length !== 6) {
                  setError('Enter your email and the 6-digit OTP.');
                  return;
            }

            setLoading(true);
            setError('');
            setMessage('');

            const result = await verifyEmailOtp({ email: normalizedEmail, otp });
            setLoading(false);

            if (result.success) {
                  setMessage('Email verified. Opening ZUNO...');
                  navigate('/', { replace: true });
                  return;
            }

            setError(result.message || 'Invalid or expired OTP.');
      };

      const handleResend = async () => {
            const normalizedEmail = email.trim().toLowerCase();
            if (!normalizedEmail || cooldown > 0) return;

            setResending(true);
            setError('');
            setMessage('');

            const result = await resendOtp(normalizedEmail);
            setResending(false);

            if (result.success) {
                  setCooldown(Number(result.data?.resendAfterSeconds || 60));
                  setMessage(result.message || 'A fresh OTP has been sent.');
                  return;
            }

            const wait = Number(result.data?.resendAfterSeconds || 0);
            if (wait > 0) setCooldown(wait);
            setError(result.message || 'Could not resend OTP.');
      };

      return (
            <div className="auth-page">
                  <div className="auth-card" style={{ position: 'relative', zIndex: 1, maxWidth: 460 }}>
                        <Link to="/welcome" className="logo" style={{ justifyContent: 'center', marginBottom: 'var(--space-xl)', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <img src={zunoLogo} alt="ZUNO" style={{ height: 50, borderRadius: 8 }} />
                              <span style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--color-accent-primary)' }}>ZUNO</span>
                        </Link>

                        <h1 className="auth-title">Verify Email</h1>
                        <p className="auth-subtitle">Enter the 6-digit code sent to your inbox.</p>

                        {error ? (
                              <div className="card p-md mb-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                                    <p style={{ color: '#ef4444', fontSize: 'var(--font-size-sm)', margin: 0, fontWeight: 600 }}>{error}</p>
                              </div>
                        ) : null}

                        {message ? (
                              <div className="card p-md mb-lg" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                                    <p style={{ color: '#059669', fontSize: 'var(--font-size-sm)', margin: 0, fontWeight: 600 }}>{message}</p>
                              </div>
                        ) : null}

                        <form onSubmit={handleSubmit} className="auth-form">
                              <div className="input-group">
                                    <label className="input-label">Email Address</label>
                                    <input
                                          type="email"
                                          className="input"
                                          value={email}
                                          onChange={(event) => setEmail(event.target.value)}
                                          autoComplete="email"
                                          required
                                    />
                              </div>

                              <div className="input-group">
                                    <label className="input-label">OTP Code</label>
                                    <input
                                          type="text"
                                          inputMode="numeric"
                                          className="input"
                                          value={otp}
                                          onChange={handleOtpChange}
                                          placeholder="123456"
                                          autoComplete="one-time-code"
                                          maxLength={6}
                                          style={{ textAlign: 'center', letterSpacing: 8, fontWeight: 800, fontSize: 24 }}
                                          required
                                    />
                              </div>

                              <button type="submit" className="btn btn-primary btn-lg" disabled={loading || otp.length !== 6} style={{ width: '100%', marginTop: 'var(--space-md)' }}>
                                    {loading ? 'Verifying...' : 'Verify Email'}
                              </button>
                        </form>

                        <button
                              type="button"
                              className="btn btn-secondary mt-lg"
                              onClick={handleResend}
                              disabled={resending || cooldown > 0 || !email.trim()}
                              style={{ width: '100%' }}
                        >
                              {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                        </button>

                        <Link to="/login" className="btn btn-ghost mt-md" style={{ width: '100%' }}>
                              Back to login
                        </Link>
                  </div>
            </div>
      );
};

export default VerifyEmail;
