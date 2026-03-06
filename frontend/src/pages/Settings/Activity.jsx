import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Activity = () => {
      const navigate = useNavigate();
      const { user } = useAuth(); // Assume we have stats in the context or we can fetch them

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
                        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>📊 Your Activity</h1>
                  </div>

                  <div style={{ padding: '0 16px' }}>
                        <div style={{
                              backgroundColor: 'var(--color-bg-card)',
                              borderRadius: '16px',
                              border: '1px solid var(--color-border)',
                              padding: '24px',
                              marginBottom: '20px',
                              textAlign: 'center'
                        }}>
                              <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                                    Activity Dashboard
                              </h3>
                              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                                    Track your engagement and reach across ZUNO.
                              </p>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{
                                          padding: '16px',
                                          backgroundColor: 'var(--color-bg-secondary)',
                                          borderRadius: '12px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center'
                                    }}>
                                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎥</div>
                                          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                                                {user?.stats?.contentCount || 0}
                                          </div>
                                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Posts</div>
                                    </div>
                                    <div style={{
                                          padding: '16px',
                                          backgroundColor: 'var(--color-bg-secondary)',
                                          borderRadius: '12px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center'
                                    }}>
                                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>👥</div>
                                          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                                                {user?.followersCount || 0}
                                          </div>
                                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Followers</div>
                                    </div>
                                    <div style={{
                                          padding: '16px',
                                          backgroundColor: 'var(--color-bg-secondary)',
                                          borderRadius: '12px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center'
                                    }}>
                                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🌟</div>
                                          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                                                {user?.stats?.helpfulReceived || 0}
                                          </div>
                                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px', textAlign: 'center' }}>Helpful Points</div>
                                    </div>
                                    <div style={{
                                          padding: '16px',
                                          backgroundColor: 'var(--color-bg-secondary)',
                                          borderRadius: '12px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center'
                                    }}>
                                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🤝</div>
                                          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                                                {user?.followingCount || 0}
                                          </div>
                                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Following</div>
                                    </div>
                              </div>
                        </div>

                        <div style={{
                              padding: '16px',
                              backgroundColor: 'rgba(99, 102, 241, 0.1)',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              borderRadius: '12px',
                              color: 'var(--color-text-secondary)',
                              fontSize: '14px',
                              display: 'flex',
                              gap: '12px',
                              alignItems: 'flex-start'
                        }}>
                              <span style={{ fontSize: '20px' }}>💡</span>
                              <div>
                                    <strong style={{ color: 'var(--color-text-primary)', display: 'block', marginBottom: '4px' }}>Keep growing your impact</strong>
                                    Share more valuable content and engage with the community to see these metrics go up!
                              </div>
                        </div>
                  </div>
            </div>
      );
};

export default Activity;
