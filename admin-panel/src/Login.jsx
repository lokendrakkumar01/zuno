import { useState } from 'react';
import { API_URL } from './config';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error('Invalid server response');
      }

      if (res.ok && data.success && data.data && data.data.user.role === 'admin') {
        localStorage.setItem('admin_token', data.data.token);
        localStorage.setItem('admin_user', JSON.stringify(data.data.user));
        onLogin(data.data.token, data.data.user);
      } else if (res.ok && data.success && data.data.user.role !== 'admin') {
        setError('⚠️ Admin privileges required to access this panel.');
      } else {
        setError(data.message || '⚠️ Invalid credentials or server error');
      }
    } catch (err) {
      console.error(err);
      setError('⚠️ Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#0f0f1a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter, sans-serif' }}>
      <form onSubmit={handleLogin} style={{ background:'#1e1e32', padding:'40px', borderRadius:'20px', border:'1px solid rgba(99,102,241,.2)', width:'320px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
        <h2 style={{ color:'#f1f5f9', fontWeight:800, marginBottom:'8px', display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:'linear-gradient(135deg,#ef4444,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'1.2rem', boxShadow:'0 4px 12px rgba(239,68,68,0.4)' }}>Z</div>
          Admin Login
        </h2>
        <p style={{ color:'#64748b', fontSize:'0.85rem', marginBottom:'24px' }}>Sign in to access the control panel</p>
        
        {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', padding:'10px 14px', borderRadius:'10px', fontSize:'0.85rem', marginBottom:'16px' }}>{error}</div>}
        
        <input 
          type="email" placeholder="Admin Email" 
          value={email} onChange={e=>setEmail(e.target.value)}
          style={{ width:'100%', padding:'12px 14px', background:'#0f0f1a', border:'1px solid rgba(99,102,241,.3)', borderRadius:'10px', color:'#e2e8f0', marginBottom:'12px', outline:'none', boxSizing:'border-box', fontSize:'0.9rem', transition:'border-color 0.2s' }} 
          onFocus={(e) => e.target.style.borderColor = '#6366f1'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(99,102,241,.3)'}
          required 
        />
        
        <input 
          type="password" placeholder="Password" 
          value={password} onChange={e=>setPassword(e.target.value)}
          style={{ width:'100%', padding:'12px 14px', background:'#0f0f1a', border:'1px solid rgba(99,102,241,.3)', borderRadius:'10px', color:'#e2e8f0', marginBottom:'24px', outline:'none', boxSizing:'border-box', fontSize:'0.9rem', transition:'border-color 0.2s' }} 
          onFocus={(e) => e.target.style.borderColor = '#6366f1'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(99,102,241,.3)'}
          required 
        />
        
        <button type="submit" disabled={loading} style={{ width:'100%', padding:'14px', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:'12px', fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition:'all 0.2s', boxShadow:'0 8px 20px rgba(99,102,241,0.3)', fontSize:'0.95rem' }}>
          {loading ? 'Authenticating...' : 'Login as Admin'}
        </button>
      </form>
    </div>
  );
}
