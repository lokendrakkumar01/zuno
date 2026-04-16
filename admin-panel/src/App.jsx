import { useCallback, useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './Login';
import AdminDashboard from './AdminDashboard';
import { API_URL } from './config';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [user, setUser] = useState(() => {
    try { 
      const item = localStorage.getItem('admin_user');
      return item ? JSON.parse(item) : null; 
    } catch { 
      return null; 
    }
  });

  const handleLogin = (t, u) => { 
    setToken(t); 
    setUser(u); 
  };
  
  const handleLogout = useCallback(() => {
    const tokenToRevoke = token;
    if (tokenToRevoke) {
      fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenToRevoke}` }
      }).catch(() => undefined);
    }

    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken(null); 
    setUser(null);
  }, [token]);

  useEffect(() => {
    if (!token || user?.role !== 'admin') return;

    let ignore = false;

    const validateAdminSession = async () => {
      try {
        const res = await fetch(`${API_URL}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (ignore) return;

        if (res.status === 401 || res.status === 403) {
          handleLogout();
        }
      } catch {
        // Keep the last known session on transient network failures.
      }
    };

    validateAdminSession();

    return () => {
      ignore = true;
    };
  }, [handleLogout, token, user?.role]);

  if (!token || user?.role !== 'admin') {
    return <Login onLogin={handleLogin} />;
  }
  
  return (
    <Routes>
      <Route path="/*" element={<AdminDashboard token={token} user={user} onLogout={handleLogout} />} />
    </Routes>
  );
}
