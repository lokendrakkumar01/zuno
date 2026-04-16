import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '../../config';

const ResetPassword = () => {
      const navigate = useNavigate();
      const [searchParams] = useSearchParams();
      const token = searchParams.get('token') || '';
      const userId = searchParams.get('userId') || '';
      const [newPassword, setNewPassword] = useState('');
      const [confirmPassword, setConfirmPassword] = useState('');
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');
      const [success, setSuccess] = useState('');

      const missingLinkParams = useMemo(() => !token || !userId, [token, userId]);

      const handleSubmit = async (event) => {
            event.preventDefault();

            if (missingLinkParams) {
                  setError('Reset link is incomplete. Please open the full link from your email.');
                  return;
            }

            if (newPassword.length < 8) {
                  setError('New password must be at least 8 characters.');
                  return;
            }

            if (newPassword !== confirmPassword) {
                  setError('Passwords do not match.');
                  return;
            }

            setLoading(true);
            setError('');
            setSuccess('');

            try {
                  const res = await fetch(`${API_URL}/auth/reset-password`, {
                        method: 'POST',
                        headers: {
                              'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                              token,
                              userId,
                              newPassword
                        })
                  });

                  const data = await res.json().catch(() => null);

                  if (!res.ok || !data?.success) {
                        setError(data?.message || 'Password reset failed. Please request a new reset link.');
                        return;
                  }

                  setSuccess(data.message || 'Password reset successful. You can now log in.');
                  setNewPassword('');
                  setConfirmPassword('');
            } catch {
                  setError('Network error. Please try again.');
            } finally {
                  setLoading(false);
            }
      };

      return (
            <div className="auth-page">
                  <div className="auth-card" style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
                              <h1 className="auth-title">Reset Password</h1>
                              <p className="auth-subtitle">Set a new password for your ZUNO account.</p>
                        </div>

                        {missingLinkParams ? (
                              <div className="card p-md mb-lg" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                                    <p style={{ margin: 0, color: '#ef4444', fontSize: 'var(--font-size-sm)' }}>
                                          Reset link is missing required details. Please open the original email link again.
                                    </p>
                              </div>
                        ) : null}

                        {error ? (
                              <div className="card p-md mb-lg" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                                    <p style={{ margin: 0, color: '#ef4444', fontSize: 'var(--font-size-sm)' }}>{error}</p>
                              </div>
                        ) : null}

                        {success ? (
                              <div className="card p-md mb-lg" style={{ background: 'rgba(34, 197, 94, 0.08)', borderColor: 'rgba(34, 197, 94, 0.25)' }}>
                                    <p style={{ margin: 0, color: '#16a34a', fontSize: 'var(--font-size-sm)' }}>{success}</p>
                              </div>
                        ) : null}

                        <form onSubmit={handleSubmit} className="auth-form">
                              <div className="input-group">
                                    <label className="input-label">New Password</label>
                                    <input
                                          type="password"
                                          className="input"
                                          placeholder="Enter a new password"
                                          value={newPassword}
                                          onChange={(event) => setNewPassword(event.target.value)}
                                          autoComplete="new-password"
                                          minLength={8}
                                          disabled={loading || missingLinkParams}
                                          required
                                    />
                              </div>

                              <div className="input-group">
                                    <label className="input-label">Confirm Password</label>
                                    <input
                                          type="password"
                                          className="input"
                                          placeholder="Confirm your new password"
                                          value={confirmPassword}
                                          onChange={(event) => setConfirmPassword(event.target.value)}
                                          autoComplete="new-password"
                                          minLength={8}
                                          disabled={loading || missingLinkParams}
                                          required
                                    />
                              </div>

                              <button
                                    type="submit"
                                    className="btn btn-primary btn-lg"
                                    style={{ width: '100%' }}
                                    disabled={loading || missingLinkParams}
                              >
                                    {loading ? 'Resetting...' : 'Reset Password'}
                              </button>
                        </form>

                        <div className="auth-divider mt-xl mb-lg">
                              <span>done here?</span>
                        </div>

                        <div className="flex gap-md" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                              <Link to="/login" className="btn btn-secondary">Back to Login</Link>
                              {success ? (
                                    <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>
                                          Login Now
                                    </button>
                              ) : null}
                        </div>
                  </div>
            </div>
      );
};

export default ResetPassword;
