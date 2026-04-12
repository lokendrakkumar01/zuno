import { useCallback, useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { API_URL, resolveAdminAssetUrl } from './config';

const STYLES = `
.admin-shell{min-height:100vh;background:linear-gradient(180deg,#fff9f2 0%,#f4faff 100%);color:#0f172a}
.admin-layout{width:min(1280px,calc(100% - 28px));margin:0 auto;padding:24px 0;display:grid;grid-template-columns:250px minmax(0,1fr);gap:18px}
.admin-side,.admin-card,.admin-panel{background:rgba(255,255,255,.82);backdrop-filter:blur(16px);border:1px solid rgba(148,163,184,.18);box-shadow:0 22px 60px rgba(15,23,42,.08)}
.admin-side{border-radius:28px;padding:18px;position:sticky;top:18px;align-self:start}
.admin-brand{display:flex;gap:12px;align-items:center;margin-bottom:18px}
.admin-mark{width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#ea580c,#f97316);color:#fff;display:grid;place-items:center;font-weight:800}
.admin-brand h1,.admin-panel h2,.admin-card h3{margin:0}
.admin-brand p,.admin-muted{margin:0;color:#64748b}
.admin-nav{display:grid;gap:8px}
.admin-link,.admin-btn{border:none;border-radius:14px;padding:11px 14px;font-weight:700;text-decoration:none;cursor:pointer}
.admin-link{display:flex;justify-content:space-between;align-items:center;color:#334155}
.admin-link.active{background:#fff1e8;color:#9a3412}
.admin-badge{min-width:28px;height:28px;border-radius:999px;background:#ea580c;color:#fff;display:grid;place-items:center;font-size:.76rem}
.admin-main{display:grid;gap:18px}
.admin-panel{border-radius:30px;padding:22px}
.admin-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;margin-bottom:18px}
.admin-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.admin-stat{padding:16px;border-radius:22px;background:linear-gradient(180deg,#fff 0%,#f8fafc 100%);border:1px solid rgba(148,163,184,.18)}
.admin-stat span{display:block;color:#64748b;font-size:.82rem;margin-bottom:6px}
.admin-stat strong{font-size:1.8rem}
.admin-tools{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}
.admin-input,.admin-select{width:100%;padding:11px 14px;border-radius:14px;border:1px solid rgba(148,163,184,.28);background:#fff}
.admin-btn.primary{background:linear-gradient(135deg,#ea580c,#fb7185);color:#fff}
.admin-btn.soft{background:#eff6ff;color:#1d4ed8}
.admin-btn.ghost{background:#f8fafc;color:#334155}
.admin-btn.danger{background:#fff1f2;color:#be123c}
.admin-table-wrap{overflow-x:auto;border:1px solid rgba(148,163,184,.18);border-radius:22px}
.admin-table{width:100%;border-collapse:collapse}
.admin-table th,.admin-table td{padding:14px 16px;text-align:left;border-top:1px solid rgba(148,163,184,.14)}
.admin-table thead th{border-top:none;background:#f8fafc;color:#475569;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em}
.admin-user{display:flex;gap:12px;align-items:center}
.admin-avatar{width:40px;height:40px;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,#0ea5e9,#22c55e);color:#fff;display:grid;place-items:center;font-weight:800}
.admin-avatar img{width:100%;height:100%;object-fit:cover}
.admin-pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;font-size:.78rem;font-weight:700}
.admin-pill.good{background:#ecfdf5;color:#047857}
.admin-pill.warn{background:#fff7ed;color:#c2410c}
.admin-stack{display:grid;gap:14px}
.admin-card{border-radius:22px;padding:16px}
.admin-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.admin-empty,.admin-load{text-align:center;padding:26px;color:#64748b}
.admin-spinner{width:34px;height:34px;border-radius:999px;border:3px solid rgba(14,165,233,.18);border-top-color:#0ea5e9;margin:0 auto 12px;animation:spin .8s linear infinite}
.admin-toast{position:fixed;right:18px;bottom:18px;padding:12px 16px;border-radius:16px;background:#0f172a;color:#fff;z-index:2000}
@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:980px){.admin-layout{grid-template-columns:1fr}.admin-side{position:static}}
`;

function useToast() {
      const [toast, setToast] = useState(null);
      const show = useCallback((message) => {
            setToast(message);
            window.setTimeout(() => setToast(null), 2600);
      }, []);
      return { show, toast };
}

function ensureStyles() {
      const id = 'zuno-admin-compact-styles';
      if (document.getElementById(id)) return;
      const style = document.createElement('style');
      style.id = id;
      style.textContent = STYLES;
      document.head.appendChild(style);
}

function initialsFor(user) {
      return (user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U').toUpperCase();
}

function Loading({ label }) {
      return <div className="admin-load"><div className="admin-spinner" />{label}</div>;
}

async function readAdminResponse(response) {
      const data = await response.json().catch(() => ({}));
      return {
            ok: response.ok && data.success !== false,
            data
      };
}

function Surface({ title, subtitle, children, actions }) {
      return (
            <div className="admin-panel">
                  <div className="admin-head">
                        <div>
                              <h2>{title}</h2>
                              <p className="admin-muted">{subtitle}</p>
                        </div>
                        <div className="admin-tools">{actions}</div>
                  </div>
                  {children}
            </div>
      );
}

function DashboardHome({ token, notify }) {
      const [stats, setStats] = useState(null);
      const [loading, setLoading] = useState(true);

      const fetchStats = useCallback(async (refresh = false) => {
            if (!refresh) setLoading(true);
            try {
                  const res = await fetch(`${API_URL}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
                  const { ok, data } = await readAdminResponse(res);
                  if (ok) {
                        setStats(data.data || null);
                        if (refresh) notify('Dashboard refreshed');
                  } else {
                        notify(data.message || 'Could not load dashboard stats');
                  }
            } catch {
                  notify('Could not load dashboard stats');
            } finally {
                  setLoading(false);
            }
      }, [notify, token]);

      useEffect(() => { fetchStats(); }, [fetchStats]);

      return (
            <Surface title="Dashboard" subtitle="Quick view of users, content, and reporting pressure." actions={<button className="admin-btn primary" onClick={() => fetchStats(true)}>Refresh</button>}>
                  {loading ? <Loading label="Loading dashboard" /> : (
                        <div className="admin-grid">
                              <div className="admin-stat"><span>Total users</span><strong>{stats?.totalUsers || 0}</strong></div>
                              <div className="admin-stat"><span>Active users</span><strong>{stats?.activeUsers || 0}</strong></div>
                              <div className="admin-stat"><span>Total content</span><strong>{stats?.totalContent || 0}</strong></div>
                              <div className="admin-stat"><span>Reports</span><strong>{stats?.totalReports || 0}</strong></div>
                        </div>
                  )}
            </Surface>
      );
}

function UsersManagement({ token, notify }) {
      const [users, setUsers] = useState([]);
      const [loading, setLoading] = useState(true);
      const [search, setSearch] = useState('');

      const fetchUsers = useCallback(async (query = '') => {
            setLoading(true);
            try {
                  const res = await fetch(`${API_URL}/admin/users?limit=40&search=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` } });
                  const { ok, data } = await readAdminResponse(res);
                  if (ok) {
                        setUsers(data.data?.users || []);
                  } else {
                        notify(data.message || 'Could not load users');
                  }
            } catch {
                  notify('Could not load users');
            } finally {
                  setLoading(false);
            }
      }, [notify, token]);

      useEffect(() => { fetchUsers(); }, [fetchUsers]);

      const updateUser = async (userId, body, label) => {
            try {
                  const res = await fetch(`${API_URL}/admin/users/${userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
                  const { ok, data } = await readAdminResponse(res);
                  if (ok) {
                        notify(label);
                        fetchUsers(search);
                  } else {
                        notify(data.message || 'User update failed');
                  }
            } catch {
                  notify('User update failed');
            }
      };

      const toggleBan = async (userId) => {
            try {
                  const res = await fetch(`${API_URL}/admin/users/${userId}/ban`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
                  const { ok, data } = await readAdminResponse(res);
                  if (ok) {
                        notify(data.message || 'User status updated');
                        fetchUsers(search);
                  } else {
                        notify(data.message || 'Ban action failed');
                  }
            } catch {
                  notify('Ban action failed');
            }
      };

      const deleteUser = async (userId, username) => {
            if (!window.confirm(`Delete ${username}?`)) return;
            try {
                  const res = await fetch(`${API_URL}/admin/users/${userId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                  const { ok, data } = await readAdminResponse(res);
                  if (ok) {
                        notify(data.message || 'User deleted');
                        fetchUsers(search);
                  } else {
                        notify(data.message || 'Delete failed');
                  }
            } catch {
                  notify('Delete failed');
            }
      };

      return (
            <Surface title="Users" subtitle="Search, verify, ban, and manage roles with a lighter interface.">
                  <div className="admin-tools">
                        <input className="admin-input" placeholder="Search by username or email" value={search} onChange={(e) => setSearch(e.target.value)} />
                        <button className="admin-btn primary" onClick={() => fetchUsers(search)}>Search</button>
                  </div>
                  {loading ? <Loading label="Loading users" /> : users.length === 0 ? <div className="admin-empty">No users found.</div> : (
                        <div className="admin-table-wrap">
                              <table className="admin-table">
                                    <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Verification</th><th>Actions</th></tr></thead>
                                    <tbody>
                                          {users.map((user) => (
                                                <tr key={user._id}>
                                                      <td><div className="admin-user"><div className="admin-avatar">{user.avatar ? <img src={resolveAdminAssetUrl(user.avatar)} alt={user.username} /> : initialsFor(user)}</div><div><strong>{user.displayName || user.username}</strong><div className="admin-muted">@{user.username}</div></div></div></td>
                                                      <td>{user.email}</td>
                                                      <td><select className="admin-select" value={user.role} onChange={(e) => updateUser(user._id, { role: e.target.value }, 'User role updated')}>{['user','creator','mentor','moderator','admin'].map((role) => <option key={role} value={role}>{role}</option>)}</select></td>
                                                      <td><span className={`admin-pill ${user.isActive ? 'good' : 'warn'}`}>{user.isActive ? 'Active' : 'Banned'}</span></td>
                                                      <td><span className={`admin-pill ${user.isVerified ? 'good' : 'warn'}`}>{user.isVerified ? 'Verified' : 'Pending'}</span></td>
                                                      <td><div className="admin-row"><button className="admin-btn soft" onClick={() => updateUser(user._id, { isVerified: !user.isVerified }, 'Verification updated')}>{user.isVerified ? 'Unverify' : 'Verify'}</button><button className="admin-btn ghost" onClick={() => toggleBan(user._id)}>{user.isActive ? 'Ban' : 'Unban'}</button><button className="admin-btn danger" onClick={() => deleteUser(user._id, user.username)}>Delete</button></div></td>
                                                </tr>
                                          ))}
                                    </tbody>
                              </table>
                        </div>
                  )}
            </Surface>
      );
}

function VerificationsManagement({ token, notify, onUpdate }) {
      const [users, setUsers] = useState([]);
      const [loading, setLoading] = useState(true);

      const fetchVerifications = useCallback(async () => {
            setLoading(true);
            try {
                  const res = await fetch(`${API_URL}/admin/verifications`, { headers: { Authorization: `Bearer ${token}` } });
                  const { ok, data } = await readAdminResponse(res);
                  if (ok) {
                        const nextUsers = data.data?.users || [];
                        setUsers(nextUsers);
                        onUpdate?.(nextUsers.length);
                  } else {
                        notify(data.message || 'Could not load verifications');
                  }
            } catch {
                  notify('Could not load verifications');
            } finally {
                  setLoading(false);
            }
      }, [notify, onUpdate, token]);

      useEffect(() => { fetchVerifications(); }, [fetchVerifications]);

      const review = async (userId, action) => {
            try {
                  const res = await fetch(`${API_URL}/admin/verifications/${userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action }) });
                  const { ok, data } = await readAdminResponse(res);
                  if (ok) {
                        notify(action === 'approve' ? 'Verification approved' : 'Verification rejected');
                        fetchVerifications();
                  } else {
                        notify(data.message || 'Review failed');
                  }
            } catch {
                  notify('Review failed');
            }
      };

      return (
            <Surface title="Verifications" subtitle="Review blue-tick requests in a smaller, cleaner queue.">
                  {loading ? <Loading label="Loading verification queue" /> : users.length === 0 ? <div className="admin-empty">No pending requests.</div> : (
                        <div className="admin-stack">
                              {users.map((user) => (
                                    <div key={user._id} className="admin-card">
                                          <div className="admin-user" style={{ alignItems: 'flex-start' }}>
                                                <div className="admin-avatar" style={{ width: '52px', height: '52px' }}>{user.avatar ? <img src={resolveAdminAssetUrl(user.avatar)} alt={user.username} /> : initialsFor(user)}</div>
                                                <div style={{ flex: 1 }}>
                                                      <h3>{user.displayName || user.username}</h3>
                                                      <p className="admin-muted">@{user.username} · {user.email}</p>
                                                      <p style={{ marginTop: '8px' }}>{user.verificationRequest?.reason || 'No reason provided.'}</p>
                                                      <div className="admin-row"><button className="admin-btn primary" onClick={() => review(user._id, 'approve')}>Approve</button><button className="admin-btn danger" onClick={() => review(user._id, 'reject')}>Reject</button></div>
                                                </div>
                                          </div>
                                    </div>
                              ))}
                        </div>
                  )}
            </Surface>
      );
}

function ContentManagement({ token, notify }) {
      const [contents, setContents] = useState([]);
      const [loading, setLoading] = useState(true);

      const fetchContent = useCallback(async () => {
            setLoading(true);
            try {
                  const res = await fetch(`${API_URL}/admin/content?limit=30`, { headers: { Authorization: `Bearer ${token}` } });
                  const { ok, data } = await readAdminResponse(res);
                  if (ok) {
                        setContents(data.data?.contents || []);
                  } else {
                        notify(data.message || 'Could not load content');
                  }
            } catch {
                  notify('Could not load content');
            } finally {
                  setLoading(false);
            }
      }, [notify, token]);

      useEffect(() => { fetchContent(); }, [fetchContent]);

      const moderate = async (contentId, body, label) => {
            try {
                  const res = await fetch(`${API_URL}/admin/content/${contentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
                  const { ok, data } = await readAdminResponse(res);
                  if (ok) {
                        notify(label);
                        fetchContent();
                  } else {
                        notify(data.message || 'Moderation failed');
                  }
            } catch {
                  notify('Moderation failed');
            }
      };

      return (
            <Surface title="Content" subtitle="Moderate user content without the previous clutter.">
                  {loading ? <Loading label="Loading content" /> : contents.length === 0 ? <div className="admin-empty">No content waiting for moderation.</div> : (
                        <div className="admin-stack">
                              {contents.map((content) => (
                                    <div key={content._id} className="admin-card">
                                          <h3>{content.title || 'Untitled content'}</h3>
                                          <p className="admin-muted">by @{content.creator?.username || 'unknown'} · {content.contentType || 'post'}</p>
                                          <p style={{ marginTop: '10px' }}>{(content.body || '').slice(0, 180) || 'No body text available.'}</p>
                                          <div className="admin-row">{!content.isApproved && <button className="admin-btn primary" onClick={() => moderate(content._id, { isApproved: true }, 'Content approved')}>Approve</button>}<button className="admin-btn danger" onClick={() => moderate(content._id, { status: 'removed' }, 'Content removed')}>Remove</button></div>
                                    </div>
                              ))}
                        </div>
                  )}
            </Surface>
      );
}

function ConfigManagement({ token, notify }) {
      const [configs, setConfigs] = useState([]);
      const [loading, setLoading] = useState(true);

      const fetchConfigs = useCallback(async () => {
            setLoading(true);
            try {
                  const res = await fetch(`${API_URL}/admin/config`, { headers: { Authorization: `Bearer ${token}` } });
                  const { ok, data } = await readAdminResponse(res);
                  if (ok) {
                        setConfigs(data.data?.configs || []);
                  } else {
                        notify(data.message || 'Could not load config');
                  }
            } catch {
                  notify('Could not load config');
            } finally {
                  setLoading(false);
            }
      }, [notify, token]);

      useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

      const initDefaults = async () => {
            try {
                  const res = await fetch(`${API_URL}/admin/config/init`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                  const { ok, data } = await readAdminResponse(res);
                  if (ok) {
                        notify('Defaults initialized');
                        fetchConfigs();
                  } else {
                        notify(data.message || 'Initialization failed');
                  }
            } catch {
                  notify('Initialization failed');
            }
      };

      const toggleConfig = async (config) => {
            try {
                  const res = await fetch(`${API_URL}/admin/config/${config.key}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ value: !config.value }) });
                  const { ok, data } = await readAdminResponse(res);
                  if (ok) {
                        notify(`${config.key} updated`);
                        fetchConfigs();
                  } else {
                        notify(data.message || 'Config update failed');
                  }
            } catch {
                  notify('Config update failed');
            }
      };

      return (
            <Surface title="Config" subtitle="Platform flags and settings in a more focused view." actions={<button className="admin-btn primary" onClick={initDefaults}>Initialize defaults</button>}>
                  {loading ? <Loading label="Loading config" /> : configs.length === 0 ? <div className="admin-empty">No config found.</div> : (
                        <div className="admin-stack">
                              {configs.map((config) => (
                                    <div key={config.key} className="admin-card">
                                          <h3>{config.key}</h3>
                                          <p>{config.description || 'No description available.'}</p>
                                          <div className="admin-row">{typeof config.value === 'boolean' ? <button className="admin-btn soft" onClick={() => toggleConfig(config)}>{config.value ? 'Disable' : 'Enable'}</button> : <span className="admin-pill warn">{String(config.value)}</span>}</div>
                                    </div>
                              ))}
                        </div>
                  )}
            </Surface>
      );
}

const navItems = [
      { path: '/', label: 'Dashboard', showBadge: false },
      { path: '/users', label: 'Users', showBadge: false },
      { path: '/verifications', label: 'Verifications', showBadge: true },
      { path: '/content', label: 'Content', showBadge: false },
      { path: '/config', label: 'Config', showBadge: false }
];

export default function AdminDashboard({ token, user, onLogout }) {
      ensureStyles();
      const location = useLocation();
      const [pendingCount, setPendingCount] = useState(0);
      const { show, toast } = useToast();

      useEffect(() => {
            if (!token || user?.role !== 'admin') return;
            fetch(`${API_URL}/admin/verifications`, { headers: { Authorization: `Bearer ${token}` } })
                  .then((response) => readAdminResponse(response))
                  .then(({ ok, data }) => {
                        if (ok) setPendingCount((data.data?.users || []).length);
                  })
                  .catch(() => {});
      }, [token, user]);

      if (!token || user?.role !== 'admin') {
            return <div className="admin-shell"><div className="admin-layout" style={{ gridTemplateColumns: '1fr' }}><Surface title="Admin access required" subtitle="This panel is only available to admin accounts." /></div></div>;
      }

      return (
            <>
                  <div className="admin-shell">
                        <div className="admin-layout">
                              <aside className="admin-side">
                                    <div className="admin-brand"><div className="admin-mark">Z</div><div><h1>ZUNO Admin</h1><p>Focused moderation tools</p></div></div>
                                    <nav className="admin-nav">
                                          {navItems.map((item) => {
                                                const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                                                return (
                                                      <Link key={item.path} to={item.path} className={`admin-link ${active ? 'active' : ''}`}>
                                                            <span>{item.label}</span>
                                                            {item.showBadge && pendingCount > 0 ? <span className="admin-badge">{pendingCount}</span> : null}
                                                      </Link>
                                                );
                                          })}
                                    </nav>
                                    <button className="admin-btn danger" style={{ width: '100%', marginTop: '16px' }} onClick={onLogout}>Logout</button>
                              </aside>

                              <main className="admin-main">
                                    <Routes>
                                          <Route path="/" element={<DashboardHome token={token} notify={show} />} />
                                          <Route path="/users" element={<UsersManagement token={token} notify={show} />} />
                                          <Route path="/verifications" element={<VerificationsManagement token={token} notify={show} onUpdate={setPendingCount} />} />
                                          <Route path="/content" element={<ContentManagement token={token} notify={show} />} />
                                          <Route path="/config" element={<ConfigManagement token={token} notify={show} />} />
                                    </Routes>
                              </main>
                        </div>
                  </div>
                  {toast ? <div className="admin-toast">{toast}</div> : null}
            </>
      );
}
