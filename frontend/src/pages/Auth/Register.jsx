import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import zunoLogo from '../../assets/zuno-logo.png';

// Username rule: 3–20 chars, letters/numbers/underscores only
const isValidUsername = (u) => /^[a-zA-Z0-9_]{3,20}$/.test(u);

const Register = () => {
      const [step, setStep] = useState(1);
      const [formData, setFormData] = useState({
            username: '',
            email: '',
            password: '',
            confirmPassword: '',
            displayName: '',
            language: 'both'
      });
      const [showPassword, setShowPassword] = useState(false);
      const [showConfirm, setShowConfirm] = useState(false);
      const [error, setError] = useState('');
      const [loading, setLoading] = useState(false);
      const [wakingUp, setWakingUp] = useState(false);
      const [retryInfo, setRetryInfo] = useState(null);
      const [countdown, setCountdown] = useState(0);
      const countdownRef = useRef(null);
      const { register } = useAuth();
      const { t } = useLanguage();
      const navigate = useNavigate();

      // Countdown timer for retry
      useEffect(() => {
            if (countdown > 0) {
                  countdownRef.current = setTimeout(() => setCountdown(c => c - 1), 1000);
            }
            return () => clearTimeout(countdownRef.current);
      }, [countdown]);

      const handleChange = (e) => {
            setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
            if (error) setError('');
      };

      // Password strength
      const getPasswordStrength = (pwd) => {
            if (!pwd) return null;
            let score = 0;
            if (pwd.length >= 8) score++;
            if (/[A-Z]/.test(pwd)) score++;
            if (/[0-9]/.test(pwd)) score++;
            if (/[^a-zA-Z0-9]/.test(pwd)) score++;
            if (score <= 1) return { label: 'Weak', color: '#ef4444', width: '25%' };
            if (score === 2) return { label: 'Fair', color: '#f59e0b', width: '50%' };
            if (score === 3) return { label: 'Good', color: '#3b82f6', width: '75%' };
            return { label: 'Strong', color: '#10b981', width: '100%' };
      };
      const pwdStrength = getPasswordStrength(formData.password);

      const handleSubmit = async (e) => {
            e.preventDefault();
            setError('');
            setWakingUp(false);
            setRetryInfo(null);
            setCountdown(0);

            const normalizedData = {
                  ...formData,
                  username: formData.username.trim(),
                  email: formData.email.trim().toLowerCase(),
                  displayName: formData.displayName.trim()
            };

            if (normalizedData.password !== normalizedData.confirmPassword) {
                  setError('Passwords do not match.');
                  return;
            }
            if (!isValidUsername(normalizedData.username)) {
                  setError('Username must be 3–20 characters and can only contain letters, numbers, and underscores (no spaces).');
                  return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedData.email)) {
                  setError('Please enter a valid email address.');
                  return;
            }

            setLoading(true);
            const { confirmPassword, ...submitData } = normalizedData;
            const result = await register(submitData, (info) => {
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
                        setError('Server is still waking up. Please click Create Account again in 30 seconds.');
                  } else {
                        setWakingUp(false);
                        setError(result.message || 'Registration failed. Please try again.');
                  }
            }
            setLoading(false);
            setRetryInfo(null);
      };

      const nextStep = () => {
            setError('');
            if (step === 1) {
                  if (!formData.username || !formData.email) {
                        setError('Please fill in all required fields.');
                        return;
                  }
                  if (!isValidUsername(formData.username)) {
                        setError('Username must be 3–20 characters and can only contain letters, numbers, and underscores (no spaces).');
                        return;
                  }
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
                        setError('Please enter a valid email address.');
                        return;
                  }
            }
            if (step === 2) {
                  if (!formData.password) { setError('Please enter a password.'); return; }
                  if (formData.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
                  if (formData.password !== formData.confirmPassword) { setError('Passwords do not match.'); return; }
            }
            setStep(step + 1);
      };

      return (
            <div className="auth-page">
                  <div style={{ position: 'fixed', top: '15%', right: '15%', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)', animation: 'float 7s ease-in-out infinite', zIndex: 0 }} />
                  <div style={{ position: 'fixed', bottom: '15%', left: '10%', width: '280px', height: '280px', background: 'radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, transparent 70%)', animation: 'float 9s ease-in-out infinite reverse', zIndex: 0 }} />

                  <div className="auth-card" style={{ position: 'relative', zIndex: 1, maxWidth: '480px' }}>
                        <Link to="/welcome" className="logo" style={{ justifyContent: 'center', marginBottom: 'var(--space-xl)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <img src={zunoLogo} alt="ZUNO" className="animate-pulse" style={{ height: '50px', borderRadius: '8px' }} />
                              <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-accent-primary)' }}>ZUNO</span>
                        </Link>

                        <h1 className="auth-title animate-fadeInUp">Join ZUNO</h1>
                        <p className="auth-subtitle animate-fadeInUp">Start your journey of learning and growth</p>

                        {/* Progress Steps */}
                        <div className="flex gap-sm mb-xl animate-fadeIn" style={{ justifyContent: 'center' }}>
                              {[1, 2, 3].map(s => (
                                    <div key={s} style={{
                                          width: '60px', height: '4px', borderRadius: 'var(--radius-full)',
                                          background: step >= s ? 'var(--gradient-primary)' : 'var(--color-border)',
                                          transition: 'all 0.3s ease'
                                    }} />
                              ))}
                        </div>

                        {error && (
                              <div
                                    className="card p-md mb-lg animate-fadeIn"
                                    style={{
                                          background: wakingUp ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                          borderColor: wakingUp ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                                          display: 'flex', alignItems: 'flex-start', gap: '10px'
                                    }}
                              >
                                    <span style={{ fontSize: '18px', flexShrink: 0 }}>{wakingUp ? '⏳' : '⚠️'}</span>
                                    <div style={{ flex: 1 }}>
                                          <p style={{
                                                color: wakingUp ? '#f59e0b' : '#ef4444',
                                                fontSize: 'var(--font-size-sm)', margin: 0, fontWeight: 500
                                          }}>{error}</p>
                                          {wakingUp && retryInfo && (
                                                <div style={{ marginTop: '8px' }}>
                                                      <div style={{ height: '3px', background: 'rgba(245,158,11,0.2)', borderRadius: '99px', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${((retryInfo.attempt - 1) / retryInfo.maxRetries) * 100}%`, background: '#f59e0b', borderRadius: '99px', transition: 'width 0.5s ease' }} />
                                                      </div>
                                                      {countdown > 0 && <p style={{ fontSize: '11px', color: '#f59e0b', margin: '4px 0 0' }}>Retrying in {countdown}s...</p>}
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
                              {/* Step 1: Basic Info */}
                              {step === 1 && (
                                    <div className="animate-fadeInRight">
                                          <h3 className="text-lg font-semibold mb-lg text-center">👤 {t('personalInfo')}</h3>

                                          <div className="input-group mb-md">
                                                <label className="input-label">{t('username')} *</label>
                                                <input
                                                      type="text"
                                                      name="username"
                                                      className="input"
                                                      placeholder="E.g.: john_doe (letters, numbers, _)"
                                                      value={formData.username}
                                                      onChange={handleChange}
                                                      required
                                                      minLength={3}
                                                      maxLength={20}
                                                      autoComplete="username"
                                                />
                                                <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                                                      3–20 chars, letters/numbers/underscores only
                                                </span>
                                          </div>

                                          <div className="input-group mb-md">
                                                <label className="input-label">{t('email')} *</label>
                                                <input
                                                      type="email"
                                                      name="email"
                                                      className="input"
                                                      placeholder="Enter your email"
                                                      value={formData.email}
                                                      onChange={handleChange}
                                                      required
                                                      autoComplete="email"
                                                />
                                          </div>

                                          <button type="button" onClick={nextStep} className="btn btn-primary" style={{ width: '100%' }}>
                                                Next →
                                          </button>
                                    </div>
                              )}

                              {/* Step 2: Security */}
                              {step === 2 && (
                                    <div className="animate-fadeInRight">
                                          <h3 className="text-lg font-semibold mb-lg text-center">🔒 Security</h3>

                                          <div className="input-group mb-md">
                                                <label className="input-label">{t('password')} *</label>
                                                <div style={{ position: 'relative' }}>
                                                      <input
                                                            type={showPassword ? 'text' : 'password'}
                                                            name="password"
                                                            className="input"
                                                            placeholder="Create a strong password (min 6 chars)"
                                                            value={formData.password}
                                                            onChange={handleChange}
                                                            required
                                                            minLength={6}
                                                            autoComplete="new-password"
                                                            style={{ paddingRight: '48px' }}
                                                      />
                                                      <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}>
                                                            {showPassword ? '🙈' : '👁️'}
                                                      </button>
                                                </div>
                                                {/* Password strength bar */}
                                                {formData.password && pwdStrength && (
                                                      <div style={{ marginTop: '8px' }}>
                                                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
                                                                  <div style={{ height: '100%', width: pwdStrength.width, background: pwdStrength.color, borderRadius: '99px', transition: 'width 0.3s, background 0.3s' }} />
                                                            </div>
                                                            <span style={{ fontSize: '11px', color: pwdStrength.color, fontWeight: 600 }}>{pwdStrength.label} password</span>
                                                      </div>
                                                )}
                                          </div>

                                          <div className="input-group mb-md">
                                                <label className="input-label">Confirm Password *</label>
                                                <div style={{ position: 'relative' }}>
                                                      <input
                                                            type={showConfirm ? 'text' : 'password'}
                                                            name="confirmPassword"
                                                            className="input"
                                                            placeholder="Re-enter your password"
                                                            value={formData.confirmPassword}
                                                            onChange={handleChange}
                                                            required
                                                            autoComplete="new-password"
                                                            style={{
                                                                  paddingRight: '48px',
                                                                  borderColor: formData.confirmPassword
                                                                        ? formData.password === formData.confirmPassword ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'
                                                                        : undefined
                                                            }}
                                                      />
                                                      <button type="button" onClick={() => setShowConfirm(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}>
                                                            {showConfirm ? '🙈' : '👁️'}
                                                      </button>
                                                </div>
                                                {formData.confirmPassword && (
                                                      <span style={{ fontSize: '11px', fontWeight: 600, marginTop: '4px', display: 'block', color: formData.password === formData.confirmPassword ? '#10b981' : '#ef4444' }}>
                                                            {formData.password === formData.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                                                      </span>
                                                )}
                                          </div>

                                          <div className="card p-md mb-lg" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)' }}>
                                                <p className="text-sm" style={{ color: '#22c55e' }}>✅ Your data is encrypted and never shared</p>
                                          </div>

                                          <div className="flex gap-md">
                                                <button type="button" onClick={() => setStep(1)} className="btn btn-secondary flex-1">← Back</button>
                                                <button type="button" onClick={nextStep} className="btn btn-primary flex-1">Next →</button>
                                          </div>
                                    </div>
                              )}

                              {/* Step 3: Preferences */}
                              {step === 3 && (
                                    <div className="animate-fadeInRight">
                                          <h3 className="text-lg font-semibold mb-lg text-center">⚙️ Preferences</h3>

                                          <div className="input-group mb-md">
                                                <label className="input-label">Display Name (optional)</label>
                                                <input
                                                      type="text"
                                                      name="displayName"
                                                      className="input"
                                                      placeholder="How should we call you?"
                                                      value={formData.displayName}
                                                      onChange={handleChange}
                                                />
                                          </div>

                                          <div className="input-group mb-lg">
                                                <label className="input-label">Preferred Language</label>
                                                <select
                                                      name="language"
                                                      className="input select"
                                                      value={formData.language}
                                                      onChange={handleChange}
                                                >
                                                      <option value="both">🌐 Hindi & English</option>
                                                      <option value="en">🇬🇧 English</option>
                                                      <option value="hi">🇮🇳 Hindi</option>
                                                </select>
                                          </div>

                                          <div className="flex gap-md">
                                                <button type="button" onClick={() => setStep(2)} className="btn btn-secondary flex-1">← Back</button>
                                                <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                                                      {loading
                                                            ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><span style={{ fontSize: '18px' }}>⏳</span> Creating…</span>
                                                            : `🚀 ${t('createAccount')}`
                                                      }
                                                </button>
                                          </div>
                                    </div>
                              )}
                        </form>

                        <div className="auth-divider mt-xl mb-lg animate-fadeIn">
                              <span>{t('alreadyHaveAccount')}</span>
                        </div>

                        <Link to="/login" className="btn btn-secondary animate-fadeIn" style={{ width: '100%' }}>
                              {t('login')}
                        </Link>

                        {/* Trust Badges */}
                        <div className="flex justify-center gap-lg mt-xl animate-fadeIn" style={{ opacity: 0.6 }}>
                              <span className="text-xs">🧘 No Addiction</span>
                              <span className="text-xs">⚖️ Fair for All</span>
                              <span className="text-xs">📚 Value First</span>
                        </div>
                  </div>
            </div>
      );
};

export default Register;
