import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import AdminDashboard from './AdminDashboard';

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
  
  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken(null); 
    setUser(null);
  };

  if (!token || user?.role !== 'admin') {
    return <Login onLogin={handleLogin} />;
  }
  
  return (
    <Routes>
      <Route path="/*" element={<AdminDashboard token={token} user={user} onLogout={handleLogout} />} />
    </Routes>
  );
}
