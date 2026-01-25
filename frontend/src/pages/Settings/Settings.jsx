import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../config';
import SettingsOption from '../../components/Settings/SettingsOption';

const Settings = () => {
      const { user, token, logout } = useAuth();
      const navigate = useNavigate();
      const [loading, setLoading] = useState(false);
      const [message, setMessage] = useState('');

      // Modal states
      const [showActivity, setShowActivity] = useState(false);
      const [showTimeManagement, setShowTimeManagement] = useState(false);
      const [showInsights, setShowInsights] = useState(false);
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
            <div className="container" style={{ paddingTop: '20px', paddingBottom: '100px', maxWidth: '600px' }}>
                  <h1 style={{
                        fontSize: '28px',
                        fontWeight: '700',
                        marginBottom: '24px',
                        padding: '0 16px'
                  }}>
                        ⚙️ Settings
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

                  <div style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        border: '1px solid var(--color-border)'
                  }}>
                        {/* For You Section */}
                        <SectionTitle title="For you" />
                        <SettingsOption
                              icon="📑"
                              label="Saved"
                              subtitle="Your saved posts and content"
                              onClick={() => navigate('/content/saved')}
                        />
                        <SettingsOption
                              icon="📦"
                              label="Archive"
                              subtitle="Posts you've archived"
                              onClick={() => setShowArchive(true)}
                        />
                        <SettingsOption
                              icon="📊"
                              label="Your activity"
                              subtitle="Time spent, posts viewed, and more"
                              onClick={() => setShowActivity(true)}
                        />
                        <SettingsOption
                              icon="🔔"
                              label="Notifications"
                              subtitle="Manage your notification preferences"
                              onClick={() => navigate('/settings/notifications')}
                        />
                        <SettingsOption
                              icon="⏰"
                              label="Time management"
                              subtitle="Set daily time limits and reminders"
                              onClick={() => setShowTimeManagement(true)}
                        />

                        {/* For Professionals Section */}
                        <SectionTitle title="For professionals" />
                        <SettingsOption
                              icon="📈"
                              label="Insights"
                              subtitle="View your content analytics"
                              onClick={() => setShowInsights(true)}
                        />
                        <SettingsOption
                              icon="✓"
                              label="Meta Verified"
                              badge="Not subscribed"
                              subtitle="Get the blue checkmark"
                              onClick={() => alert('Meta Verified subscription - Coming soon!')}
                        />
                        <SettingsOption
                              icon="📅"
                              label="Scheduled content"
                              subtitle="Schedule posts for later"
                              onClick={() => alert('Scheduled content - Coming soon!')}
                        />
                        <SettingsOption
                              icon="🛠️"
                              label="Creator tools and controls"
                              subtitle="Manage your creator features"
                              onClick={() => setShowCreatorTools(true)}
                        />

                        {/* Who Can See Your Content Section */}
                        <SectionTitle title="Who can see your content" />
                        <SettingsOption
                              icon="🔒"
                              label="Account privacy"
                              value={user?.isPrivate ? 'Private' : 'Public'}
                              onClick={() => navigate('/settings/privacy')}
                        />
                        <SettingsOption
                              icon="👥"
                              label="Close Friends"
                              subtitle="Share with your closest friends"
                              onClick={() => setShowCloseFriends(true)}
                        />

                        {/* How You Use ZUNO Section */}
                        <SectionTitle title="How you use ZUNO" />
                        <SettingsOption
                              icon="🎨"
                              label="Appearance"
                              value={localStorage.getItem('theme') === 'light' ? 'Light' : localStorage.getItem('theme') === 'dark' ? 'Dark' : 'System'}
                              onClick={() => navigate('/settings/appearance')}
                        />
                        <SettingsOption
                              icon="🌍"
                              label="Language"
                              value={user?.language === 'hi' ? 'Hindi' : 'English'}
                              onClick={() => navigate('/settings/language')}
                        />

                        {/* Account Section */}
                        <SectionTitle title="Your account" />
                        <SettingsOption
                              icon="👤"
                              label="Personal information"
                              subtitle="Edit your profile details"
                              onClick={() => navigate('/profile')}
                        />
                        <SettingsOption
                              icon="🔐"
                              label="Password and security"
                              onClick={() => alert('Password settings - Coming soon!')}
                        />
                        <SettingsOption
                              icon="🚪"
                              label="Log out"
                              onClick={handleLogout}
                        />
                        <SettingsOption
                              icon="🗑️"
                              label="Delete account"
                              onClick={() => {
                                    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                                          alert('Contact support to delete your account');
                                    }
                              }}
                        />
                  </div>

                  {/* Modal for Your Activity */}
                  {showActivity && (
                        <ActivityModal onClose={() => setShowActivity(false)} />
                  )}

                  {/* Modal for Time Management */}
                  {showTimeManagement && (
                        <TimeManagementModal onClose={() => setShowTimeManagement(false)} />
                  )}

                  {/* Modal for Insights */}
                  {showInsights && (
                        <InsightsModal onClose={() => setShowInsights(false)} />
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

// Simple Modal Components (placeholders for now)
const ActivityModal = ({ onClose }) => (
      <ModalWrapper title="Your Activity" onClose={onClose}>
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                  <h3 style={{ marginBottom: '8px', color: 'var(--color-text-primary)' }}>Activity Dashboard</h3>
                  <p>Track your time spent, posts viewed, and interactions</p>
                  <div style={{ marginTop: '24px', textAlign: 'left' }}>
                        <StatCard label="Time Today" value="2h 34m" icon="⏱️" />
                        <StatCard label="Posts Viewed" value="45" icon="👁️" />
                        <StatCard label="Likes Given" value="23" icon="❤️" />
                        <StatCard label="Comments" value="8" icon="💬" />
                  </div>
            </div>
      </ModalWrapper>
);

const TimeManagementModal = ({ onClose }) => (
      <ModalWrapper title="Time Management" onClose={onClose}>
            <div style={{ padding: '20px' }}>
                  <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '16px' }}>⏰</div>
                  <h3 style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--color-text-primary)' }}>Set Daily Limit</h3>
                  <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>Daily time limit (hours)</label>
                        <input type="number" min="0" max="12" defaultValue="2" style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid var(--color-border)',
                              backgroundColor: 'var(--color-bg-secondary)',
                              color: 'var(--color-text-primary)'
                        }} />
                  </div>
                  <button style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'var(--gradient-primary)',
                        color: 'white',
                        fontWeight: '600',
                        cursor: 'pointer'
                  }}>
                        Save Limit
                  </button>
            </div>
      </ModalWrapper>
);

