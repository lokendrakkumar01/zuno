import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Settings = () => {
      const { user, token } = useAuth();
      const navigate = useNavigate();
      const [loading, setLoading] = useState(false);
      const [message, setMessage] = useState('');

      const [formData, setFormData] = useState({
            displayName: '',
            bio: '',
            isPrivate: false,
            profileVisibility: 'public'
      });

      useEffect(() => {
            if (user) {
                  setFormData({
                        displayName: user.displayName || '',
                        bio: user.bio || '',
                        isPrivate: user.isPrivate || false,
                        profileVisibility: user.profileVisibility || 'public'
                  });
            }
      }, [user]);

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
                  const res = await fetch('/api/users/profile', {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(formData)
                  });
                  const data = await res.json();

                  if (data.success) {
                        setMessage('Settings updated successfully! ✅');
                        // Ideally refresh user context here
                  } else {
                        setMessage(data.message || 'Update failed');
                  }
            } catch (error) {
                  setMessage('Failed to update settings');
            }
            setLoading(false);
      };

      return (
            <div className="container animate-fadeIn" style={{ paddingTop: '20px' }}>
                  <h1 className="text-2xl font-bold mb-lg">Settings</h1>

                  {message && (
                        <div className={`card p-md mb-lg ${message.includes('success') ? 'bg-green-50' : 'bg-red-50'}`}>
                              {message}
                        </div>
                  )}

                  <div className="grid gap-lg">
                        <div className="card">
                              <h2 className="text-lg font-semibold mb-md">Profile Settings</h2>
                              <div className="input-group mb-md">
                                    <label className="input-label">Display Name</label>
                                    <input
                                          type="text"
                                          name="displayName"
                                          value={formData.displayName}
                                          onChange={handleChange}
                                          className="input"
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
                                    />
                              </div>
                        </div>

                        <div className="card">
                              <h2 className="text-lg font-semibold mb-md">Privacy & Safety</h2>
                              <div className="flex items-center justify-between p-md mb-sm" style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                    <div>
                                          <strong className="block">Private Account</strong>
                                          <span className="text-sm text-muted">Only approved followers can see your content</span>
                                    </div>
                                    <label className="switch">
                                          <input
                                                type="checkbox"
                                                name="isPrivate"
                                                checked={formData.isPrivate}
                                                onChange={handleChange}
                                                style={{ transform: 'scale(1.5)', accentColor: 'var(--color-accent-primary)' }}
                                          />
                                    </label>
                              </div>
                        </div>

                        <button
                              onClick={handleSubmit}
                              className="btn btn-primary"
                              disabled={loading}
                        >
                              {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                  </div>
            </div>
      );
};

export default Settings;
