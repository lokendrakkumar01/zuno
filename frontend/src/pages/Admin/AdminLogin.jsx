import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

const styles = `
.admin-login-page{
  min-height:100vh;
  display:grid;
  place-items:center;
  background:
    radial-gradient(circle at top left, rgba(249,115,22,.16), transparent 28%),
    radial-gradient(circle at bottom right, rgba(14,165,233,.16), transparent 24%),
    linear-gradient(180deg,#fff8f1 0%,#f5faff 100%);
  padding:24px;
}
.admin-login-card{
  width:min(420px,100%);
  padding:28px;
  border-radius:28px;
  background:rgba(255,255,255,.86);
  backdrop-filter:blur(16px);
  border:1px solid rgba(148,163,184,.18);
  box-shadow:0 28px 70px rgba(15,23,42,.12);
  color:#0f172a;
}
.admin-login-brand{
  display:flex;
  align-items:center;
  gap:12px;
  margin-bottom:18px;
}
.admin-login-mark{
  width:48px;
  height:48px;
  border-radius:16px;
  display:grid;
  place-items:center;
  font-weight:800;
  color:#fff;
  background:linear-gradient(135deg,#ea580c,#fb7185);
}
.admin-login-card h1{margin:0 0 6px;font-size:1.9rem}
.admin-login-card p{margin:0;color:#64748b}
.admin-login-error{
  margin:18px 0 0;
  padding:12px 14px;
  border-radius:16px;
  background:#fff1f2;
  color:#be123c;
  border:1px solid rgba(244,63,94,.14);
}
.admin-login-form{display:grid;gap:14px;margin-top:22px}
.admin-login-input{
  width:100%;
  border-radius:16px;
  border:1px solid rgba(148,163,184,.25);
  background:#fff;
  color:#0f172a;
  padding:13px 15px;
}
.admin-login-btn{
  border:none;
  border-radius:16px;
  padding:13px 16px;
  font-weight:800;
  color:#fff;
  background:linear-gradient(135deg,#ea580c,#fb7185);
  cursor:pointer;
}
.admin-login-btn:disabled{opacity:.7;cursor:not-allowed}
`;

function ensureStyles() {
  const id = 'zuno-admin-login-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = styles;
  document.head.appendChild(style);
}

export default function AdminLogin() {
  ensureStyles();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(email, password);
      
      if (result.success && result.user?.role === 'admin') {
        navigate('/admin');
        return;
      }

      if (result.success && result.user?.role !== 'admin') {
        setError('Access denied. Admin privileges required.');
      } else {
        setError(result.message || 'Admin login failed.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <form className="admin-login-card" onSubmit={handleLogin}>
        <div className="admin-login-brand">
          <div className="admin-login-mark">Z</div>
          <div>
            <h1>Admin Login</h1>
            <p>Sign in to manage users, content, and platform settings.</p>
          </div>
        </div>

        <div className="admin-login-form">
          <input
            className="admin-login-input"
            type="email"
            placeholder="Admin email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="admin-login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="admin-login-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Open Admin Panel'}
          </button>
        </div>

        {error ? <div className="admin-login-error">{error}</div> : null}
        
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button 
            type="button" 
            onClick={() => navigate('/')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#64748b', 
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            ← Back to Main Site
          </button>
        </div>
      </form>
    </div>
  );
}
