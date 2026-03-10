import { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
      // Load cached user from localStorage for instant startup
      const [user, setUser] = useState(() => {
            try {
                  const cached = localStorage.getItem('zuno_user');
                  return cached ? JSON.parse(cached) : null;
            } catch {
                  return null;
            }
      });
      const [token, setToken] = useState(localStorage.getItem('zuno_token'));
      const [loading, setLoading] = useState(() => {
            // If we have a token and cached user, don't show initial loading
            const hasToken = localStorage.getItem('zuno_token');
            const hasUser = localStorage.getItem('zuno_user');
            return !(hasToken && hasUser);
      });

      // Check auth on mount — but DON'T logout on failure (server might be cold)
      useEffect(() => {
            const checkAuth = async () => {
                  if (token) {
                        try {
                              // Perform check in background
                              const res = await fetch(`${API_URL}/auth/me`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                              });
                              const data = await res.json();
                              if (data.success) {
                                    setUser(data.data.user);
                                    // Update cached user data
                                    localStorage.setItem('zuno_user', JSON.stringify(data.data.user));
                              } else if (res.status === 401) {
                                    // Token is truly invalid/expired — only then logout
                                    logout();
                              }
                        } catch (error) {
                              console.error('Auth check failed (server may be starting):', error);
                              // Keep cached user — don't logout on network errors
                        }
                  }
                  // Even if check fails, we stop loading if we have cached data
                  setLoading(false);
            };

            if (user && token) {
                  // If we already have cached data, stop loading immediately
                  setLoading(false);
                  // Still check in background to refresh data
                  checkAuth();
            } else {
                  checkAuth();
            }
      }, [token]);

      const fetchWithTimeout = async (url, options = {}, timeout = 45000) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            try {
                  const response = await fetch(url, {
                        ...options,
                        signal: controller.signal
                  });
                  clearTimeout(id);
                  return response;
            } catch (error) {
                  clearTimeout(id);
                  throw error;
            }
      };

      const login = async (email, password) => {
            const attemptLogin = async (currentTimeout = 60000) => {
                  const res = await fetchWithTimeout(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                  }, currentTimeout);
                  return await res.json();
            };

            try {
                  const data = await attemptLogin(60000); // 1 minute for waking up
                  if (data.success) {
                        setUser(data.data.user);
                        setToken(data.data.token);
                        localStorage.setItem('zuno_token', data.data.token);
                        localStorage.setItem('zuno_user', JSON.stringify(data.data.user));
                        return { success: true, message: data.message };
                  }
                  return { success: false, message: data.message };
            } catch (error) {
                  // If it's a timeout or network error, it's likely the server cold start
                  if (error.name === 'AbortError' || error.message === 'Failed to fetch') {
                        return {
                              success: false,
                              status: 'waking_up',
                              message: 'Server is taking longer than usual to respond. It is likely waking up — please wait a moment and try again.'
                        };
                  }
                  return {
                        success: false,
                        message: 'Login failed. Please check your credentials and try again.'
                  };
            }
      };

      const register = async (userData) => {
            try {
                  const res = await fetchWithTimeout(`${API_URL}/auth/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(userData)
                  });
                  const data = await res.json();

                  if (data.success) {
                        setUser(data.data.user);
                        setToken(data.data.token);
                        localStorage.setItem('zuno_token', data.data.token);
                        localStorage.setItem('zuno_user', JSON.stringify(data.data.user));
                        return { success: true, message: data.message };
                  }
                  return { success: false, message: data.message };
            } catch (error) {
                  return {
                        success: false,
                        message: error.name === 'AbortError'
                              ? 'Request timed out. Please check your connection.'
                              : 'Registration failed. Please try again.'
                  };
            }
      };

      const logout = () => {
            setUser(null);
            setToken(null);
            localStorage.removeItem('zuno_token');
            localStorage.removeItem('zuno_user');
      };

      const updateProfile = async (userData) => {
            try {
                  const res = await fetch(`${API_URL}/users/profile`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(userData)
                  });
                  const data = await res.json();
                  if (data.success) {
                        setUser(data.data.user);
                        localStorage.setItem('zuno_user', JSON.stringify(data.data.user));
                        return { success: true, message: data.message };
                  }
                  return { success: false, message: data.message };
            } catch (error) {
                  return { success: false, message: 'Failed to update profile' };
            }
      };

      const blockUser = async (userId) => {
            try {
                  const res = await fetch(`${API_URL}/users/${userId}/block`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        const updatedUser = {
                              ...user,
                              blockedUsers: [...(user.blockedUsers || []), userId]
                        };
                        setUser(updatedUser);
                        localStorage.setItem('zuno_user', JSON.stringify(updatedUser));
                        return { success: true, message: data.message };
                  }
                  return { success: false, message: data.message };
            } catch (error) {
                  return { success: false, message: 'Failed to block user' };
            }
      };

      const unblockUser = async (userId) => {
            try {
                  const res = await fetch(`${API_URL}/users/${userId}/unblock`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        const updatedUser = {
                              ...user,
                              blockedUsers: (user.blockedUsers || []).filter(id => id !== userId)
                        };
                        setUser(updatedUser);
                        localStorage.setItem('zuno_user', JSON.stringify(updatedUser));
                        return { success: true, message: data.message };
                  }
                  return { success: false, message: data.message };
            } catch (error) {
                  return { success: false, message: 'Failed to unblock user' };
            }
      };

      const value = {
            user,
            token,
            loading,
            isAuthenticated: !!user,
            login,
            register,
            logout,
            updateProfile,
            blockUser,
            unblockUser
      };

      return (
            <AuthContext.Provider value={value}>
                  {children}
            </AuthContext.Provider>
      );
};

export const useAuth = () => {
      const context = useContext(AuthContext);
      if (!context) {
            throw new Error('useAuth must be used within an AuthProvider');
      }
      return context;
};
