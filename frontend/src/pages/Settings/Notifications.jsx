import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const Notifications = () => {
      const navigate = useNavigate();
      const { user, updateProfile } = useAuth();
      const [settings, setSettings] = useState({
            pushNotifications: true,
            emailNotifications: true,
            likesNotifications: true,
            commentsNotifications: true,
            followsNotifications: true,
            mentionsNotifications: true,
            sharesNotifications: true
      });
      const [loading, setLoading] = useState(false);

      useEffect(() => {
            // Load from user settings if available
            if (user?.notificationSettings) {
                  setSettings(prev => ({ ...prev, ...user.notificationSettings }));
            }
      }, [user]);

      const handleToggle = (key) => {
            setSettings(prev => ({ ...prev, [key]: !prev[key] }));
      };

      const handleSave = async () => {
            setLoading(true);

            try {
                  const result = await updateProfile({ notificationSettings: settings });

                  if (result.success) {
                        if (settings.pushNotifications && 'Notification' in window && Notification.permission === 'default') {
                              Notification.requestPermission().catch(() => {});
                        }
                        toast.success('Notification settings updated!');
                  } else {
                        toast.error(result.message || 'Update failed');
                  }
                } catch (error) {
                  toast.error('Failed to update settings');
            }
            setLoading(false);
      };

      const NotificationToggle = ({ icon, title, description, settingKey }) => (
            <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderBottom: '1px solid var(--color-border)'
            }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <span style={{ fontSize: '24px' }}>{icon}</span>
                        <div>
                              <div style={{ fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                                    {title}
                              </div>
                              <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                    {description}
                              </div>
                        </div>
                  </div>
                  <input
                        type="checkbox"
                        checked={settings[settingKey]}
                        onChange={() => handleToggle(settingKey)}
                        style={{
                              transform: 'scale(1.5)',
                              accentColor: 'var(--color-accent-primary)',
                              cursor: 'pointer'
                        }}
                  />
            </div>
      );

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
                        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>Notifications</h1>
                  </div>

                  <div style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        border: '1px solid var(--color-border)',
                        marginBottom: '16px'
                  }}>
                        <NotificationToggle
                              icon="📱"
                              title="Push Notifications"
                              description="Receive notifications on your device"
                              settingKey="pushNotifications"
                        />
                        <NotificationToggle
                              icon="📧"
                              title="Email Notifications"
                              description="Receive updates via email"
                              settingKey="emailNotifications"
                        />
                        <NotificationToggle
                              icon="❤️"
                              title="Likes"
                              description="When someone likes your content"
                              settingKey="likesNotifications"
                        />
                        <NotificationToggle
                              icon="💬"
                              title="Comments"
                              description="When someone comments on your content"
                              settingKey="commentsNotifications"
                        />
                        <NotificationToggle
                              icon="👥"
                              title="New Followers"
                              description="When someone follows you"
                              settingKey="followsNotifications"
                        />
                        <NotificationToggle
                              icon="@"
                              title="Mentions"
                              description="When someone mentions you"
                              settingKey="mentionsNotifications"
                        />
                        <NotificationToggle
                              icon="🔄"
                              title="Shares"
                              description="When someone shares your content"
                              settingKey="sharesNotifications"
                        />
                  </div>

                  <button
                        onClick={handleSave}
                        disabled={loading}
                        style={{
                              width: 'calc(100% - 32px)',
                              margin: '0 16px',
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
                        {loading ? '⏳ Saving...' : '💾 Save Settings'}
                  </button>
            </div >
      );
};

export default Notifications;
