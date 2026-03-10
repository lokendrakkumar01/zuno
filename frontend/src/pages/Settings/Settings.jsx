import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../config';
import { toast } from 'react-toastify';
import SettingsOption from '../../components/Settings/SettingsOption';

const Settings = () => {
      const { user, token, logout } = useAuth();
      const { t } = useLanguage();
      const navigate = useNavigate();
      const [loading, setLoading] = useState(false);
      const [message, setMessage] = useState('');

      // Modal states
      const [showActivity, setShowActivity] = useState(false);
      const [showCloseFriends, setShowCloseFriends] = useState(false);
      const [showArchive, setShowArchive] = useState(false);
      const [showCreatorTools, setShowCreatorTools] = useState(false);

      // Load theme on mount and apply it
      useEffect(() => {
            const savedTheme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);
      }, []);

      const handleLogout = () => {
            logout();
            navigate('/login');
      };

      const SectionTitle = ({ title }) => (
            <h3 style={{
                  fontWeight: '600',
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '20px 16px 8px 16px',
                  marginTop: '12px'
            }}>
                  {title}
            </h3>
      );

      return (
            <div className="settings-container">
                  <h1 style={{
                        fontSize: '28px',
                        fontWeight: '700',
                        marginBottom: '24px',
                        padding: '0 16px'
                  }}>
                        ⚙️ {t('settings')}
                  </h1>

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

                  <div className="settings-list">


                        {/* For You Section */}
                        <SectionTitle title={t('forYou')} />
                        <SettingsOption
                              icon="📑"
                              label={t('saved')}
                              subtitle="Your saved posts and content"
                              onClick={() => navigate('/content/saved')}
                        />
                        <SettingsOption
                              icon="📦"
                              label={t('archive')}
                              subtitle="Posts you've archived"
                              onClick={() => setShowArchive(true)}
                        />
                        <SettingsOption
                              icon="📊"
                              label={t('activity')}
                              subtitle="Time spent, posts viewed, and more"
                              onClick={() => navigate('/settings/activity')}
                        />
                        <SettingsOption
                              icon="🔔"
                              label={t('notifications')}
                              subtitle="Manage your notification preferences"
                              onClick={() => navigate('/settings/notifications')}
                        />
                        <SettingsOption
                              icon="⏰"
                              label={t('timeManagement')}
                              subtitle="Set daily time limits and reminders"
                              onClick={() => navigate('/settings/time-management')}
                        />

                        {/* For Professionals Section */}
                        <SectionTitle title={t('forProfessionals')} />
                        <SettingsOption
                              icon="📈"
                              label={t('insights')}
                              subtitle="View your content analytics"
                              onClick={() => navigate('/settings/insights')}
                        />
                        <SettingsOption
                              icon="✓"
                              label="ZUNO Verify"
                              badge="Not subscribed"
                              subtitle="Get the blue checkmark"
                              onClick={() => toast.info('ZUNO Verify subscription - Coming soon!')}
                        />
                        <SettingsOption
                              icon="📅"
                              label="Scheduled content"
                              subtitle="Schedule posts for later"
                              onClick={() => navigate('/settings/scheduled-content')}
                        />
                        <SettingsOption
                              icon="🛠️"
                              label={t('creatorTools')}
                              subtitle="Manage your creator features"
                              onClick={() => setShowCreatorTools(true)}
                        />

                        {/* Who Can See Your Content Section */}
                        <SectionTitle title={t('whoCanSee')} />
                        <SettingsOption
                              icon="🔒"
                              label={t('privacy')}
                              value={user?.isPrivate ? 'Private' : 'Public'}
                              onClick={() => navigate('/settings/privacy')}
                        />
                        <SettingsOption
                              icon="👥"
                              label={t('closeFriends')}
                              subtitle="Share with your closest friends"
                              onClick={() => navigate('/settings/close-friends')}
                        />

                        {/* How You Use ZUNO Section */}
                        <SectionTitle title={t('howYouUse')} />
                        <SettingsOption
                              icon="🎨"
                              label={t('appearance')}
                              value={localStorage.getItem('theme') === 'light' ? 'Light' : localStorage.getItem('theme') === 'dark' ? 'Dark' : 'System'}
                              onClick={() => navigate('/settings/appearance')}
                        />
                        <SettingsOption
                              icon="💬"
                              label={t('messages')}
                              subtitle="Manage your chats and messages"
                              onClick={() => navigate('/messages')}
                        />
                        <SettingsOption
                              icon="🌍"
                              label={t('language')}
                              value={user?.language === 'hi' ? 'Hindi' : 'English'}
                              onClick={() => navigate('/settings/language')}
                        />

                        {/* Advanced Settings Section */}
                        <SectionTitle title={t('advancedSettings')} />
                        <SettingsOption
                              icon="🛡️"
                              label={t('accountStatus')}
                              subtitle="Check your standing on ZUNO"
                              onClick={() => toast.success('Account status: All good! ✅')}
                        />
                        <SettingsOption
                              icon="📥"
                              label={t('downloadInfo')}
                              subtitle="Get a copy of your ZUNO data"
                              onClick={() => toast.success('Information download request submitted.')}
                        />
                        <SettingsOption
                              icon="❓"
                              label={t('support')}
                              subtitle="Get help or report a problem"
                              onClick={() => toast.info('Opening Help Center...')}
                        />

                        {/* Account Section */}
                        <SectionTitle title={t('yourAccount')} />
                        <SettingsOption
                              icon="👤"
                              label={t('personalInfo')}
                              subtitle="Edit your profile details"
                              onClick={() => navigate('/profile')}
                        />
                        <SettingsOption
                              icon="🔐"
                              label="Password and security"
                              onClick={() => navigate('/settings/password-security')}
                        />
                        <SettingsOption
                              icon="🚪"
                              label={t('logout')}
                              onClick={handleLogout}
                        />
                        <SettingsOption
                              icon="🗑️"
                              label={t('deleteAccount')}
                              onClick={async () => {
                                    if (window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone.')) {
                                          try {
                                                const res = await fetch(`${API_URL}/users/account`, {
                                                      method: 'DELETE',
                                                      headers: {
                                                            'Authorization': `Bearer ${token}`
                                                      }
                                                });
                                                const data = await res.json();

                                                if (data.success) {
                                                      toast.info('Your account has been deleted.');
                                                      logout();
                                                      navigate('/login');
                                                } else {
                                                      toast.error(data.message || 'Failed to delete account');
                                                }
                                          } catch (error) {
                                                toast.error('Failed to connect to the server.');
                                          }
                                    }
                              }}
                        />
                  </div>

                  {/* Modal for Your Activity */}
                  {showActivity && (
                        <ActivityModal onClose={() => setShowActivity(false)} />
                  )}

                  {/* Modal for Close Friends */}
                  {showCloseFriends && (
                        <CloseFriendsModal onClose={() => setShowCloseFriends(false)} />
                  )}

                  {/* Modal for Archive */}
                  {showArchive && (
                        <ArchiveModal onClose={() => setShowArchive(false)} />
                  )}

                  {/* Modal for Creator Tools */}
                  {showCreatorTools && (
                        <CreatorToolsModal onClose={() => setShowCreatorTools(false)} />
                  )}
            </div>
      );
};

