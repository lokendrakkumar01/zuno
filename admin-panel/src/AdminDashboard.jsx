import { useState, useEffect, useRef } from 'react';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import { API_URL } from './config';


/* ── Inject admin-specific CSS once ── */
const AdminStyles = () => {
  useEffect(() => {
    const id = 'zuno-admin-styles';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes adminFadeUp {
        from { opacity:0; transform:translateY(20px); }
        to   { opacity:1; transform:translateY(0); }
      }
      @keyframes adminPulse {
        0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,.4); }
        50%      { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
      }
      @keyframes adminShimmer {
        from { background-position:-400px 0; }
        to   { background-position:400px 0; }
      }
      @keyframes adminCountUp {
        from { opacity:0; transform:scale(.7); }
        to   { opacity:1; transform:scale(1); }
      }
      @keyframes adminSpin {
        to { transform: rotate(360deg); }
      }
      .admin-wrap { display:flex; min-height:100vh; background:#0f0f1a; color:#e2e8f0; font-family:'Inter',sans-serif; }
      .admin-sidebar {
        width:240px; background:linear-gradient(180deg,#1a1a2e 0%,#16213e 100%);
        border-right:1px solid rgba(99,102,241,.15); display:flex; flex-direction:column;
        position:fixed; top:0; left:0; height:100vh; z-index:100;
        transition: transform .3s ease;
      }
      .admin-sidebar.mobile-hidden { transform:translateX(-100%); }
      .admin-sidebar-logo {
        padding:24px 20px; border-bottom:1px solid rgba(99,102,241,.15);
        display:flex; align-items:center; gap:12px;
      }
      .admin-logo-icon {
        width:42px; height:42px; border-radius:12px;
        background:linear-gradient(135deg,#ef4444,#dc2626);
        display:flex; align-items:center; justify-content:center;
        font-weight:900; font-size:1.2rem; color:#fff;
        box-shadow:0 4px 15px rgba(239,68,68,.4);
        animation: adminPulse 3s infinite;
      }
      .admin-sidebar-title { font-weight:700; font-size:1.1rem; color:#f1f5f9; }
      .admin-sidebar-sub  { font-size:.7rem; color:#6366f1; font-weight:600; text-transform:uppercase; letter-spacing:.1em; }
      .admin-nav { padding:16px 12px; flex:1; display:flex; flex-direction:column; gap:4px; }
      .admin-nav-link {
        display:flex; align-items:center; gap:12px; padding:12px 14px;
        border-radius:12px; color:#94a3b8; text-decoration:none; font-size:.9rem;
        font-weight:500; transition:all .2s ease; cursor:pointer; border:none; background:transparent;
        width:100%;
      }
      .admin-nav-link:hover { background:rgba(99,102,241,.12); color:#e2e8f0; transform:translateX(3px); }
      .admin-nav-link.active { background:linear-gradient(135deg,rgba(99,102,241,.25),rgba(139,92,246,.15)); color:#818cf8; border-left:3px solid #6366f1; }
      .admin-nav-icon { font-size:1.1rem; width:20px; text-align:center; }
      .admin-badge {
        margin-left:auto; background:linear-gradient(135deg,#ef4444,#dc2626);
        color:#fff; font-size:.65rem; font-weight:700; padding:2px 7px; border-radius:99px;
        animation: adminPulse 2s infinite;
      }
      .admin-main { margin-left:240px; flex:1; padding:32px; min-height:100vh; }
      .admin-page-header { margin-bottom:32px; animation:adminFadeUp .4s ease; }
      .admin-page-title { font-size:1.8rem; font-weight:800; color:#f1f5f9; margin:0 0 4px; }
      .admin-page-sub { color:#64748b; font-size:.9rem; }
      /* Stat Cards */
      .admin-stat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:20px; margin-bottom:32px; }
      .admin-stat-card {
        background:linear-gradient(135deg,#1e1e32,#1a1a2e);
        border:1px solid rgba(99,102,241,.15); border-radius:16px; padding:24px;
        animation:adminFadeUp .5s ease; transition:transform .2s,box-shadow .2s;
      }
      .admin-stat-card:hover { transform:translateY(-4px); box-shadow:0 12px 40px rgba(0,0,0,.4); }
      .admin-stat-icon { font-size:2rem; margin-bottom:12px; }
      .admin-stat-num  { font-size:2rem; font-weight:800; animation:adminCountUp .6s ease; }
      .admin-stat-label { font-size:.8rem; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.05em; margin-top:4px; }
      /* Table */
      .admin-table-wrap { background:#1e1e32; border:1px solid rgba(99,102,241,.15); border-radius:16px; overflow:hidden; }
      .admin-table { width:100%; border-collapse:collapse; }
      .admin-table th { padding:14px 16px; background:rgba(99,102,241,.08); color:#94a3b8; font-size:.75rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; text-align:left; }
      .admin-table td { padding:14px 16px; border-top:1px solid rgba(255,255,255,.04); color:#e2e8f0; font-size:.88rem; vertical-align:middle; }
      .admin-table tr { transition:background .2s; }
      .admin-table tr:hover td { background:rgba(99,102,241,.06); }
      /* Badges */
      .admin-badge-role { display:inline-block; padding:3px 10px; border-radius:99px; font-size:.72rem; font-weight:700; }
      .admin-badge-active { background:rgba(34,197,94,.15); color:#22c55e; }
      .admin-badge-inactive { background:rgba(239,68,68,.15); color:#ef4444; }
      .admin-badge-pending { background:rgba(245,158,11,.15); color:#f59e0b; }
      .admin-badge-approved { background:rgba(34,197,94,.15); color:#22c55e; }
      .admin-badge-rejected { background:rgba(239,68,68,.15); color:#ef4444; }
      .admin-badge-verified { color:#3b82f6; font-size:1rem; }
      /* Buttons */
      .admin-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:10px; font-weight:600; font-size:.82rem; border:none; cursor:pointer; transition:all .2s; }
      .admin-btn-primary { background:linear-gradient(135deg,#6366f1,#818cf8); color:#fff; }
      .admin-btn-primary:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(99,102,241,.5); }
      .admin-btn-success { background:linear-gradient(135deg,#10b981,#34d399); color:#fff; }
      .admin-btn-success:hover { transform:translateY(-1px); box-shadow:0 4px 15px rgba(16,185,129,.4); }
      .admin-btn-danger { background:linear-gradient(135deg,#ef4444,#f87171); color:#fff; }
      .admin-btn-danger:hover { transform:translateY(-1px); box-shadow:0 4px 15px rgba(239,68,68,.4); }
      .admin-btn-ghost { background:rgba(255,255,255,.06); color:#94a3b8; }
      .admin-btn-ghost:hover { background:rgba(255,255,255,.1); color:#e2e8f0; }
      .admin-btn-sm { padding:5px 12px; font-size:.75rem; border-radius:8px; }
      .admin-btn-warning { background:linear-gradient(135deg,#f59e0b,#fbbf24); color:#fff; }
      .admin-btn-warning:hover { transform:translateY(-1px); box-shadow:0 4px 15px rgba(245,158,11,.4); }
      /* Search */
      .admin-search { background:#1e1e32; border:1px solid rgba(99,102,241,.2); border-radius:12px; padding:10px 16px; color:#e2e8f0; font-size:.88rem; outline:none; width:280px; transition:border-color .2s; }
      .admin-search:focus { border-color:#6366f1; }
      .admin-search::placeholder { color:#475569; }
      /* Avatar */
      .admin-avatar { width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:.9rem; color:#fff; overflow:hidden; flex-shrink:0; }
      .admin-avatar img { width:100%; height:100%; object-fit:cover; }
      /* Card */
      .admin-card { background:#1e1e32; border:1px solid rgba(99,102,241,.15); border-radius:16px; padding:24px; animation:adminFadeUp .4s ease; }
      /* Spinner */
      .admin-spinner { width:40px; height:40px; border:3px solid rgba(99,102,241,.2); border-top-color:#6366f1; border-radius:50%; animation:adminSpin .8s linear infinite; margin:60px auto; }
      /* Config toggle */
      .admin-toggle { width:44px; height:24px; background:#374151; border-radius:99px; position:relative; cursor:pointer; transition:background .2s; border:none; }
      .admin-toggle.on { background:linear-gradient(135deg,#6366f1,#8b5cf6); }
      .admin-toggle::after { content:''; position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#fff; transition:transform .2s; }
      .admin-toggle.on::after { transform:translateX(20px); }
      /* Mobile hamburger */
      .admin-hamburger { display:none; position:fixed; top:16px; left:16px; z-index:200; background:#1e1e32; border:1px solid rgba(99,102,241,.3); border-radius:10px; padding:8px; cursor:pointer; color:#e2e8f0; }
      .admin-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:99; backdrop-filter:blur(4px); }
      /* Role select */
      .admin-role-select { background:#0f0f1a; border:1px solid rgba(99,102,241,.2); border-radius:8px; padding:6px 10px; color:#e2e8f0; font-size:.82rem; cursor:pointer; outline:none; }
      .admin-role-select:focus { border-color:#6366f1; }
      /* Toast */
      .admin-toast { position:fixed; bottom:24px; right:24px; background:#1e1e32; border:1px solid rgba(99,102,241,.3); border-radius:12px; padding:14px 20px; color:#e2e8f0; font-size:.88rem; font-weight:500; box-shadow:0 8px 32px rgba(0,0,0,.5); animation:adminFadeUp .4s ease; z-index:99999; max-width:360px; display:flex; align-items:center; gap:10px; }
      /* Empty */
      .admin-empty { text-align:center; padding:60px 24px; color:#475569; }
      .admin-empty-icon { font-size:3rem; margin-bottom:12px; }
      /* Verification card */
      .admin-verify-card { background:#1e1e32; border:1px solid rgba(99,102,241,.15); border-radius:16px; padding:20px; animation:adminFadeUp .4s ease; transition:transform .2s,box-shadow .2s; }
      .admin-verify-card:hover { transform:translateY(-2px); box-shadow:0 8px 30px rgba(0,0,0,.4); }
      @media(max-width:768px) {
        .admin-sidebar { transform:translateX(-100%); }
        .admin-sidebar.mobile-open { transform:translateX(0); }
        .admin-main { margin-left:0; padding:16px; padding-top:60px; }
        .admin-hamburger { display:block; }
        .admin-overlay { display:block; }
        .admin-overlay.hidden { display:none; }
        .admin-stat-grid { grid-template-columns:repeat(2,1fr); }
        .admin-search { width:100%; }
        .admin-table { display:block; overflow-x:auto; }
      }
    `;
    document.head.appendChild(style);
  }, []);
  return null;
};

/* ── Toast helper ── */
const useToast = () => {
  const [toast, setToast] = useState(null);
  const show = (msg, type='✅') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };
  const Toast = toast ? (
    <div className="admin-toast">
      <span style={{ fontSize:'1.2rem' }}>{toast.type}</span>
      {toast.msg}
    </div>
  ) : null;
  return { show, Toast };
};

/* ══════════════════════════════════════════════════
   MAIN ADMIN DASHBOARD
══════════════════════════════════════════════════ */
const AdminDashboard = ({ token, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!token || user?.role !== 'admin') return;
    fetch(`${API_URL}/admin/verifications`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(d => {
      if (d.success) setPendingCount(d.data.users.length);
    }).catch(() => {});
  }, [token, user]);

  if (!token || user?.role !== 'admin') {

    return (
      <div style={{ minHeight:'100vh', background:'#0f0f1a', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center', padding:'40px', background:'#1e1e32', borderRadius:'20px', border:'1px solid rgba(99,102,241,.2)' }}>
          <div style={{ fontSize:'4rem', marginBottom:'16px' }}>🔐</div>
          <h2 style={{ color:'#f1f5f9', fontWeight:800, marginBottom:'8px' }}>Admin Access Required</h2>
          <p style={{ color:'#64748b', marginBottom:'24px' }}>You need admin privileges to access this panel.</p>
          <button onClick={() => navigate('/')} style={{ background:'linear-gradient(135deg,#6366f1,#818cf8)', color:'#fff', border:'none', borderRadius:'12px', padding:'12px 28px', fontWeight:700, cursor:'pointer' }}>
            ← Go Home
          </button>
        </div>
      </div>
    );
  }

  const navItems = [
    { path:'/admin', label:'Dashboard', icon:'📊', exact:true },
    { path:'/admin/users', label:'Users', icon:'👥' },
    { path:'/admin/verifications', label:'Verifications', icon:'✅', badge: pendingCount > 0 ? pendingCount : null },
    { path:'/admin/content', label:'Content', icon:'🖼️' },
    { path:'/admin/config', label:'Config', icon:'⚙️' },
  ];

  const isActive = (path, exact) => exact ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <>
      <AdminStyles />
      <div className="admin-wrap">
        {/* Mobile hamburger */}
        <button className="admin-hamburger" onClick={() => setSidebarOpen(true)}>
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M3 6h18M3 12h18M3 18h18"/>
          </svg>
        </button>
        {/* Overlay for mobile */}
        <div className={`admin-overlay ${sidebarOpen ? '' : 'hidden'}`} onClick={() => setSidebarOpen(false)} />

        {/* Sidebar */}
        <aside className={`admin-sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
          <div className="admin-sidebar-logo">
            <div className="admin-logo-icon">A</div>
            <div>
              <div className="admin-sidebar-title">ZUNO</div>
              <div className="admin-sidebar-sub">Admin Panel</div>
            </div>
          </div>
          <nav className="admin-nav">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`admin-nav-link ${isActive(item.path, item.exact) ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="admin-nav-icon">{item.icon}</span>
                {item.label}
                {item.badge ? <span className="admin-badge">{item.badge}</span> : null}
              </Link>
            ))}
            <div style={{ flex:1 }} />
            <button className="admin-nav-link" style={{ marginTop:'auto', color:'#ef4444', textAlign:'left' }} onClick={() => { setSidebarOpen(false); onLogout(); }}>
              <span className="admin-nav-icon">🚪</span>
              Logout
            </button>
          </nav>
        </aside>


        {/* Main content */}
        <main className="admin-main">
          <Routes>
            <Route index element={<DashboardHome token={token} />} />
            <Route path="users" element={<UsersManagement token={token} />} />
            <Route path="verifications" element={<VerificationsManagement token={token} onUpdate={setPendingCount} />} />
            <Route path="content" element={<ContentManagement token={token} />} />
            <Route path="config" element={<ConfigManagement token={token} />} />
          </Routes>
        </main>
      </div>
    </>
  );
};

/* ══════════════════════════════════════════════════
   DASHBOARD HOME — Animated Stats
══════════════════════════════════════════════════ */
const DashboardHome = ({ token }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d.success) setStats(d.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const cards = [
    { label:'Total Users', value:stats?.totalUsers, icon:'👥', color:'#6366f1' },
    { label:'Active Users', value:stats?.activeUsers, icon:'🟢', color:'#22c55e' },
    { label:'Total Content', value:stats?.totalContent, icon:'🖼️', color:'#8b5cf6' },
    { label:'Reports', value:stats?.totalReports, icon:'🚨', color:'#ef4444' },
  ];

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Dashboard</h1>
        <p className="admin-page-sub">Welcome back, Admin! Here's what's happening.</p>
      </div>

      {loading ? <div className="admin-spinner" /> : (
        <>
          <div className="admin-stat-grid">
            {cards.map((c, i) => (
              <div key={c.label} className="admin-stat-card" style={{ animationDelay:`${i * 0.1}s` }}>
                <div className="admin-stat-icon">{c.icon}</div>
                <div className="admin-stat-num" style={{ color:c.color }}>{c.value ?? 0}</div>
                <div className="admin-stat-label">{c.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'20px' }}>
            <div className="admin-card">
              <h3 style={{ fontWeight:700, marginBottom:'16px', color:'#f1f5f9' }}>📊 Content by Type</h3>
              {stats?.contentByType?.length ? stats.contentByType.map(item => (
                <div key={item._id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,.05)', color:'#94a3b8' }}>
                  <span style={{ textTransform:'capitalize' }}>{item._id}</span>
                  <span style={{ color:'#818cf8', fontWeight:700 }}>{item.count}</span>
                </div>
              )) : <p style={{ color:'#475569' }}>No content yet.</p>}
            </div>

            <div className="admin-card">
              <h3 style={{ fontWeight:700, marginBottom:'16px', color:'#f1f5f9' }}>👥 Users by Role</h3>
              {stats?.usersByRole?.length ? stats.usersByRole.map(item => (
                <div key={item._id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,.05)', color:'#94a3b8' }}>
                  <span style={{ textTransform:'capitalize' }}>{item._id}</span>
                  <span style={{ color:'#22c55e', fontWeight:700 }}>{item.count}</span>
                </div>
              )) : <p style={{ color:'#475569' }}>No users yet.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════
   USERS MANAGEMENT
══════════════════════════════════════════════════ */
const UsersManagement = ({ token }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { show, Toast } = useToast();

  const fetchUsers = async (q = search) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users?search=${encodeURIComponent(q)}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setUsers(data.data.users);
    } catch {/**/} finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(''); }, [token]);

  const handleRoleChange = async (userId, newRole) => {
    await fetch(`${API_URL}/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: newRole })
    });
    show(`Role updated to "${newRole}"`, '✏️');
    fetchUsers();
  };

  const handleBan = async (userId, isActive) => {
    await fetch(`${API_URL}/admin/users/${userId}/ban`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
    show(isActive ? 'User banned successfully' : 'User unbanned successfully', isActive ? '🔒' : '🔓');
    fetchUsers();
  };

  const handleVerifyToggle = async (userId, current) => {
    await fetch(`${API_URL}/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isVerified: !current })
    });
    show(!current ? 'User verified ✓' : 'Verification removed', '🏷️');
    fetchUsers();
  };

  return (
    <div>
      {Toast}
      <div className="admin-page-header">
        <h1 className="admin-page-title">Users 👥</h1>
        <p className="admin-page-sub">Manage users, roles, and account status.</p>
      </div>

      <div style={{ display:'flex', gap:'12px', marginBottom:'24px', flexWrap:'wrap' }}>
        <input
          className="admin-search"
          placeholder="🔍 Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchUsers()}
        />
        <button className="admin-btn admin-btn-primary" onClick={() => fetchUsers()}>Search</button>
      </div>

      {loading ? <div className="admin-spinner" /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Verified</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div className="admin-avatar">
                        {u.avatar ? <img src={u.avatar} alt="" /> : (u.displayName?.[0] || u.username?.[0] || '?')}
                      </div>
                      <div>
                        <div style={{ fontWeight:600, display:'flex', alignItems:'center', gap:'4px' }}>
                          {u.displayName || u.username}
                          {u.isVerified && <span className="admin-badge-verified">✓</span>}
                        </div>
                        <div style={{ fontSize:'.75rem', color:'#64748b' }}>@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color:'#64748b', fontSize:'.82rem' }}>{u.email}</td>
                  <td>
                    <select
                      className="admin-role-select"
                      value={u.role}
                      onChange={e => handleRoleChange(u._id, e.target.value)}
                    >
                      {['user','creator','mentor','moderator','admin'].map(r => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`admin-badge-role ${u.isActive ? 'admin-badge-active' : 'admin-badge-inactive'}`}>
                      {u.isActive ? '🟢 Active' : '🔴 Banned'}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge-role ${u.isVerified ? 'admin-badge-approved' : 'admin-badge-inactive'}`}>
                      {u.isVerified ? '✓ Yes' : '✗ No'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                      <button
                        className={`admin-btn admin-btn-sm ${u.isVerified ? 'admin-btn-ghost' : 'admin-btn-primary'}`}
                        onClick={() => handleVerifyToggle(u._id, u.isVerified)}
                        title={u.isVerified ? 'Remove verification' : 'Verify user'}
                      >
                        {u.isVerified ? '✗ Unverify' : '✓ Verify'}
                      </button>
                      <button
                        className={`admin-btn admin-btn-sm ${u.isActive ? 'admin-btn-danger' : 'admin-btn-success'}`}
                        onClick={() => handleBan(u._id, u.isActive)}
                      >
                        {u.isActive ? '🔒 Ban' : '🔓 Unban'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan="6"><div className="admin-empty"><div className="admin-empty-icon">👤</div>No users found.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════
   VERIFICATIONS MANAGEMENT (Blue Tick)
══════════════════════════════════════════════════ */
const VerificationsManagement = ({ token, onUpdate }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { show, Toast } = useToast();

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/verifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users);
        onUpdate?.(data.data.users.length);
      }
    } catch {/**/} finally { setLoading(false); }
  };

  useEffect(() => { fetchVerifications(); }, [token]);

  const handle = async (userId, action) => {
    const res = await fetch(`${API_URL}/admin/verifications/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (data.success) {
      show(action === 'approve' ? '✓ Verification approved! User is now verified.' : 'Verification rejected.', action === 'approve' ? '✅' : '❌');
      fetchVerifications();
    }
  };

  return (
    <div>
      {Toast}
      <div className="admin-page-header">
        <h1 className="admin-page-title">Blue Tick Requests ✅</h1>
        <p className="admin-page-sub">Review and approve blue tick verification requests.</p>
      </div>

      {loading ? <div className="admin-spinner" /> : users.length === 0 ? (
        <div className="admin-card" style={{ textAlign:'center', padding:'60px' }}>
          <div style={{ fontSize:'3rem', marginBottom:'12px' }}>✅</div>
          <h3 style={{ color:'#f1f5f9', fontWeight:700, marginBottom:'8px' }}>All Clear!</h3>
          <p style={{ color:'#64748b' }}>No pending verification requests at the moment.</p>
        </div>
      ) : (
        <div style={{ display:'grid', gap:'16px' }}>
          {users.map((u, i) => (
            <div key={u._id} className="admin-verify-card" style={{ animationDelay:`${i * 0.08}s` }}>
              <div style={{ display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap' }}>
                <div className="admin-avatar" style={{ width:'52px', height:'52px', fontSize:'1.3rem', borderRadius:'14px', border:'2px solid #6366f1' }}>
                  {u.avatar ? <img src={u.avatar} alt="" /> : (u.displayName?.[0] || u.username?.[0] || '?')}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:'1.05rem', color:'#f1f5f9', display:'flex', alignItems:'center', gap:'8px' }}>
                    {u.displayName || u.username}
                    <span className="admin-badge-role admin-badge-pending">⏳ Pending</span>
                  </div>
                  <div style={{ color:'#64748b', fontSize:'.82rem' }}>@{u.username} · {u.email}</div>
                  <div style={{ color:'#94a3b8', fontSize:'.82rem', marginTop:'6px' }}>
                    📝 Reason: <em>{u.verificationRequest?.reason || 'No reason provided'}</em>
                  </div>
                  <div style={{ color:'#475569', fontSize:'.75rem', marginTop:'4px' }}>
                    Requested: {u.verificationRequest?.requestedAt ? new Date(u.verificationRequest.requestedAt).toLocaleDateString('en', { year:'numeric', month:'short', day:'numeric' }) : 'Unknown'}
                  </div>
                  <div style={{ color:'#475569', fontSize:'.75rem' }}>
                    Followers: {u.followers?.length || 0} · Posts: {u.stats?.contentCount || 0}
                  </div>
                </div>
                <div style={{ display:'flex', gap:'10px' }}>
                  <button className="admin-btn admin-btn-success" onClick={() => handle(u._id, 'approve')}>
                    ✓ Approve
                  </button>
                  <button className="admin-btn admin-btn-danger" onClick={() => handle(u._id, 'reject')}>
                    ✗ Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════
   CONTENT MANAGEMENT
══════════════════════════════════════════════════ */
const ContentManagement = ({ token }) => {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { show, Toast } = useToast();

  const fetchContent = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/content?limit=30`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setContents(data.data.contents);
    } catch {/**/} finally { setLoading(false); }
  };

  useEffect(() => { fetchContent(); }, [token]);

  const handleModerate = async (id, body) => {
    await fetch(`${API_URL}/admin/content/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    show(body.isApproved ? 'Content approved ✓' : 'Content removed 🗑️', body.isApproved ? '✅' : '🗑️');
    fetchContent();
  };

  return (
    <div>
      {Toast}
      <div className="admin-page-header">
        <h1 className="admin-page-title">Content Moderation 🖼️</h1>
        <p className="admin-page-sub">Review and moderate user-generated content.</p>
      </div>

      {loading ? <div className="admin-spinner" /> : (
        <div style={{ display:'grid', gap:'16px' }}>
          {contents.map((c, i) => (
            <div key={c._id} className="admin-card" style={{ animationDelay:`${i * 0.06}s` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'16px', flexWrap:'wrap' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px', flexWrap:'wrap' }}>
                    <h3 style={{ fontWeight:700, color:'#f1f5f9', margin:0 }}>{c.title || 'Untitled'}</h3>
                    <span className={`admin-badge-role ${c.isApproved ? 'admin-badge-approved' : 'admin-badge-pending'}`}>
                      {c.isApproved ? '✓ Approved' : '⏳ Pending'}
                    </span>
                    <span className="admin-badge-role" style={{ background:'rgba(99,102,241,.15)', color:'#818cf8' }}>{c.contentType}</span>
                  </div>
                  <p style={{ color:'#64748b', fontSize:'.82rem', margin:'0 0 8px' }}>by @{c.creator?.username}</p>
                  <p style={{ color:'#94a3b8', fontSize:'.85rem', margin:0 }}>{(c.body || '').substring(0, 120)}{c.body?.length > 120 ? '…' : ''}</p>
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  {!c.isApproved && (
                    <button className="admin-btn admin-btn-sm admin-btn-success" onClick={() => handleModerate(c._id, { isApproved: true })}>
                      ✓ Approve
                    </button>
                  )}
                  <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => handleModerate(c._id, { status:'removed' })}>
                    🗑️ Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
          {contents.length === 0 && (
            <div className="admin-empty"><div className="admin-empty-icon">🖼️</div>No content to moderate.</div>
          )}
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════
   CONFIG MANAGEMENT
══════════════════════════════════════════════════ */
const ConfigManagement = ({ token }) => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { show, Toast } = useToast();

  const fetchConfigs = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/config`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setConfigs(data.data.configs);
    } catch {/**/} finally { setLoading(false); }
  };

  useEffect(() => { fetchConfigs(); }, [token]);

  const initConfigs = async () => {
    await fetch(`${API_URL}/admin/config/init`, { method:'POST', headers: { Authorization: `Bearer ${token}` } });
    show('Default configs initialized!', '⚙️');
    fetchConfigs();
  };

  const toggleConfig = async (key, current) => {
    await fetch(`${API_URL}/admin/config/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value: !current })
    });
    fetchConfigs();
  };

  const grouped = configs.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  return (
    <div>
      {Toast}
      <div className="admin-page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 className="admin-page-title">Feature Flags ⚙️</h1>
          <p className="admin-page-sub">Toggle features and adjust platform configuration.</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={initConfigs}>🔧 Initialize Defaults</button>
      </div>

      {loading ? <div className="admin-spinner" /> : configs.length === 0 ? (
        <div className="admin-card" style={{ textAlign:'center', padding:'60px' }}>
          <div className="admin-empty-icon">⚙️</div>
          <p style={{ color:'#64748b', marginBottom:'20px' }}>No configs found. Initialize defaults first.</p>
          <button className="admin-btn admin-btn-primary" onClick={initConfigs}>🔧 Initialize Defaults</button>
        </div>
      ) : (
        <div style={{ display:'grid', gap:'20px' }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="admin-card">
              <h3 style={{ fontWeight:700, color:'#818cf8', marginBottom:'16px', textTransform:'capitalize', fontSize:'.85rem', display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ textTransform:'uppercase', letterSpacing:'.08em' }}>{cat}</span>
                <span style={{ background:'rgba(99,102,241,.15)', color:'#818cf8', padding:'2px 8px', borderRadius:'99px', fontSize:'.7rem' }}>{items.length}</span>
              </h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {items.map(cfg => (
                  <div key={cfg.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid rgba(255,255,255,.04)', flexWrap:'wrap', gap:'8px' }}>
                    <div>
                      <div style={{ fontWeight:600, color:'#e2e8f0', fontSize:'.88rem' }}>{cfg.key.replace(/_/g, ' ')}</div>
                      <div style={{ color:'#64748b', fontSize:'.78rem' }}>{cfg.description}</div>
                    </div>
                    {typeof cfg.value === 'boolean' ? (
                      <button
                        className={`admin-toggle ${cfg.value ? 'on' : ''}`}
                        onClick={() => toggleConfig(cfg.key, cfg.value)}
                        title={cfg.value ? 'ON — click to disable' : 'OFF — click to enable'}
                      />
                    ) : (
                      <span style={{ background:'rgba(99,102,241,.15)', color:'#818cf8', padding:'4px 12px', borderRadius:'8px', fontSize:'.8rem', fontWeight:700 }}>{String(cfg.value)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
