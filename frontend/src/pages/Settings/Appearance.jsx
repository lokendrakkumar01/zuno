import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Appearance = () => {
      const navigate = useNavigate();
      const { user } = useAuth();
      const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
      const [message, setMessage] = useState('');

      useEffect(() => {
            const savedTheme = localStorage.getItem('theme') || 'light';
            setTheme(savedTheme);
      }, []);

      const handleThemeChange = (newTheme) => {
            setTheme(newTheme);
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            setMessage('✅ Theme updated!');
            setTimeout(() => setMessage(''), 2000);
      };

      const themes = [
            { value: 'dark', label: '🌙 Dark Mode', description: 'Easy on the eyes in low light' },
            { value: 'light', label: '☀️ Light Mode', description: 'Bright and clear' },
            { value: 'system', label: '💻 System Default', description: 'Follows your device settings' }
      ];

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
                        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>Appearance</h1>
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
                        overflow: 'hidden',
                        border: '1px solid var(--color-border)',
                        padding: '20px'
                  }}>
                        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--color-text-primary)' }}>
                              Choose Theme
                        </h2>
                        {themes.map((themeOption) => (
                              <div
                                    key={themeOption.value}
                                    onClick={() => handleThemeChange(themeOption.value)}
                                    style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '16px',
                                          marginBottom: '12px',
                                          borderRadius: '12px',
                                          border: theme === themeOption.value ? '2px solid var(--color-accent-primary)' : '1px solid var(--color-border)',
                                          backgroundColor: theme === themeOption.value ? 'rgba(99, 102, 241, 0.1)' : 'var(--color-bg-secondary)',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s ease'
                                    }}
                              >
                                    <div>
                                          <div style={{ fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                                                {themeOption.label}
                                          </div>
                                          <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                                {themeOption.description}
                                          </div>
                                    </div>
                                    {theme === themeOption.value && (
                                          <span style={{ fontSize: '20px' }}>✓</span>
                                    )}
                              </div>
                        ))}
                  </div>
            </div>
      );
};

export default Appearance;