const ActivityModal = ({ onClose }) => (
      <ModalWrapper title="Your Activity" onClose={onClose}>
            <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <StatCard icon="⌛" label="Daily Average" value="2h 45m" />
                        <StatCard icon="📱" label="Screen Time" value="18h 20m (week)" />
                        <StatCard icon="❤️" label="Interactions" value="124 posts" />

                        <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                              <h4 style={{ marginBottom: '8px', color: 'var(--color-text-primary)' }}>Most Visited</h4>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                    <span>Feed</span>
                                    <span>45%</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                                    <span>Messages</span>
                                    <span>30%</span>
                              </div>
                        </div>
                  </div>
            </div>
      </ModalWrapper>
);

const CloseFriendsModal = ({ onClose }) => (
      <ModalWrapper title="Close Friends" onClose={onClose}>
            <div style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'rgba(34, 197, 94, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px auto',
                        fontSize: '40px'
                  }}>👥</div>
                  <h3 style={{ marginBottom: '12px', color: 'var(--color-text-primary)', fontSize: '20px' }}>Close Friends</h3>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '32px', lineHeight: '1.5' }}>
                        Create a special list of people you want to share more personal moments with on ZUNO.
                  </p>
                  <button style={{
                        width: '100%',
                        padding: '16px',
                        borderRadius: '14px',
                        border: 'none',
                        background: 'var(--gradient-primary, linear-gradient(135deg, #6366f1 0%, #a855f7 100%))',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '16px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                  }}>
                        Get Started
                  </button>
            </div>
      </ModalWrapper>
);

const ArchiveModal = ({ onClose }) => (
      <ModalWrapper title="Archive" onClose={onClose}>
            <div style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'rgba(245, 158, 11, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px auto',
                        fontSize: '40px'
                  }}>📦</div>
                  <h3 style={{ marginBottom: '12px', color: 'var(--color-text-primary)', fontSize: '20px' }}>Your Archive</h3>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
                        Only you can see the posts you've archived.
                  </p>
                  <div style={{
                        padding: '48px 20px',
                        backgroundColor: 'var(--color-bg-secondary)',
                        borderRadius: '16px',
                        border: '1px dashed var(--color-border)',
                        color: 'var(--color-text-muted)'
                  }}>
                        <p>No archived posts yet ✨</p>
                  </div>
            </div>
      </ModalWrapper>
);

