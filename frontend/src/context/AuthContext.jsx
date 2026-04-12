import { createContext, useContext, useEffect, useState } from 'react';
import { API_URL } from '../config';
import {
      clearStoredSession,
      persistStoredAuthUser,
      persistStoredSession,
      readStoredAuthUser,
      readStoredToken
} from '../utils/session';

const AuthContext = createContext(null);
const AUTH_REFRESH_TIMEOUT_MS = 8000;

const fetchWithTimeout = async (url, options = {}, timeout = 30000) => {
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

const getApiErrorMessage = async (res, fallbackMessage) => {
      let data = null;

      try {
            data = await res.json();
      } catch {
            return fallbackMessage;
      }

      const fieldMessages = data?.fieldErrors
            ? Object.values(data.fieldErrors)
            : Array.isArray(data?.errors)
                  ? data.errors.flatMap((entry) => Object.values(entry || {}))
                  : [];

      const detailedMessage = fieldMessages.filter(Boolean).join(' ');
      return data?.message || detailedMessage || fallbackMessage;
};

export const AuthProvider = ({ children }) => {
      const [user, setUser] = useState(() => readStoredAuthUser());
      const [token, setToken] = useState(() => readStoredToken());
      const [loading, setLoading] = useState(false);

      const applyAuthenticatedSession = (nextUser, nextToken = token) => {
            setUser(nextUser);
            setToken(nextToken);
            persistStoredSession({
                  user: nextUser,
                  token: nextToken
            });
      };

      const logout = () => {
            setUser(null);
            setToken(null);
            clearStoredSession();
      };

      useEffect(() => {
            let ignore = false;

            const checkAuth = async () => {
                  if (!token) {
                        setLoading(false);
                        return;
                  }

                  const cachedUser = readStoredAuthUser();
                  if (cachedUser) {
                        setUser(cachedUser);
                  }

                  // Keep startup non-blocking. Routes can open using the token while /me refreshes silently.
                  setLoading(false);

                  try {
                        const res = await fetchWithTimeout(`${API_URL}/auth/me`, {
                              headers: { Authorization: `Bearer ${token}` }
                        }, AUTH_REFRESH_TIMEOUT_MS);
                        const data = await res.json();

                        if (ignore) return;

                        if (data.success) {
                              setUser(data.data.user);
                              persistStoredAuthUser(data.data.user);
                        } else if (res.status === 401) {
                              logout();
                        }
                  } catch (error) {
                        if (!ignore) {
                              console.error('Auth check failed (server may be starting):', error);
                        }
                  }
            };

            checkAuth();

            return () => {
                  ignore = true;
            };
      }, [token]);

      const login = async (email, password, onRetry = null) => {
            const MAX_RETRIES = 3;
            const RETRY_DELAYS = [5000, 10000, 20000];
            const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

            const attemptLogin = async (timeoutMs = 25000) => {
                  const res = await fetchWithTimeout(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                  }, timeoutMs);

                  if (!res.ok && res.status !== 401 && res.status !== 400 && res.status !== 422) {
                        throw new Error(`HTTP ${res.status}`);
                  }

                  if (!res.ok) {
                        return {
                              success: false,
                              message: await getApiErrorMessage(res, 'Login failed. Please try again.')
                        };
                  }

                  return res.json();
            };

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
                  try {
                        const data = await attemptLogin(25000);
                        if (data.success) {
                              applyAuthenticatedSession(data.data.user, data.data.token);
                              return { success: true, message: data.message };
                        }

                        return {
                              success: false,
                              message: data.message || 'Invalid email or password.'
                        };
                  } catch (error) {
                        const isNetworkError = error.name === 'AbortError'
                              || error.message === 'Failed to fetch'
                              || error.message?.includes('network')
                              || error.message?.includes('timeout')
                              || error.message?.includes('HTTP 5');

                        if (isNetworkError && attempt < MAX_RETRIES) {
                              const retryDelay = RETRY_DELAYS[attempt - 1] || 15000;
                              if (onRetry) {
                                    onRetry({
                                          attempt,
                                          maxRetries: MAX_RETRIES,
                                          retryIn: Math.round(retryDelay / 1000)
                                    });
                              }
                              await sleep(retryDelay);
                              continue;
                        }

                        if (isNetworkError) {
                              return {
                                    success: false,
                                    status: 'waking_up',
                                    message: 'Server is waking up. Please wait 30 seconds and try again.'
                              };
                        }

                        return {
                              success: false,
                              message: 'Login failed. Please check your connection and try again.'
                        };
                  }
            }

            return { success: false, message: 'Login failed after multiple attempts. Please try again.' };
      };

      const googleLogin = async (credential) => {
            try {
                  const res = await fetchWithTimeout(`${API_URL}/auth/google`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ credential })
                  }, 30000);

                  if (!res.ok) {
                        return {
                              success: false,
                              message: await getApiErrorMessage(res, 'Google login failed.')
                        };
                  }

                  const data = await res.json();
                  if (data.success) {
                        applyAuthenticatedSession(data.data.user, data.data.token);
                        return { success: true, message: data.message || 'Logged in with Google.' };
                  }

                  return { success: false, message: data.message || 'Google login failed.' };
            } catch {
                  return {
                        success: false,
                        message: 'Google login failed. Please try again.'
                  };
            }
      };

      const register = async (userData, onRetry = null) => {
            const MAX_RETRIES = 3;
            const RETRY_DELAYS = [5000, 10000, 20000];
            const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
                  try {
                        const res = await fetchWithTimeout(`${API_URL}/auth/register`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(userData)
                        }, 35000);

                        if (!res.ok) {
                              return {
                                    success: false,
                                    message: await getApiErrorMessage(res, 'Registration failed.')
                              };
                        }

                        const data = await res.json();
                        if (data.success) {
                              applyAuthenticatedSession(data.data.user, data.data.token);
                              return { success: true, message: data.message };
                        }

                        return { success: false, message: data.message || 'Registration failed.' };
                  } catch (error) {
                        const isNetworkError = error.name === 'AbortError'
                              || error.message === 'Failed to fetch'
                              || error.message?.includes('network')
                              || error.message?.includes('timeout');

                        if (isNetworkError && attempt < MAX_RETRIES) {
                              const retryDelay = RETRY_DELAYS[attempt - 1] || 15000;
                              if (onRetry) {
                                    onRetry({
                                          attempt,
                                          maxRetries: MAX_RETRIES,
                                          retryIn: Math.round(retryDelay / 1000)
                                    });
                              }
                              await sleep(retryDelay);
                              continue;
                        }

                        return {
                              success: false,
                              status: isNetworkError ? 'waking_up' : 'error',
                              message: isNetworkError
                                    ? 'Server is starting up. Please wait a moment and try again.'
                                    : 'Registration failed. Please try again.'
                        };
                  }
            }

            return { success: false, message: 'Registration failed after multiple attempts. Please try again.' };
      };

      const updateProfile = async (userData) => {
            try {
                  const res = await fetch(`${API_URL}/users/profile`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify(userData)
                  });
                  const data = await res.json();

                  if (data.success) {
                        applyAuthenticatedSession(data.data.user);
                        return { success: true, message: data.message, data: data.data };
                  }

                  return { success: false, message: data.message };
            } catch {
                  return { success: false, message: 'Failed to update profile' };
            }
      };

      const uploadAvatar = async (file) => {
            try {
                  const formData = new FormData();
                  formData.append('avatar', file);

                  const res = await fetch(`${API_URL}/users/profile/avatar`, {
                        method: 'POST',
                        headers: {
                              Authorization: `Bearer ${token}`
                        },
                        body: formData
                  });
                  const data = await res.json();

                  if (data.success) {
                        applyAuthenticatedSession(data.data.user);
                        return { success: true, message: data.message, data: data.data };
                  }

                  return { success: false, message: data.message || 'Failed to upload profile photo.' };
            } catch {
                  return { success: false, message: 'Failed to upload profile photo.' };
            }
      };

      const blockUser = async (userId) => {
            try {
                  const res = await fetch(`${API_URL}/users/${userId}/block`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                  });
                  const data = await res.json();

                  if (data.success) {
                        const updatedUser = {
                              ...user,
                              blockedUsers: [...(user?.blockedUsers || []), userId]
                        };
                        applyAuthenticatedSession(updatedUser);
                        return { success: true, message: data.message };
                  }

                  return { success: false, message: data.message };
            } catch {
                  return { success: false, message: 'Failed to block user' };
            }
      };

      const unblockUser = async (userId) => {
            try {
                  const res = await fetch(`${API_URL}/users/${userId}/unblock`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                  });
                  const data = await res.json();

                  if (data.success) {
                        const updatedUser = {
                              ...user,
                              blockedUsers: (user?.blockedUsers || []).filter((id) => id !== userId)
                        };
                        applyAuthenticatedSession(updatedUser);
                        return { success: true, message: data.message };
                  }

                  return { success: false, message: data.message };
            } catch {
                  return { success: false, message: 'Failed to unblock user' };
            }
      };

      const updateFollowState = (targetUserId, isFollowing) => {
            if (!user) return;

            const nextFollowing = isFollowing
                  ? [...(user.following || []), targetUserId]
                  : (user.following || []).filter((id) => id !== targetUserId);

            applyAuthenticatedSession({
                  ...user,
                  following: nextFollowing
            });
      };

      const value = {
            user,
            token,
            loading,
            isAuthenticated: !!(token || user),
            login,
            googleLogin,
            register,
            logout,
            updateProfile,
            uploadAvatar,
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