const InsightsModal = ({ onClose }) => (
      <ModalWrapper title="Insights" onClose={onClose}>
            <div style={{ padding: '20px' }}>
                  <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '16px' }}>📈</div>
                  <h3 style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--color-text-primary)' }}>Content Analytics</h3>
                  <div>
                        <StatCard label="Total Reach" value="1,234" icon="👥" />
                        <StatCard label="Engagement Rate" value="8.5%" icon="💓" />
                        <StatCard label="Profile Visits" value="456" icon="👁️" />
                        <StatCard label="New Followers" value="89" icon="➕" />
                  </div>
            </div>
      </ModalWrapper>
);

const CloseFriendsModal = ({ onClose }) => (
      <ModalWrapper title="Close Friends" onClose={onClose}>
            <div style={{ padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                  <h3 style={{ marginBottom: '8px', color: 'var(--color-text-primary)' }}>Manage Close Friends</h3>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
                        Share exclusive content with your closest friends
                  </p>
                  <button style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'var(--gradient-primary)',
                        color: 'white',
                        fontWeight: '600',
                        cursor: 'pointer'
                  }}>
                        Add Close Friends
                  </button>
            </div>
      </ModalWrapper>
);

const ArchiveModal = ({ onClose }) => (
      <ModalWrapper title="Archive" onClose={onClose}>
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
                  <h3 style={{ marginBottom: '8px', color: 'var(--color-text-primary)' }}>Your Archive</h3>
                  <p>Posts you've archived will appear here</p>
                  <div style={{ marginTop: '24px', padding: '40px 20px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '12px' }}>
                        <p>No archived posts yet</p>
                  </div>
            </div>
      </ModalWrapper>
);

const CreatorToolsModal = ({ onClose }) => (
      <ModalWrapper title="Creator Tools" onClose={onClose}>
            <div style={{ padding: '20px' }}>
                  <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '16px' }}>🛠️</div>
                  <h3 style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--color-text-primary)' }}>Creator Dashboard</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <SettingsOption icon="💰" label="Monetization" subtitle="Coming soon" />
                        <SettingsOption icon="📊" label="Analytics" subtitle="View detailed stats" />
                        <SettingsOption icon="🎥" label="Content Studio" subtitle="Manage all content" />
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
