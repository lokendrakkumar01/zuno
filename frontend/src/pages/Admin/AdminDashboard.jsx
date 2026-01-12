import { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const AdminDashboard = () => {
      const { user, token, isAuthenticated } = useAuth();
      const navigate = useNavigate();
      const location = useLocation();

      if (!isAuthenticated || user?.role !== 'admin') {
            return (
                  <div className="auth-page">
                        <div className="card text-center p-xl">
                              <div className="text-3xl mb-md">🔐</div>
                              <h2 className="text-xl font-semibold mb-md">Admin Access Required</h2>
                              <p className="text-muted mb-lg">You need admin privileges to access this area.</p>
                              <button onClick={() => navigate('/')} className="btn btn-primary">
                                    Go Home
                              </button>
                        </div>
                  </div>
            );
      }

      return (
            <div className="admin-page" style={{ minHeight: '100vh', background: 'var(--color-bg-primary)' }}>
                  {/* Admin Header */}
                  <header className="header">
                        <div className="container header-inner">
                              <Link to="/admin" className="logo">
                                    <div className="logo-icon" style={{ background: '#ef4444' }}>A</div>
                                    <span>ZUNO Admin</span>
                              </Link>
                              <nav className="nav">
                                    <Link to="/admin" className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}>
                                          Dashboard
                                    </Link>
                                    <Link to="/admin/users" className={`nav-link ${location.pathname === '/admin/users' ? 'active' : ''}`}>
                                          Users
                                    </Link>
                                    <Link to="/admin/content" className={`nav-link ${location.pathname === '/admin/content' ? 'active' : ''}`}>
                                          Content
                                    </Link>
                                    <Link to="/admin/config" className={`nav-link ${location.pathname === '/admin/config' ? 'active' : ''}`}>
                                          Config
                                    </Link>
                                    <Link to="/" className="btn btn-ghost btn-sm">Exit Admin</Link>
                              </nav>
                        </div>
                  </header>

                  <main className="main">
                        <div className="container">
                              <Routes>
                                    <Route index element={<DashboardHome token={token} />} />
                                    <Route path="users" element={<UsersManagement token={token} />} />
                                    <Route path="content" element={<ContentManagement token={token} />} />
                                    <Route path="config" element={<ConfigManagement token={token} />} />
                              </Routes>
                        </div>
                  </main>
            </div>
      );
};

