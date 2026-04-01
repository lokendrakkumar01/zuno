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

      const login = async (email, password, onRetry = null) => {
            const MAX_RETRIES = 3;
            const RETRY_DELAY = 5000; // 5 seconds between retries

            const attemptLogin = async (timeoutMs = 30000) => {
                  const res = await fetchWithTimeout(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                  }, timeoutMs);
                  return await res.json();
            };

            const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                  try {
                        const data = await attemptLogin(30000);
                        if (data.success) {
                              setUser(data.data.user);
                              setToken(data.data.token);
                              localStorage.setItem('zuno_token', data.data.token);
                              localStorage.setItem('zuno_user', JSON.stringify(data.data.user));
                              return { success: true, message: data.message };
                        }
                        // Server responded but credentials are wrong — don't retry
                        return { success: false, message: data.message };
                  } catch (error) {
                        const isNetworkError = error.name === 'AbortError' ||
                              error.message === 'Failed to fetch' ||
                              error.message?.includes('network') ||
                              error.message?.includes('timeout');

                        if (isNetworkError && attempt < MAX_RETRIES) {
                              // Notify UI about waking up and retry countdown
                              if (onRetry) {
                                    onRetry({ attempt, maxRetries: MAX_RETRIES, retryIn: RETRY_DELAY / 1000 });
                              }
                              await sleep(RETRY_DELAY);
                              continue;
                        }

                        // Final attempt failed or non-network error
                        if (isNetworkError) {
                              return {
                                    success: false,
                                    status: 'waking_up',
                                    message: 'Server is waking up. Please wait 30 seconds and try again.'
                              };
                        }

                        return {
                              success: false,
                              message: 'Login failed. Please check your credentials and try again.'
                        };
                  }
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

      const updateFollowState = (targetUserId, isFollowing) => {
            if (!user) return;

            const newFollowing = isFollowing
                  ? [...(user.following || []), targetUserId]
                  : (user.following || []).filter(id => id !== targetUserId);

            const updatedUser = { ...user, following: newFollowing };
            setUser(updatedUser);
            localStorage.setItem('zuno_user', JSON.stringify(updatedUser));
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
            unblockUser,
            updateFollowState
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
