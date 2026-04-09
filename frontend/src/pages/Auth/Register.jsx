import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import zunoLogo from '../../assets/zuno-logo.png';

const isValidUsername = (value) => /^[a-zA-Z0-9_.]{3,30}$/.test(value);
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const hasStrongPassword = (value) =>
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(value);

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

      useEffect(() => {
            if (countdown > 0) {
                  countdownRef.current = setTimeout(() => setCountdown((current) => current - 1), 1000);
            }

            return () => clearTimeout(countdownRef.current);
      }, [countdown]);

      const passwordChecks = [
            { label: '8+ characters', valid: formData.password.length >= 8 },
            { label: 'Uppercase letter', valid: /[A-Z]/.test(formData.password) },
            { label: 'Lowercase letter', valid: /[a-z]/.test(formData.password) },
            { label: 'Number', valid: /\d/.test(formData.password) },
            { label: 'Special character', valid: /[@$!%*?&]/.test(formData.password) }
      ];

      const handleChange = (e) => {
            setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
            if (!wakingUp && error) {
                  setError('');
            }
      };

      const validateStepOne = () => {
            const username = formData.username.trim();
            const email = formData.email.trim().toLowerCase();

            if (!username || !email) {
                  return 'Please fill in username and email.';
            }

            if (!isValidUsername(username)) {
                  return 'Username must be 3-30 characters and may only use letters, numbers, underscores, and dots.';
            }

            if (!isValidEmail(email)) {
                  return 'Please enter a valid email address.';
            }

            return '';
      };

      const validateStepTwo = () => {
            if (!formData.password) {
                  return 'Please enter a password.';
            }

            if (!hasStrongPassword(formData.password)) {
                  return 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';
            }

            if (formData.password !== formData.confirmPassword) {
                  return 'Passwords do not match.';
            }

            return '';
      };

      const nextStep = () => {
            const message = step === 1 ? validateStepOne() : step === 2 ? validateStepTwo() : '';
            if (message) {
                  setError(message);
                  return;
            }

            setError('');
            setStep((current) => current + 1);
      };

      const handleSubmit = async (e) => {
            e.preventDefault();
            setError('');
            setWakingUp(false);
            setRetryInfo(null);
            setCountdown(0);

            const stepOneMessage = validateStepOne();
            const stepTwoMessage = validateStepTwo();

            if (stepOneMessage || stepTwoMessage) {
                  setError(stepOneMessage || stepTwoMessage);
                  return;
            }

            const submitData = {
                  username: formData.username.trim(),
                  email: formData.email.trim().toLowerCase(),
                  password: formData.password,
                  displayName: formData.displayName.trim(),
                  language: formData.language
            };

            setLoading(true);

            const result = await register(submitData, (info) => {
                  setWakingUp(true);
                  setRetryInfo(info);
                  setCountdown(info.retryIn);
                  setError(`Server is waking up. Auto-retrying (${info.attempt}/${info.maxRetries})`);
            });

            if (result.success) {
                  navigate('/');
            } else if (result.status === 'waking_up') {
                  setWakingUp(true);
                  setError('Server is still waking up. Please try Create Account again in 30 seconds.');
            } else {
                  setWakingUp(false);
                  setError(result.message || 'Registration failed. Please try again.');
            }

            setLoading(false);
            setRetryInfo(null);
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

                        <div className="flex gap-sm mb-xl animate-fadeIn" style={{ justifyContent: 'center' }}>
                              {[1, 2, 3].map((currentStep) => (
                                    <div
                                          key={currentStep}
                                          style={{
                                                width: '60px',
                                                height: '4px',
                                                borderRadius: 'var(--radius-full)',
                                                background: step >= currentStep ? 'var(--gradient-primary)' : 'var(--color-border)',
                                                transition: 'all 0.3s ease'
                                          }}
                                    />
                              ))}
                        </div>

                        {error ? (
                              <div
                                    className="card p-md mb-lg animate-fadeIn"
                                    style={{
                                          background: wakingUp ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                          borderColor: wakingUp ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                                          display: 'flex',
                                          alignItems: 'flex-start',
                                          gap: '10px'
                                    }}
                              >
                                    <span style={{ fontSize: '18px', flexShrink: 0 }}>{wakingUp ? '...' : '!'}</span>
                                    <div style={{ flex: 1 }}>
                                          <p style={{ color: wakingUp ? '#f59e0b' : '#ef4444', fontSize: 'var(--font-size-sm)', margin: 0, fontWeight: 500 }}>
                                                {error}
                                          </p>
                                          {wakingUp && retryInfo ? (
                                                <div style={{ marginTop: '8px' }}>
                                                      <div style={{ height: '3px', background: 'rgba(245,158,11,0.2)', borderRadius: '99px', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${((retryInfo.attempt - 1) / retryInfo.maxRetries) * 100}%`, background: '#f59e0b', borderRadius: '99px', transition: 'width 0.5s ease' }} />
                                                      </div>
                                                      {countdown > 0 ? (
                                                            <p style={{ fontSize: '11px', color: '#f59e0b', margin: '4px 0 0' }}>Retrying in {countdown}s...</p>
                                                      ) : null}
                                                </div>
                                          ) : null}
                                    </div>
                                    {!loading ? (
                                          <button
                                                type="button"
                                                onClick={() => {
                                                      setError('');
                                                      setWakingUp(false);
                                                      setRetryInfo(null);
                                                      setCountdown(0);
                                                }}
                                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0, flexShrink: 0 }}
                                          >
                                                x
                                          </button>
                                    ) : null}
                              </div>
                        ) : null}

                        <form onSubmit={handleSubmit} className="auth-form">
                              {step === 1 ? (
                                    <div className="animate-fadeInRight">
                                          <h3 className="text-lg font-semibold mb-lg text-center">{t('personalInfo')}</h3>

                                          <div className="input-group mb-md">
                                                <label className="input-label">{t('username')} *</label>
                                                <input
                                                      type="text"
                                                      name="username"
                                                      className="input"
                                                      placeholder="john_doe or john.doe"
                                                      value={formData.username}
                                                      onChange={handleChange}
                                                      required
                                                      minLength={3}
                                                      maxLength={30}
                                                      autoComplete="username"
                                                />
                                                <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                                                      3-30 chars, letters, numbers, underscores, and dots
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
                                                Next
                                          </button>
                                    </div>
                              ) : null}

                              {step === 2 ? (
                                    <div className="animate-fadeInRight">
                                          <h3 className="text-lg font-semibold mb-lg text-center">Security</h3>

                                          <div className="input-group mb-md">
                                                <label className="input-label">{t('password')} *</label>
                                                <div style={{ position: 'relative' }}>
                                                      <input
                                                            type={showPassword ? 'text' : 'password'}
                                                            name="password"
                                                            className="input"
                                                            placeholder="Create a strong password"
                                                            value={formData.password}
                                                            onChange={handleChange}
                                                            required
                                                            minLength={8}
                                                            autoComplete="new-password"
                                                            style={{ paddingRight: '48px' }}
                                                      />
                                                      <button
                                                            type="button"
                                                            onClick={() => setShowPassword((current) => !current)}
                                                            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}
                                                      >
                                                            {showPassword ? 'Hide' : 'Show'}
                                                      </button>
                                                </div>
                                          </div>

                                          <div className="card p-md mb-md" style={{ background: 'rgba(15, 23, 42, 0.03)', borderColor: 'rgba(148, 163, 184, 0.25)' }}>
                                                <div className="flex flex-col gap-sm">
                                                      {passwordChecks.map((item) => (
                                                            <div key={item.label} className="flex items-center justify-between text-sm">
                                                                  <span>{item.label}</span>
                                                                  <span style={{ color: item.valid ? '#10b981' : '#94a3b8', fontWeight: 700 }}>{item.valid ? 'OK' : '-'}</span>
                                                            </div>
                                                      ))}
                                                </div>
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
                                                            style={{ paddingRight: '48px' }}
                                                      />
                                                      <button
                                                            type="button"
                                                            onClick={() => setShowConfirm((current) => !current)}
                                                            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}
                                                      >
                                                            {showConfirm ? 'Hide' : 'Show'}
                                                      </button>
                                                </div>
                                          </div>

                                          <div className="flex gap-md">
                                                <button type="button" onClick={() => setStep(1)} className="btn btn-secondary flex-1">Back</button>
                                                <button type="button" onClick={nextStep} className="btn btn-primary flex-1">Next</button>
                                          </div>
                                    </div>
                              ) : null}

                              {step === 3 ? (
                                    <div className="animate-fadeInRight">
                                          <h3 className="text-lg font-semibold mb-lg text-center">Preferences</h3>

                                          <div className="input-group mb-md">
                                                <label className="input-label">Display Name (optional)</label>
                                                <input
                                                      type="text"
                                                      name="displayName"
                                                      className="input"
                                                      placeholder="How should we call you?"
                                                      value={formData.displayName}
                                                      onChange={handleChange}
                                                      maxLength={50}
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
                                                      <option value="both">Hindi & English</option>
                                                      <option value="en">English</option>
                                                      <option value="hi">Hindi</option>
                                                </select>
                                          </div>

                                          <div className="flex gap-md">
                                                <button type="button" onClick={() => setStep(2)} className="btn btn-secondary flex-1">Back</button>
                                                <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                                                      {loading ? 'Creating...' : t('createAccount')}
                                                </button>
                                          </div>
                                    </div>
                              ) : null}
                        </form>

                        <div className="auth-divider mt-xl mb-lg animate-fadeIn">
                              <span>{t('alreadyHaveAccount')}</span>
                        </div>

                        <Link to="/login" className="btn btn-secondary animate-fadeIn" style={{ width: '100%' }}>
                              {t('login')}
                        </Link>
                  </div>
            </div>
      );
};

export default Register;