const CreatorToolsModal = ({ onClose }) => (
      <ModalWrapper title="Creator Tools" onClose={onClose}>
            <div style={{ padding: '24px' }}>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🚀</div>
                        <h3 style={{ color: 'var(--color-text-primary)', fontSize: '20px' }}>Creator Dashboard</h3>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Elevate your presence on ZUNO</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <SettingsOption icon="💎" label="Verification" subtitle="Apply for the blue tick" />
                        <SettingsOption icon="📈" label="Channel Insights" subtitle="Track your growth" />
                        <SettingsOption icon="💰" label="Monetization" badge="Locked" subtitle="Coming soon to your region" />
                        <SettingsOption icon="📱" label="Branded Content" subtitle="Manage your partnerships" />
                  </div>
            </div>
      </ModalWrapper>
);

// Reusable Modal Wrapper
const ModalWrapper = ({ title, onClose, children }) => (
      <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
            padding: '20px'
      }} onClick={onClose}>
            <div style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderRadius: '20px',
                  maxWidth: '500px',
                  width: '100%',
                  maxHeight: '80vh',
                  overflow: 'auto',
                  border: '1px solid var(--color-border)'
            }} onClick={(e) => e.stopPropagation()}>
                  <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '20px',
                        borderBottom: '1px solid var(--color-border)',
                        position: 'sticky',
                        top: 0,
                        backgroundColor: 'var(--color-bg-card)',
                        zIndex: 1
                  }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--color-text-primary)' }}>{title}</h2>
                        <button onClick={onClose} style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              border: 'none',
                              backgroundColor: 'var(--color-bg-secondary)',
                              color: 'var(--color-text-primary)',
                              cursor: 'pointer',
                              fontSize: '18px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                        }}>✕</button>
                  </div>
                  {children}
            </div>
      </div>
);

// Stat Card Component
const StatCard = ({ label, value, icon }) => (
      <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            marginBottom: '12px',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--color-border)'
      }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>{icon}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
            </div>
            <span style={{ fontWeight: '600', fontSize: '18px', color: 'var(--color-text-primary)' }}>{value}</span>
      </div>
);

export default Settings;
