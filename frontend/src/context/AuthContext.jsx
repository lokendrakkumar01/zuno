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
      const [loading, setLoading] = useState(true);

      // Check auth on mount — but DON'T logout on failure (server might be cold)
      useEffect(() => {
            const checkAuth = async () => {
                  if (token) {
                        try {
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
                              // For other errors (500, network), keep cached user
                        } catch (error) {
                              console.error('Auth check failed (server may be starting):', error);
                              // Keep cached user — don't logout on network errors
                        }
                  }
                  setLoading(false);
            };
            checkAuth();
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
            const attemptLogin = async () => {
                  const res = await fetchWithTimeout(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                  });
                  return await res.json();
            };

            try {
                  const data = await attemptLogin();
                  if (data.success) {
                        setUser(data.data.user);
                        setToken(data.data.token);
                        localStorage.setItem('zuno_token', data.data.token);
                        localStorage.setItem('zuno_user', JSON.stringify(data.data.user));
                        return { success: true, message: data.message };
                  }
                  return { success: false, message: data.message };
            } catch (error) {
                  // First attempt failed — retry once (server may be waking up)
                  if (error.name === 'AbortError' || error.message === 'Failed to fetch') {
                        try {
                              const data = await attemptLogin();
                              if (data.success) {
                                    setUser(data.data.user);
                                    setToken(data.data.token);
                                    localStorage.setItem('zuno_token', data.data.token);
                                    localStorage.setItem('zuno_user', JSON.stringify(data.data.user));
                                    return { success: true, message: data.message };
                              }
                              return { success: false, message: data.message };
                        } catch (retryError) {
                              return {
                                    success: false,
                                    message: 'Server is taking too long to respond. It may be waking up — please try again in a few seconds.'
                              };
                        }
                  }
                  return {
                        success: false,
                        message: 'Login failed. Please check your connection and try again.'
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

      const updateProfile = async (profileData) => {
            try {
                  const res = await fetch(`${API_URL}/users/profile`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(profileData)
                  });
                  const data = await res.json();

                  if (data.success) {
                        const updatedUser = { ...user, ...data.data.user };
                        setUser(updatedUser);
                        localStorage.setItem('zuno_user', JSON.stringify(updatedUser));
                        return { success: true, message: data.message };
                  }
                  return { success: false, message: data.message };
            } catch (error) {
                  return { success: false, message: 'Update failed. Please try again.' };
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
            updateProfile
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
