import { useNavigate } from 'react-router-dom';

const ScheduledContent = () => {
      const navigate = useNavigate();

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
                        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>📅 Scheduled Content</h1>
                  </div>

                  <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '60px 20px',
                        textAlign: 'center',
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: '16px',
                        border: '1px solid var(--color-border)',
                        margin: '0 16px'
                  }}>
                        <div style={{ fontSize: '64px', marginBottom: '24px' }}>🗓️</div>
                        <h3 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '12px' }}>
                              No Scheduled Content
                        </h3>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '32px', maxWidth: '300px' }}>
                              You don't have any posts scheduled right now. Schedule your content to keep your audience engaged.
                        </p>
                        <button
                              onClick={() => navigate('/upload')} // Send to upload page or content creator
                              style={{
                                    padding: '14px 28px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: 'var(--gradient-primary)',
                                    color: 'white',
                                    fontWeight: '600',
                                    fontSize: '16px',
                                    cursor: 'pointer'
                              }}
                        >
                              Create Post
                        </button>
                  </div>
            </div>
      );
};

export default ScheduledContent;
