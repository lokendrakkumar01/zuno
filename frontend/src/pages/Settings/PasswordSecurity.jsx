import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

const PasswordSecurity = () => {
      const navigate = useNavigate();
      const { token } = useAuth();
      const [currentPassword, setCurrentPassword] = useState('');
      const [newPassword, setNewPassword] = useState('');
      const [confirmPassword, setConfirmPassword] = useState('');
      const [message, setMessage] = useState('');
      const [loading, setLoading] = useState(false);

      const handleSubmit = async (e) => {
            e.preventDefault();
            setMessage('');

            if (newPassword.length < 6) {
                  setMessage('❌ Password must be at least 6 characters');
                  return;
            }

            if (newPassword !== confirmPassword) {
                  setMessage('❌ Passwords do not match');
                  return;
            }

            setLoading(true);

            try {
                  const res = await fetch(`${API_URL}/auth/change-password`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                              currentPassword,
                              newPassword
                        })
                  });
                  const data = await res.json();

                  if (data.success) {
                        setMessage('✅ Password changed successfully!');
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                  } else {
                        setMessage(`❌ ${data.message || 'Failed to change password'}`);
                  }
            } catch (error) {
                  setMessage('❌ Error changing password');
            }
            setLoading(false);
      };

      return (
            <div className="container" style={{ paddingTop: '20px', paddingBottom: '100px', maxWidth: '600px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', padding: '0 16px' }}>
                        <button onClick={() => navigate('/settings')} style={{
                              background: 'none',
                              border: 'none',
                              fontSize: '24px',
                              cursor: 'pointer',
                              color: 'var(--color-text-primary)',
                              padding: 0
                        }}>
                              ‹
                        </button>
                        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>🔐 Password & Security</h1>
                  </div>

                  {message && (
                        <div style={{
                              margin: '0 16px 16px 16px',
                              padding: '12px 16px',
                              borderRadius: '12px',
                              backgroundColor: message.includes('✅') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              border: `1px solid ${message.includes('✅') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                              color: 'var(--color-text-primary)'
                        }}>
                              {message}
                        </div>
                  )}

                  <form onSubmit={handleSubmit} style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: '16px',
                        border: '1px solid var(--color-border)',
                        padding: '20px'
                  }}>
                        <h3 style={{ fontWeight: '600', marginBottom: '16px', color: 'var(--color-text-primary)' }}>
                              Change Password
                        </h3>

                        <div style={{ marginBottom: '16px' }}>
                              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                    Current Password
                              </label>
                              <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    required
                                    style={{
                                          width: '100%',
                                          padding: '12px',
                                          borderRadius: '8px',
                                          border: '1px solid var(--color-border)',
                                          backgroundColor: 'var(--color-bg-secondary)',
                                          color: 'var(--color-text-primary)',
                                          fontSize: '16px'
                                    }}
                              />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                    New Password
                              </label>
                              <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    style={{
                                          width: '100%',
                                          padding: '12px',
                                          borderRadius: '8px',
                                          border: '1px solid var(--color-border)',
                                          backgroundColor: 'var(--color-bg-secondary)',
                                          color: 'var(--color-text-primary)',
                                          fontSize: '16px'
                                    }}
                              />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                    Confirm New Password
                              </label>
                              <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    style={{
                                          width: '100%',
                                          padding: '12px',
                                          borderRadius: '8px',
                                          border: '1px solid var(--color-border)',
                                          backgroundColor: 'var(--color-bg-secondary)',
                                          color: 'var(--color-text-primary)',
                                          fontSize: '16px'
                                    }}
                              />
                        </div>

                        <button
                              type="submit"
                              disabled={loading}
                              style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: loading ? 'var(--color-bg-secondary)' : 'var(--gradient-primary)',
                                    color: 'white',
                                    fontWeight: '600',
                                    fontSize: '16px',
                                    cursor: loading ? 'not-allowed' : 'pointer'
                              }}
                        >
                              {loading ? '⏳ Changing Password...' : '🔒 Change Password'}
                        </button>
                  </form>
            </div>
      );
};

export default PasswordSecurity;
