import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../config';

const Settings = () => {
      const { user, token, logout } = useAuth();
      const navigate = useNavigate();
      const [loading, setLoading] = useState(false);
      const [message, setMessage] = useState('');
      const [activeTab, setActiveTab] = useState('profile');

      const [formData, setFormData] = useState({
            displayName: '',
            bio: '',
            email: '',
            isPrivate: false,
            profileVisibility: 'public',
            notificationsEnabled: true,
            emailNotifications: true,
            theme: 'dark',
            language: 'en'
      });

      // Load theme on mount and apply it
      useEffect(() => {
            const savedTheme = localStorage.getItem('theme') || 'dark';
            document.documentElement.setAttribute('data-theme', savedTheme);
      }, []);

      useEffect(() => {
            if (user) {
                  setFormData({
                        displayName: user.displayName || '',
                        bio: user.bio || '',
                        email: user.email || '',
                        isPrivate: user.isPrivate || false,
                        profileVisibility: user.profileVisibility || 'public',
                        notificationsEnabled: user.notificationsEnabled !== false,
                        emailNotifications: user.emailNotifications !== false,
                        theme: localStorage.getItem('theme') || 'dark',
                        language: user.language || 'en'
                  });
            }
      }, [user]);

      // Apply theme immediately when it changes
      useEffect(() => {
            if (formData.theme) {
                  document.documentElement.setAttribute('data-theme', formData.theme);
                  localStorage.setItem('theme', formData.theme);
            }
      }, [formData.theme]);

      const handleChange = (e) => {
            const { name, value, type, checked } = e.target;
            setFormData(prev => ({
                  ...prev,
                  [name]: type === 'checkbox' ? checked : value
            }));
      };

      const handleSubmit = async (e) => {
            e.preventDefault();
            setLoading(true);
            setMessage('');

            try {
                  const res = await fetch(`${API_URL}/users/profile`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(formData)
                  });
                  const data = await res.json();

                  if (data.success) {
                        setMessage('✅ Settings updated successfully!');
                        if (formData.theme) {
                              localStorage.setItem('theme', formData.theme);
                        }
                  } else {
                        setMessage(`❌ ${data.message || 'Update failed'}`);
                  }
            } catch (error) {
                  setMessage('❌ Failed to update settings');
            }
            setLoading(false);
      };

      const handleLogout = () => {
            logout();
            navigate('/login');
      };

      const tabs = [
            { id: 'profile', label: '👤 Profile', icon: '👤' },
            { id: 'privacy', label: '🔒 Privacy', icon: '🔒' },
            { id: 'notifications', label: '🔔 Notifications', icon: '🔔' },
            { id: 'appearance', label: '🎨 Appearance', icon: '🎨' },
            { id: 'account', label: '⚙️ Account', icon: '⚙️' }
      ];

      return (
            <div className="container animate-fadeIn" style={{ paddingTop: '20px', paddingBottom: '100px' }}>
                  <h1 className="text-2xl font-bold mb-lg" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        ⚙️ Settings
                  </h1>

                  {message && (
                        <div className={`card p-md mb-lg ${message.includes('✅') ? 'bg-green-50' : 'bg-red-50'}`}
                              style={{ border: message.includes('✅') ? '1px solid #22c55e' : '1px solid #ef4444' }}>
                              {message}
                        </div>
                  )}

                  {/* Tabs */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '8px' }}>
                        {tabs.map(tab => (
                              <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                          padding: '10px 16px',
                                          borderRadius: '20px',
                                          border: 'none',
                                          background: activeTab === tab.id ? 'var(--gradient-primary)' : 'var(--color-bg-secondary)',
                                          color: activeTab === tab.id ? 'white' : 'var(--color-text-secondary)',
                                          cursor: 'pointer',
                                          whiteSpace: 'nowrap',
                                          fontWeight: activeTab === tab.id ? '600' : '400',
                                          transition: 'all 0.2s ease'
                                    }}
                              >
                                    {tab.label}
                              </button>
                        ))}
                  </div>

                  <div className="grid gap-lg">
                        {/* Profile Tab */}
                        {activeTab === 'profile' && (
                              <div className="card">
                                    <h2 className="text-lg font-semibold mb-md">👤 Profile Information</h2>
                                    <div className="input-group mb-md">
                                          <label className="input-label">Display Name</label>
                                          <input
                                                type="text"
                                                name="displayName"
                                                value={formData.displayName}
                                                onChange={handleChange}
                                                className="input"
                                                placeholder="Your display name"
                                          />
                                    </div>
                                    <div className="input-group mb-md">
                                          <label className="input-label">Bio</label>
                                          <textarea
                                                name="bio"
                                                value={formData.bio}
                                                onChange={handleChange}
                                                className="input"
                                                rows="3"
                                                placeholder="Tell us about yourself..."
                                          />
                                    </div>
                                    <div className="input-group mb-md">
                                          <label className="input-label">Email</label>
                                          <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                className="input"
                                                placeholder="your@email.com"
                                          />
                                    </div>
                              </div>
                        )}

                        {/* Privacy Tab */}
                        {activeTab === 'privacy' && (
                              <div className="card">
                                    <h2 className="text-lg font-semibold mb-md">🔒 Privacy & Safety</h2>

                                    <div className="flex items-center justify-between p-md mb-sm" style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                          <div>
                                                <strong className="block">🔐 Private Account</strong>
                                                <span className="text-sm text-muted">Only approved followers can see your content</span>
                                          </div>
                                          <input
                                                type="checkbox"
                                                name="isPrivate"
                                                checked={formData.isPrivate}
                                                onChange={handleChange}
                                                style={{ transform: 'scale(1.5)', accentColor: 'var(--color-accent-primary)' }}
                                          />
                                    </div>

                                    <div className="input-group mb-md">
                                          <label className="input-label">👁️ Profile Visibility</label>
                                          <select
                                                name="profileVisibility"
                                                value={formData.profileVisibility}
                                                onChange={handleChange}
                                                className="input"
                                          >
                                                <option value="public">🌍 Public - Anyone can view</option>
                                                <option value="friends">👥 Friends Only</option>
                                                <option value="private">🔒 Private - Only you</option>
                                          </select>
                                    </div>
                              </div>
                        )}

                        {/* Notifications Tab */}
                        {activeTab === 'notifications' && (
                              <div className="card">
                                    <h2 className="text-lg font-semibold mb-md">🔔 Notification Preferences</h2>

                                    <div className="flex items-center justify-between p-md mb-sm" style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                          <div>
                                                <strong className="block">📱 Push Notifications</strong>
                                                <span className="text-sm text-muted">Receive notifications on your device</span>
                                          </div>
                                          <input
                                                type="checkbox"
                                                name="notificationsEnabled"
                                                checked={formData.notificationsEnabled}
                                                onChange={handleChange}
                                                style={{ transform: 'scale(1.5)', accentColor: 'var(--color-accent-primary)' }}
                                          />
                                    </div>

                                    <div className="flex items-center justify-between p-md mb-sm" style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                          <div>
                                                <strong className="block">📧 Email Notifications</strong>
                                                <span className="text-sm text-muted">Receive updates via email</span>
                                          </div>
                                          <input
                                                type="checkbox"
                                                name="emailNotifications"
                                                checked={formData.emailNotifications}
                                                onChange={handleChange}
                                                style={{ transform: 'scale(1.5)', accentColor: 'var(--color-accent-primary)' }}
                                          />
                                    </div>
                              </div>
                        )}

                        {/* Appearance Tab */}
                        {activeTab === 'appearance' && (
                              <div className="card">
                                    <h2 className="text-lg font-semibold mb-md">🎨 Appearance</h2>

                                    <div className="input-group mb-md">
                                          <label className="input-label">🌙 Theme</label>
                                          <select
                                                name="theme"
                                                value={formData.theme}
                                                onChange={handleChange}
                                                className="input"
                                          >
                                                <option value="dark">🌙 Dark Mode</option>
                                                <option value="light">☀️ Light Mode</option>
                                                <option value="system">💻 System Default</option>
                                          </select>
                                    </div>

                                    <div className="input-group mb-md">
                                          <label className="input-label">🌍 Language</label>
                                          <select
                                                name="language"
                                                value={formData.language}
                                                onChange={handleChange}
                                                className="input"
                                          >
                                                <option value="en">🇬🇧 English</option>
                                                <option value="hi">🇮🇳 Hindi</option>
                                                <option value="es">🇪🇸 Spanish</option>
                                                <option value="fr">🇫🇷 French</option>
                                          </select>
                                    </div>
                              </div>
                        )}

                        {/* Account Tab */}
                        {activeTab === 'account' && (
                              <div className="card">
                                    <h2 className="text-lg font-semibold mb-md">⚙️ Account Settings</h2>

                                    <div className="p-md mb-md" style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                          <strong className="block mb-sm">📋 Account Info</strong>
                                          <p className="text-sm text-muted">Username: @{user?.username || 'N/A'}</p>
                                          <p className="text-sm text-muted">Member since: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>
                                    </div>

                                    <button
                                          onClick={handleLogout}
                                          className="btn"
                                          style={{ width: '100%', background: 'var(--color-text-secondary)', color: 'white', marginBottom: '12px' }}
                                    >
                                          🚪 Logout
                                    </button>

                                    <button
                                          className="btn"
                                          style={{ width: '100%', background: '#ef4444', color: 'white' }}
                                          onClick={() => alert('Contact support to delete your account')}
                                    >
                                          🗑️ Delete Account
                                    </button>
                              </div>
                        )}

                        {/* Save Button */}
                        {activeTab !== 'account' && (
                              <button
                                    onClick={handleSubmit}
                                    className="btn btn-primary"
                                    disabled={loading}
                                    style={{ width: '100%' }}
                              >
                                    {loading ? '⏳ Saving...' : '💾 Save Changes'}
                              </button>
                        )}
                  </div>
            </div>
      );
};

export default Settings;

