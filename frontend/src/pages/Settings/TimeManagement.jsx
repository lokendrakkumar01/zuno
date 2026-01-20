import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const TimeManagement = () => {
      const navigate = useNavigate();
      const { user } = useAuth();
      const [dailyLimit, setDailyLimit] = useState(user?.dailyUsageLimit || 120); // minutes
      const [breakReminders, setBreakReminders] = useState(true);
      const [message, setMessage] = useState('');

      const handleSave = () => {
            localStorage.setItem('dailyTimeLimit', dailyLimit.toString());
            localStorage.setItem('breakReminders', breakReminders.toString());
            setMessage('✅ Time limits saved!');
            setTimeout(() => setMessage(''), 2000);
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
                        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>⏰ Time Management</h1>
                  </div>

                  {message && (
                        <div style={{
                              margin: '0 16px 16px 16px',
                              padding: '12px 16px',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(34, 197, 94, 0.1)',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              color: 'var(--color-text-primary)'
                        }}>
                              {message}
                        </div>
                  )}

                  <div style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: '16px',
                        border: '1px solid var(--color-border)',
                        padding: '20px',
                        marginBottom: '16px'
                  }}>
                        <h3 style={{ fontWeight: '600', marginBottom: '16px', color: 'var(--color-text-primary)' }}>
                              Daily Time Limit
                        </h3>
                        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                              Set a daily reminder to help manage your screen time
                        </p>

                        <div style={{ marginBottom: '20px' }}>
                              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                    Time limit (minutes per day)
                              </label>
                              <input
                                    type="range"
                                    min="30"
                                    max="480"
                                    step="30"
                                    value={dailyLimit}
                                    onChange={(e) => setDailyLimit(parseInt(e.target.value))}
                                    style={{ width: '100%', accentColor: 'var(--color-accent-primary)' }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                                    <span>30 min</span>
                                    <span style={{ fontWeight: '600', fontSize: '18px', color: 'var(--color-accent-primary)' }}>
                                          {Math.floor(dailyLimit / 60)}h {dailyLimit % 60}m
                                    </span>
                                    <span>8 hours</span>
                              </div>
                        </div>

                        <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '16px',
                              backgroundColor: 'var(--color-bg-secondary)',
                              borderRadius: '12px'
                        }}>
                              <div>
                                    <div style={{ fontWeight: '500', marginBottom: '4px', color: 'var(--color-text-primary)' }}>
                                          🔔 Break Reminders
                                    </div>
                                    <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                          Get reminded to take breaks
                                    </div>
                              </div>
                              <input
                                    type="checkbox"
                                    checked={breakReminders}
                                    onChange={(e) => setBreakReminders(e.target.checked)}
                                    style={{ transform: 'scale(1.5)', accentColor: 'var(--color-accent-primary)', cursor: 'pointer' }}
                              />
                        </div>
                  </div>

                  <button
                        onClick={handleSave}
                        style={{
                              width: 'calc(100% - 32px)',
                              margin: '0 16px',
                              padding: '14px',
                              borderRadius: '12px',
                              border: 'none',
                              background: 'var(--gradient-primary)',
                              color: 'white',
                              fontWeight: '600',
                              fontSize: '16px',
                              cursor: 'pointer'
                        }}
                  >
                        💾 Save Time Limits
                  </button>

                  <div style={{
                        padding: '16px',
                        marginTop: '16px',
                        marginLeft: '16px',
                        marginRight: '16px',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '12px',
                        color: 'var(--color-text-secondary)',
                        fontSize: '14px'
                  }}>
                        💡 You'll receive a notification when you reach your daily limit. This helps maintain a healthy balance!
                  </div>
            </div>
      );
};

export default TimeManagement;
