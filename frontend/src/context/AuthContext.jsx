import { createContext, useContext, useEffect, useState } from 'react';
import { API_URL } from '../config';
import {
      clearStoredSession,
      persistStoredAuthUser,
      persistStoredSession,
      readStoredAuthUser,
      readStoredRefreshToken,
      readStoredToken
} from '../utils/session';
import { startKeepAlive, stopKeepAlive } from '../utils/keepAlive';
import { fetchWithTimeout, DEFAULT_REQUEST_TIMEOUT_MS } from '../utils/fetchWithTimeout';

const AuthContext = createContext(null);
const AUTH_REFRESH_TIMEOUT_MS = 8000;
const AUTH_RETRY_DELAYS = [5000, 10000, 20000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const isRetriableNetworkError = (error) => (
      error?.name === 'AbortError'
      || error?.message === 'Failed to fetch'
      || error?.message?.includes('network')
      || error?.message?.includes('timeout')
      || error?.message?.includes('HTTP 5')
);

export const AuthProvider = ({ children }) => {
      const [token, setToken] = useState(() => readStoredToken());
      const [refreshToken, setRefreshToken] = useState(() => readStoredRefreshToken());
      const [user, setUser] = useState(() => (readStoredToken() ? readStoredAuthUser() : null));
      const [loading, setLoading] = useState(() => {
            const storedToken = readStoredToken();
            if (!storedToken) return false;
            return !readStoredAuthUser();
      });

      const applyAuthenticatedSession = (nextUser, nextToken = token, nextRefreshToken = refreshToken) => {
            setUser(nextUser);
            setToken(nextToken);
            setRefreshToken(nextRefreshToken);
            persistStoredSession({
                  user: nextUser,
                  token: nextToken,
                  refreshToken: nextRefreshToken
            });
      };

      const logout = () => {
            stopKeepAlive();
            setUser(null);
            setToken(null);
            setRefreshToken(null);
            clearStoredSession();
      };

      const refreshSessionToken = async () => {
            if (!refreshToken) {
                  throw new Error('Missing refresh token');
            }

            const res = await fetchWithTimeout(`${API_URL}/auth/refresh`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refreshToken })
            }, AUTH_REFRESH_TIMEOUT_MS);

            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success || !data?.data?.token) {
                  throw new Error(data?.message || 'Session refresh failed');
            }

            applyAuthenticatedSession(
                  data.data.user || readStoredAuthUser(),
                  data.data.token,
                  data.data.refreshToken || refreshToken
            );

            return data.data.token;
      };

      useEffect(() => {
            let ignore = false;

            const checkAuth = async () => {
                  if (!token) {
                        setUser(null);
                        setLoading(false);
                        return;
                  }

                  const hasOptimisticUser = Boolean(readStoredAuthUser());
                  if (!hasOptimisticUser) {
                        setLoading(true);
                  }

                  try {
                        let currentToken = token;
                        let res = await fetchWithTimeout(`${API_URL}/auth/me`, {
                              headers: { Authorization: `Bearer ${currentToken}` }
                        }, AUTH_REFRESH_TIMEOUT_MS);
                        let data = await res.json().catch(() => null);

                        if (ignore) return;

                        if (res.status === 401 && refreshToken) {
                              currentToken = await refreshSessionToken();
                              res = await fetchWithTimeout(`${API_URL}/auth/me`, {
                                    headers: { Authorization: `Bearer ${currentToken}` }
                              }, AUTH_REFRESH_TIMEOUT_MS);
                              data = await res.json().catch(() => null);
                        }

                        if (res.ok && data?.success && data?.data?.user) {
                              setUser(data.data.user);
                              persistStoredAuthUser(data.data.user);
                        } else if (res.status === 401) {
                              logout();
                        } else {
                              throw new Error(data?.message || `Auth check failed with status ${res.status}`);
                        }
                  } catch (error) {
                        if (!ignore) {
                              console.error('Auth check failed (server may be starting):', error);
                              if (isRetriableNetworkError(error)) {
                                    const cachedUser = readStoredAuthUser();
                                    if (cachedUser) {
                                          setUser(cachedUser);
                                    }
                              } else {
                                    logout();
                              }
                        }
                  } finally {
                        if (!ignore) {
                              setLoading(false);
                        }
                  }
            };

            checkAuth();

            return () => {
                  ignore = true;
            };
      }, [token, refreshToken]);

      useEffect(() => {
            if (token && user) {
                  startKeepAlive();
                  return () => stopKeepAlive();
            }

            stopKeepAlive();
            return undefined;
      }, [token, user]);

      const login = async (email, password, onRetry = null) => {
            const MAX_RETRIES = 3;

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
                              applyAuthenticatedSession(data.data.user, data.data.token, data.data.refreshToken);
                              return { success: true, message: data.message };
                        }

                        return {
                              success: false,
                              message: data.message || 'Invalid email or password.'
                        };
                  } catch (error) {
                        const isNetworkError = isRetriableNetworkError(error);

                        if (isNetworkError && attempt < MAX_RETRIES) {
                              const retryDelay = AUTH_RETRY_DELAYS[attempt - 1] || 15000;
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

      const googleLogin = async (credential, onRetry = null) => {
            const MAX_RETRIES = 3;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
                  try {
                        const res = await fetchWithTimeout(`${API_URL}/auth/google`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                    credential,
                                    origin: typeof window !== 'undefined' ? window.location.origin : '',
                                    redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/login` : ''
                              })
                        }, DEFAULT_REQUEST_TIMEOUT_MS);

                        if (!res.ok && res.status !== 400 && res.status !== 401 && res.status !== 422) {
                              throw new Error(`HTTP ${res.status}`);
                        }

                        if (!res.ok) {
                              return {
                                    success: false,
                                    message: await getApiErrorMessage(res, 'Google login failed.')
                              };
                        }

                        const data = await res.json();
                        if (data.success) {
                              applyAuthenticatedSession(data.data.user, data.data.token, data.data.refreshToken);
                              return { success: true, message: data.message || 'Logged in with Google.' };
                        }

                        return { success: false, message: data.message || 'Google login failed.' };
                  } catch (error) {
                        const isNetworkError = isRetriableNetworkError(error);

                        if (isNetworkError && attempt < MAX_RETRIES) {
                              const retryDelay = AUTH_RETRY_DELAYS[attempt - 1] || 15000;
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
                                    ? 'Server is waking up. Please wait 30 seconds and try again.'
                                    : 'Google login failed. Please try again.'
                        };
                  }
            }

            return { success: false, message: 'Google login failed after multiple attempts. Please try again.' };
      };

      const register = async (userData, onRetry = null) => {
            const MAX_RETRIES = 3;

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
                              applyAuthenticatedSession(data.data.user, data.data.token, data.data.refreshToken);
                              return { success: true, message: data.message };
                        }

                        return { success: false, message: data.message || 'Registration failed.' };
                  } catch (error) {
                        const isNetworkError = isRetriableNetworkError(error);

                        if (isNetworkError && attempt < MAX_RETRIES) {
                              const retryDelay = AUTH_RETRY_DELAYS[attempt - 1] || 15000;
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
                  const res = await fetchWithTimeout(`${API_URL}/users/profile`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify(userData)
                  }, DEFAULT_REQUEST_TIMEOUT_MS);
                  const data = await res.json();

                  if (data.success) {
                        applyAuthenticatedSession(data.data.user);
                        return { success: true, message: data.message, data: data.data };
                  }

                  return { success: false, message: data.message || 'Failed to update profile.' };
            } catch {
                  return { success: false, message: 'Failed to update profile' };
            }
      };

      const uploadAvatar = async (file) => {
            try {
                  const formData = new FormData();
                  formData.append('avatar', file);

                  const res = await fetchWithTimeout(`${API_URL}/users/profile/avatar`, {
                        method: 'POST',
                        headers: {
                              Authorization: `Bearer ${token}`
                        },
                        body: formData
                  }, DEFAULT_REQUEST_TIMEOUT_MS);
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
                  const res = await fetchWithTimeout(`${API_URL}/users/${userId}/block`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                  }, DEFAULT_REQUEST_TIMEOUT_MS);
                  const data = await res.json();

                  if (data.success) {
                        if (data.data?.user) {
                              applyAuthenticatedSession(data.data.user);
                        }
                        return { success: true, message: data.message };
                  }

                  return { success: false, message: data.message };
            } catch {
                  return { success: false, message: 'Failed to block user' };
            }
      };

      const unblockUser = async (userId) => {
            try {
                  const res = await fetchWithTimeout(`${API_URL}/users/${userId}/unblock`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                  }, DEFAULT_REQUEST_TIMEOUT_MS);
                  const data = await res.json();

                  if (data.success) {
                        if (data.data?.user) {
                              applyAuthenticatedSession(data.data.user);
                        }
                        return { success: true, message: data.message };
                  }

                  return { success: false, message: data.message };
            } catch {
                  return { success: false, message: 'Failed to unblock user' };
            }
      };

      const updateFollowState = (targetUserId, isFollowing) => {
            if (!user) return;

            const currentFollowing = user.following || [];
            const alreadyFollowing = currentFollowing.some((id) => id?.toString() === targetUserId?.toString());
            const nextFollowing = isFollowing
                  ? (alreadyFollowing ? currentFollowing : [...currentFollowing, targetUserId])
                  : currentFollowing.filter((id) => id?.toString() !== targetUserId?.toString());

            applyAuthenticatedSession({
                  ...user,
                  following: nextFollowing
            });
      };

      const value = {
            user,
            token,
            loading,
            isAuthenticated: !!(token && user),
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