// Dashboard Home
const DashboardHome = ({ token }) => {
      const [stats, setStats] = useState(null);
      const [loading, setLoading] = useState(true);

      useEffect(() => {
            const fetchStats = async () => {
                  try {
                        const res = await fetch('/api/admin/stats', {
                              headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const data = await res.json();
                        if (data.success) {
                              setStats(data.data);
                        }
                  } catch (error) {
                        console.error('Failed to fetch stats:', error);
                  }
                  setLoading(false);
            };
            fetchStats();
      }, [token]);

      if (loading) {
            return <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>;
      }

      return (
            <div className="animate-fadeIn">
                  <h1 className="text-2xl font-bold mb-lg">Admin Dashboard</h1>

                  <div className="grid grid-cols-3 gap-md mb-xl">
                        <div className="card text-center">
                              <div className="text-3xl font-bold" style={{ color: 'var(--color-accent-primary)' }}>
                                    {stats?.totalUsers || 0}
                              </div>
                              <div className="text-sm text-muted">Total Users</div>
                        </div>
                        <div className="card text-center">
                              <div className="text-3xl font-bold" style={{ color: 'var(--color-accent-success)' }}>
                                    {stats?.totalContent || 0}
                              </div>
                              <div className="text-sm text-muted">Total Content</div>
                        </div>
                        <div className="card text-center">
                              <div className="text-3xl font-bold" style={{ color: 'var(--color-accent-warning)' }}>
                                    {stats?.totalReports || 0}
                              </div>
                              <div className="text-sm text-muted">Reports</div>
                        </div>
                  </div>

                  {/* Content by Type */}
                  <div className="card mb-lg">
                        <h3 className="font-semibold mb-md">Content by Type</h3>
                        <div className="flex gap-md flex-wrap">
                              {stats?.contentByType?.map(item => (
                                    <div key={item._id} className="tag">
                                          {item._id}: {item.count}
                                    </div>
                              ))}
                        </div>
                  </div>

                  {/* Users by Role */}
                  <div className="card">
                        <h3 className="font-semibold mb-md">Users by Role</h3>
                        <div className="flex gap-md flex-wrap">
                              {stats?.usersByRole?.map(item => (
                                    <div key={item._id} className="tag tag-primary">
                                          {item._id}: {item.count}
                                    </div>
                              ))}
                        </div>
                  </div>
            </div>
      );
};

// Users Management
const UsersManagement = ({ token }) => {
      const [users, setUsers] = useState([]);
      const [loading, setLoading] = useState(true);
      const [search, setSearch] = useState('');

      const fetchUsers = async () => {
            setLoading(true);
            try {
                  const res = await fetch(`/api/admin/users?search=${search}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setUsers(data.data.users);
                  }
            } catch (error) {
                  console.error('Failed:', error);
            }
            setLoading(false);
      };

      useEffect(() => {
            fetchUsers();
      }, [token]);

      const handleRoleChange = async (userId, newRole) => {
            try {
                  await fetch(`/api/admin/users/${userId}`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ role: newRole })
                  });
                  fetchUsers();
            } catch (error) {
                  console.error('Failed:', error);
            }
      };

      return (
            <div className="animate-fadeIn">
                  <h1 className="text-2xl font-bold mb-lg">User Management</h1>

                  <div className="flex gap-md mb-lg">
                        <input
                              type="text"
                              className="input"
                              placeholder="Search users..."
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              style={{ maxWidth: '300px' }}
                        />
                        <button onClick={fetchUsers} className="btn btn-primary">Search</button>
                  </div>

                  {loading ? (
                        <div className="spinner" style={{ margin: '0 auto' }}></div>
                  ) : (
                        <div className="card">
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <th style={{ padding: '1rem', textAlign: 'left' }}>User</th>
                                                <th style={{ padding: '1rem', textAlign: 'left' }}>Email</th>
                                                <th style={{ padding: '1rem', textAlign: 'left' }}>Role</th>
                                                <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                                          </tr>
                                    </thead>
                                    <tbody>
                                          {users.map(u => (
                                                <tr key={u._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                      <td style={{ padding: '1rem' }}>
                                                            <div className="flex items-center gap-sm">
                                                                  <div className="avatar avatar-sm">
                                                                        {u.displayName?.charAt(0) || u.username?.charAt(0)}
                                                                  </div>
                                                                  <div>
                                                                        <div className="font-medium">{u.displayName || u.username}</div>
                                                                        <div className="text-sm text-muted">@{u.username}</div>
                                                                  </div>
                                                            </div>
                                                      </td>
                                                      <td style={{ padding: '1rem' }} className="text-muted">{u.email}</td>
                                                      <td style={{ padding: '1rem' }}>
                                                            <select
                                                                  className="input"
                                                                  value={u.role}
                                                                  onChange={(e) => handleRoleChange(u._id, e.target.value)}
                                                                  style={{ padding: '0.5rem', width: 'auto' }}
                                                            >
                                                                  <option value="user">User</option>
                                                                  <option value="creator">Creator</option>
                                                                  <option value="mentor">Mentor</option>
                                                                  <option value="moderator">Moderator</option>
                                                                  <option value="admin">Admin</option>
                                                            </select>
                                                      </td>
                                                      <td style={{ padding: '1rem' }}>
                                                            <span className={`tag ${u.isActive ? 'tag-success' : ''}`}>
                                                                  {u.isActive ? 'Active' : 'Inactive'}
                                                            </span>
                                                      </td>
                                                </tr>
                                          ))}
                                    </tbody>
                              </table>
                        </div>
                  )}
            </div>
      );
};

// Content Management
const ContentManagement = ({ token }) => {
      const [contents, setContents] = useState([]);
      const [loading, setLoading] = useState(true);

      const fetchContent = async () => {
            setLoading(true);
            try {
                  const res = await fetch('/api/admin/content', {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setContents(data.data.contents);
                  }
            } catch (error) {
                  console.error('Failed:', error);
            }
            setLoading(false);
      };

      useEffect(() => {
            fetchContent();
      }, [token]);

      const handleModerate = async (contentId, action) => {
            try {
                  await fetch(`/api/admin/content/${contentId}`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(action)
                  });
                  fetchContent();
            } catch (error) {
                  console.error('Failed:', error);
            }
      };

      return (
            <div className="animate-fadeIn">
                  <h1 className="text-2xl font-bold mb-lg">Content Moderation</h1>

                  {loading ? (
                        <div className="spinner" style={{ margin: '0 auto' }}></div>
                  ) : (
                        <div className="content-grid">
                              {contents.map(c => (
                                    <div key={c._id} className="card">
                                          <div className="flex justify-between items-start mb-md">
                                                <div>
                                                      <h3 className="font-semibold">{c.title || 'Untitled'}</h3>
                                                      <p className="text-sm text-muted">by @{c.creator?.username}</p>
                                                </div>
                                                <span className={`tag ${c.isApproved ? 'tag-success' : ''}`}>
                                                      {c.isApproved ? 'Approved' : 'Pending'}
                                                </span>
                                          </div>
                                          <p className="text-sm text-secondary mb-md">
                                                {c.body?.substring(0, 100)}...
                                          </p>
                                          <div className="flex gap-sm">
                                                <span className="tag">{c.contentType}</span>
                                                <span className="tag">{c.status}</span>
                                          </div>
                                          <div className="flex gap-sm mt-md">
                                                {!c.isApproved && (
                                                      <button
                                                            onClick={() => handleModerate(c._id, { isApproved: true })}
                                                            className="btn btn-sm btn-primary"
                                                      >
                                                            Approve
                                                      </button>
                                                )}
                                                <button
                                                      onClick={() => handleModerate(c._id, { status: 'removed' })}
                                                      className="btn btn-sm btn-ghost"
                                                      style={{ color: '#ef4444' }}
                                                >
                                                      Remove
                                                </button>
                                          </div>
                                    </div>
                              ))}
                        </div>
                  )}
            </div>
      );
};

// Config Management
const ConfigManagement = ({ token }) => {
      const [configs, setConfigs] = useState([]);
      const [loading, setLoading] = useState(true);
      const [message, setMessage] = useState('');

      const fetchConfigs = async () => {
            try {
                  const res = await fetch('/api/admin/config', {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setConfigs(data.data.configs);
                  }
            } catch (error) {
                  console.error('Failed:', error);
            }
            setLoading(false);
      };

      useEffect(() => {
            fetchConfigs();
      }, [token]);

      const initConfigs = async () => {
            try {
                  await fetch('/api/admin/config/init', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  setMessage('Default configs initialized! ✅');
                  fetchConfigs();
            } catch (error) {
                  setMessage('Failed to initialize configs');
            }
      };

      const toggleConfig = async (key, currentValue) => {
            try {
                  await fetch(`/api/admin/config/${key}`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ value: !currentValue })
                  });
                  fetchConfigs();
            } catch (error) {
                  console.error('Failed:', error);
            }
      };

      return (
            <div className="animate-fadeIn">
                  <div className="flex justify-between items-center mb-lg">
                        <h1 className="text-2xl font-bold">Feature Flags & Config</h1>
                        <button onClick={initConfigs} className="btn btn-secondary">
                              Initialize Defaults
                        </button>
                  </div>

                  {message && (
                        <div className="card p-md mb-lg" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
                              {message}
                        </div>
                  )}

                  {loading ? (
                        <div className="spinner" style={{ margin: '0 auto' }}></div>
                  ) : configs.length === 0 ? (
                        <div className="card text-center p-xl">
                              <p className="text-muted mb-md">No configs found. Click "Initialize Defaults" to set them up.</p>
                        </div>
                  ) : (
                        <div className="card">
                              {configs.map(config => (
                                    <div
                                          key={config.key}
                                          className="flex justify-between items-center p-md"
                                          style={{ borderBottom: '1px solid var(--color-border)' }}
                                    >
                                          <div>
                                                <div className="font-medium">{config.key}</div>
                                                <div className="text-sm text-muted">{config.description}</div>
                                                <span className="tag" style={{ marginTop: '0.5rem' }}>{config.category}</span>
                                          </div>
                                          <div className="flex items-center gap-md">
                                                {typeof config.value === 'boolean' ? (
                                                      <button
                                                            onClick={() => toggleConfig(config.key, config.value)}
                                                            className={`btn btn-sm ${config.value ? 'btn-primary' : 'btn-secondary'}`}
                                                      >
                                                            {config.value ? 'ON' : 'OFF'}
                                                      </button>
                                                ) : (
                                                      <span className="tag tag-primary">{String(config.value)}</span>
                                                )}
                                          </div>
                                    </div>
                              ))}
                        </div>
                  )}
            </div>
      );
};

export default AdminDashboard;
