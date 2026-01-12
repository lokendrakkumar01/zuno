import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import zunoLogo from '../../assets/zuno-logo.png';

const Register = () => {
      const [step, setStep] = useState(1);
      const [formData, setFormData] = useState({
            username: '',
            email: '',
            password: '',
            displayName: '',
            language: 'both'
      });
      const [error, setError] = useState('');
      const [loading, setLoading] = useState(false);
      const { register } = useAuth();
      const navigate = useNavigate();

      const handleChange = (e) => {
            setFormData(prev => ({
                  ...prev,
                  [e.target.name]: e.target.value
            }));
      };

      const handleSubmit = async (e) => {
            e.preventDefault();
            setError('');
            setLoading(true);

            const result = await register(formData);

            if (result.success) {
                  navigate('/');
            } else {
                  setError(result.message);
            }
            setLoading(false);
      };

      const nextStep = () => {
            if (step === 1 && (!formData.username || !formData.email)) {
                  setError('Please fill all fields');
                  return;
            }
            if (step === 2 && !formData.password) {
                  setError('Please enter a password');
                  return;
            }
            setError('');
            setStep(step + 1);
      };

      return (
            <div className="auth-page">
                  {/* Background Elements */}
                  <div style={{
                        position: 'fixed',
                        top: '15%',
                        right: '15%',
                        width: '350px',
                        height: '350px',
                        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
                        animation: 'float 7s ease-in-out infinite',
                        zIndex: 0
                  }}></div>
                  <div style={{
                        position: 'fixed',
                        bottom: '15%',
                        left: '10%',
                        width: '280px',
                        height: '280px',
                        background: 'radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, transparent 70%)',
                        animation: 'float 9s ease-in-out infinite reverse',
                        zIndex: 0
                  }}></div>

                  <div className="auth-card" style={{ position: 'relative', zIndex: 1, maxWidth: '480px' }}>
                        <Link to="/" className="logo" style={{ justifyContent: 'center', marginBottom: 'var(--space-xl)' }}>
                              <img src={zunoLogo} alt="ZUNO" className="animate-pulse" style={{ height: '50px', borderRadius: '8px' }} />
                              <span>ZUNO</span>
                        </Link>

                        <h1 className="auth-title animate-fadeInUp">Join ZUNO</h1>
                        <p className="auth-subtitle animate-fadeInUp stagger-1">Start your journey of learning and growth</p>

                        {/* Progress Steps */}
                        <div className="flex gap-sm mb-xl animate-fadeIn" style={{ justifyContent: 'center' }}>
                              {[1, 2, 3].map(s => (
                                    <div
                                          key={s}
                                          style={{
                                                width: '60px',
                                                height: '4px',
                                                borderRadius: 'var(--radius-full)',
                                                background: step >= s ? 'var(--gradient-primary)' : 'var(--color-border)',
                                                transition: 'all 0.3s ease'
                                          }}
                                    />
                              ))}
                        </div>

                        {error && (
                              <div
                                    className="card p-md mb-lg animate-fadeIn"
                                    style={{
                                          background: 'rgba(239, 68, 68, 0.1)',
                                          borderColor: 'rgba(239, 68, 68, 0.3)'
                                    }}
                              >
                                    <p style={{ color: '#ef4444', fontSize: 'var(--font-size-sm)' }}>⚠️ {error}</p>
                              </div>
                        )}

                        <form onSubmit={handleSubmit} className="auth-form">
                              {/* Step 1: Basic Info */}
                              {step === 1 && (
                                    <div className="animate-fadeInRight">
                                          <h3 className="text-lg font-semibold mb-lg text-center">👤 Basic Info</h3>

                                          <div className="input-group mb-md">
                                                <label className="input-label">Username *</label>
                                                <input
                                                      type="text"
                                                      name="username"
                                                      className="input"
                                                      placeholder="Choose a unique username"
                                                      value={formData.username}
                                                      onChange={handleChange}
                                                      required
                                                      minLength={3}
                                                />
                                          </div>

                                          <div className="input-group mb-md">
                                                <label className="input-label">Email *</label>
                                                <input
                                                      type="email"
                                                      name="email"
                                                      className="input"
                                                      placeholder="Enter your email"
                                                      value={formData.email}
                                                      onChange={handleChange}
                                                      required
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
                                                <label className="input-label">Password *</label>
                                                <input
                                                      type="password"
                                                      name="password"
                                                      className="input"
                                                      placeholder="Create a strong password (min 6 chars)"
                                                      value={formData.password}
                                                      onChange={handleChange}
                                                      required
                                                      minLength={6}
                                                />
                                          </div>

                                          <div className="card p-md mb-lg" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)' }}>
                                                <p className="text-sm" style={{ color: '#22c55e' }}>
                                                      ✅ Your data is encrypted and never shared
                                                </p>
                                          </div>

                                          <div className="flex gap-md">
                                                <button type="button" onClick={() => setStep(1)} className="btn btn-secondary flex-1">
                                                      ← Back
                                                </button>
                                                <button type="button" onClick={nextStep} className="btn btn-primary flex-1">
                                                      Next →
                                                </button>
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
                                                <button type="button" onClick={() => setStep(2)} className="btn btn-secondary flex-1">
                                                      ← Back
                                                </button>
                                                <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                                                      {loading ? <span className="spinner"></span> : '🚀 Create Account'}
                                                </button>
                                          </div>
                                    </div>
                              )}
                        </form>

                        <div className="auth-divider mt-xl mb-lg animate-fadeIn">
                              <span>Already have an account?</span>
                        </div>

                        <Link to="/login" className="btn btn-secondary animate-fadeIn" style={{ width: '100%' }}>
                              Login
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
