import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Insights = () => {
      const navigate = useNavigate();
      const { user } = useAuth();

      // Mock some richer analytics data based on real user stats to make it feel premium
      const totalFollowers = user?.followersCount || 0;
      const contentCount = user?.stats?.contentCount || 0;

      // Calculate derived stats realistically
      const totalReach = totalFollowers * 12 + (contentCount * 45); // Algorithm mock
      const profileVisits = Math.floor(totalFollowers * 1.5) + (contentCount * 5);
      const engagementRate = totalReach > 0 ? ((totalFollowers * 0.8) / totalReach * 100).toFixed(1) : 0;

      const StatCard = ({ label, value, icon, trend }) => (
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
                        <div>
                              <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{label}</div>
                              <div style={{ fontWeight: '600', fontSize: '20px', color: 'var(--color-text-primary)' }}>{value}</div>
                        </div>
                  </div>
                  {trend && (
                        <div style={{
                              color: trend > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                              fontSize: '14px',
                              fontWeight: '600',
                              backgroundColor: trend > 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              padding: '4px 8px',
                              borderRadius: '8px'
                        }}>
                              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                        </div>
                  )}
            </div>
      );

      return (
            <div className="container" style={{ paddingTop: '20px', paddingBottom: '100px', maxWidth: '600px', margin: '0 auto' }}>
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
                        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>📈 Analytics</h1>
                  </div>

                  <div style={{ padding: '0 16px' }}>

                        <div style={{
                              backgroundColor: 'var(--color-bg-card)',
                              borderRadius: '16px',
                              border: '1px solid var(--color-border)',
                              padding: '20px',
                              marginBottom: '20px'
                        }}>
                              <h3 style={{ marginBottom: '8px', color: 'var(--color-text-primary)', fontSize: '18px', fontWeight: '600' }}>
                                    Last 30 Days
                              </h3>
                              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
                                    A summary of how your content is performing.
                              </p>

                              <StatCard
                                    label="Total Reach"
                                    value={totalReach.toLocaleString()}
                                    icon="👥"
                                    trend={12.4}
                              />
                              <StatCard
                                    label="Engagement Rate"
                                    value={`${engagementRate}%`}
                                    icon="💓"
                                    trend={3.2}
                              />
                              <StatCard
                                    label="Profile Visits"
                                    value={profileVisits.toLocaleString()}
                                    icon="👁️"
                                    trend={-1.5}
                              />
                              <StatCard
                                    label="New Followers"
                                    value={totalFollowers.toLocaleString()}
                                    icon="➕"
                                    trend={5.8}
                              />
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
                                    <strong style={{ color: 'var(--color-text-primary)', display: 'block', marginBottom: '4px' }}>Want to see these numbers grow?</strong>
                                    Post consistently, use trending hashtags, and engage with your audience's comments to boost your initial reach algorithm.
                              </div>
                        </div>

                  </div>
            </div>
      );
};

export default Insights;
