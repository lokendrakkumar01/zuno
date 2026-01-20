import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

const Language = () => {
      const navigate = useNavigate();
      const { user, token } = useAuth();
      const [language, setLanguage] = useState(user?.language || 'en');
      const [message, setMessage] = useState('');
      const [loading, setLoading] = useState(false);

      const languages = [
            { code: 'en', name: 'English', flag: '🇬🇧', native: 'English' },
            { code: 'hi', name: 'Hindi', flag: '🇮🇳', native: 'हिन्दी' },
            { code: 'es', name: 'Spanish', flag: '🇪🇸', native: 'Español' },
            { code: 'fr', name: 'French', flag: '🇫🇷', native: 'Français' },
            { code: 'de', name: 'German', flag: '🇩🇪', native: 'Deutsch' },
            { code: 'ar', name: 'Arabic', flag: '🇸🇦', native: 'العربية' }
      ];

      const handleSave = async (selectedLang) => {
            setLanguage(selectedLang);
            setLoading(true);
            setMessage('');

            try {
                  const res = await fetch(`${API_URL}/users/profile`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ language: selectedLang })
                  });
                  const data = await res.json();

                  if (data.success) {
                        setMessage('✅ Language updated!');
                        setTimeout(() => setMessage(''), 2000);
                  } else {
                        setMessage(`❌ ${data.message || 'Update failed'}`);
                  }
            } catch (error) {
                  setMessage('❌ Failed to update language');
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
                        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>Language</h1>
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

                  <div style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        border: '1px solid var(--color-border)'
                  }}>
                        {languages.map((lang) => (
                              <div
                                    key={lang.code}
                                    onClick={() => handleSave(lang.code)}
                                    style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '16px 20px',
                                          borderBottom: '1px solid var(--color-border)',
                                          cursor: 'pointer',
                                          backgroundColor: language === lang.code ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                          transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                          if (language !== lang.code) {
                                                e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                                          }
                                    }}
                                    onMouseLeave={(e) => {
                                          if (language !== lang.code) {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                          }
                                    }}
                              >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                          <span style={{ fontSize: '28px' }}>{lang.flag}</span>
                                          <div>
                                                <div style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>
                                                      {lang.name}
                                                </div>
                                                <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                                      {lang.native}
                                                </div>
                                          </div>
                                    </div>
                                    {language === lang.code && (
                                          <span style={{ fontSize: '20px', color: 'var(--color-accent-primary)' }}>✓</span>
                                    )}
                              </div>
                        ))}
                  </div>

                  <div style={{
                        padding: '16px',
                        marginTop: '16px',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '12px',
                        color: 'var(--color-text-secondary)',
                        fontSize: '14px'
                  }}>
                        💡 <strong>Note:</strong> Language changes will affect menu items and some interface text. Content will still appear in its original language.
                  </div>
            </div>
      );
};

export default Language;
