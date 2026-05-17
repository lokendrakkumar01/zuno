import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
const AUTH_REFRESH_TIMEOUT_MS = 6000;
const AUTH_RETRY_DELAYS = [1000, 2500];

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

const getApiErrorPayload = async (res, fallbackMessage) => {
      let data = null;

      try {
            data = await res.json();
      } catch {
            data = {};
      }

      const fieldMessages = data?.fieldErrors
            ? Object.values(data.fieldErrors)
            : Array.isArray(data?.errors)
                  ? data.errors.flatMap((entry) => Object.values(entry || {}))
                  : [];
      const detailedMessage = fieldMessages.filter(Boolean).join(' ');

      return {
            ...data,
            success: false,
            statusCode: res.status,
            message: data?.message || detailedMessage || fallbackMessage,
            requiresVerification: Boolean(data?.requiresVerification || data?.data?.requiresVerification),
            email: data?.email || data?.data?.email || ''
      };
};

const isRetriableNetworkError = (error) => (
      error?.name === 'AbortError'
      || error?.message === 'Failed to fetch'
      || error?.message?.includes('network')
      || error?.message?.includes('timeout')
      || error?.message?.includes('HTTP 5')
);

const isRecoverableAuthError = (error) => (
      isRetriableNetworkError(error)
      || error?.status === 429
      || (typeof error?.status === 'number' && error.status >= 500)
);

const getAuthSession = (data) => {
      const payload = data?.data || data || {};
      return {
            user: payload.user || data?.user || null,
            token: payload.token || payload.accessToken || data?.accessToken || null,
            refreshToken: payload.refreshToken || data?.refreshToken || null
      };
};

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
            const tokenToRevoke = token;

            if (tokenToRevoke) {
                  fetchWithTimeout(`${API_URL}/auth/logout`, {
                        method: 'POST',
                        headers: {
                              Authorization: `Bearer ${tokenToRevoke}`
                        }
                  }, AUTH_REFRESH_TIMEOUT_MS).catch(() => undefined);
            }

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
                  const error = new Error(data?.message || 'Session refresh failed');
                  error.status = res.status;
                  throw error;
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

                  const cachedUser = readStoredAuthUser();
                  const optimisticUser = cachedUser || user;
                  const hasOptimisticUser = Boolean(optimisticUser);
                  if (!hasOptimisticUser) {
                        setLoading(true);
                  } else if (cachedUser && !user) {
                        setUser(cachedUser);
                  }

                  try {
                        let currentToken = token;
                        let res = await fetchWithTimeout(`${API_URL}/auth/me`, {
                              headers: { Authorization: `Bearer ${currentToken}` }
                        }, AUTH_REFRESH_TIMEOUT_MS);
                        let data = await res.json().catch(() => null);

                        if (ignore) return;

                        if (res.status === 401 && refreshToken) {
                              try {
                                    currentToken = await refreshSessionToken();
                                    res = await fetchWithTimeout(`${API_URL}/auth/me`, {
                                          headers: { Authorization: `Bearer ${currentToken}` }
                                    }, AUTH_REFRESH_TIMEOUT_MS);
                                    data = await res.json().catch(() => null);
                              } catch {
                                    // Refresh failed - keep cached user if available
                                    if (optimisticUser) {
                                          setUser(optimisticUser);
                                          setLoading(false);
                                          return;
                                    }
                                    logout();
                                    return;
                              }
                        }

                        if (res.ok && (data?.success) && (data?.data?.user || data?.user)) {
                              const freshUser = data?.data?.user || data?.user;
                              setUser(freshUser);
                              persistStoredAuthUser(freshUser);
                        } else if (res.status === 401) {
                              // Only logout on explicit rejection - not network errors
                              if (!optimisticUser) logout();
                              else setUser(optimisticUser); // Keep cached user
                        } else {
                              // Server error / other - keep cached user to avoid logout on downtime
                              if (optimisticUser) {
                                    setUser(optimisticUser);
                              }
                        }
                  } catch (error) {
                        if (!ignore) {
                              // CRITICAL FIX: Never logout on network errors - keep cached session
                              console.warn('Auth check failed (network/server issue):', error.message);
                              if (optimisticUser) {
                                    setUser(optimisticUser);
                                    persistStoredAuthUser(optimisticUser);
                              }
                              // Only logout if we have no cached user AND it's a definitive auth error
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
            const MAX_RETRIES = 2;

            const attemptLogin = async (timeoutMs = 12000) => {
                  const res = await fetchWithTimeout(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                  }, timeoutMs);

                  if (!res.ok && res.status !== 401 && res.status !== 400 && res.status !== 403 && res.status !== 422) {
                        throw new Error(`HTTP ${res.status}`);
                  }

                  if (!res.ok) return getApiErrorPayload(res, 'Login failed. Please try again.');

                  return res.json();
            };

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
                  try {
                        const data = await attemptLogin(12000);
                        if (data.success) {
                              const session = getAuthSession(data);
                              if (!session.user || !session.token) {
                                    return { success: false, message: 'Login response was missing session data.' };
                              }
                              applyAuthenticatedSession(session.user, session.token, session.refreshToken);
                              return { success: true, message: data.message };
                        }

                        return { ...data, success: false, message: data.message || 'Invalid email or password.' };
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
                                    message: 'Could not reach the server. Please try again now.'
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
            const MAX_RETRIES = 2;

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
                        }, 12000);

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
                              const session = getAuthSession(data);
                              if (!session.user || !session.token) {
                                    return { success: false, message: 'Google login response was missing session data.' };
                              }
                              applyAuthenticatedSession(session.user, session.token, session.refreshToken);
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
                                    ? 'Could not reach the server. Please try again now.'
                                    : 'Google login failed. Please try again.'
                        };
                  }
            }

            return { success: false, message: 'Google login failed after multiple attempts. Please try again.' };
      };

      const register = async (userData, onRetry = null) => {
            const MAX_RETRIES = 2;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
                  try {
                        const res = await fetchWithTimeout(`${API_URL}/auth/register`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(userData)
                        }, 12000);

                        if (!res.ok) return getApiErrorPayload(res, 'Registration failed.');

                        const data = await res.json();
                        if (data.success) {
                              if (data.requiresVerification || data.data?.requiresVerification) {
                                    return {
                                          success: true,
                                          requiresVerification: true,
                                          email: data.email || data.data?.email || email,
                                          message: data.message || 'Please verify your email.'
                                    };
                              }

                              const session = getAuthSession(data);
                              if (!session.user || !session.token) {
                                    return { success: false, message: 'Registration response was missing session data.' };
                              }
                              applyAuthenticatedSession(session.user, session.token, session.refreshToken);
                              return { success: true, message: data.message };
                        }

                        return { ...data, success: false, message: data.message || 'Registration failed.' };
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
                                    ? 'Could not reach the server. Please try again now.'
                                    : 'Registration failed. Please try again.'
                        };
                  }
            }

            return { success: false, message: 'Registration failed after multiple attempts. Please try again.' };
      };

      const verifyEmailOtp = async ({ email, otp }) => {
            try {
                  const res = await fetchWithTimeout(`${API_URL}/auth/verify-email`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, otp })
                  }, DEFAULT_REQUEST_TIMEOUT_MS);

                  if (!res.ok) return getApiErrorPayload(res, 'Email verification failed.');

                  const data = await res.json();
                  if (data.success) {
                        const session = getAuthSession(data);
                        if (session.user && session.token) {
                              applyAuthenticatedSession(session.user, session.token, session.refreshToken);
                              return { success: true, message: data.message || 'Email verified.' };
                        }
                  }

                  return { success: false, message: data.message || 'Email verification failed.' };
            } catch {
                  return { success: false, message: 'Could not verify OTP. Please try again.' };
            }
      };

      const resendOtp = async (email) => {
            try {
                  const res = await fetchWithTimeout(`${API_URL}/auth/resend-otp`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                  }, DEFAULT_REQUEST_TIMEOUT_MS);

                  if (!res.ok) return getApiErrorPayload(res, 'Could not resend OTP.');

                  const data = await res.json();
                  return {
                        success: Boolean(data.success),
                        message: data.message || 'OTP sent.',
                        data: data.data || {}
                  };
            } catch {
                  return { success: false, message: 'Could not resend OTP. Please try again.' };
            }
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

      // Fallback fast-send helper that preserves the existing API surface
      // without depending on SocketContext from inside AuthProvider.
      const sendMessageFast = useCallback(async (receiverId, messageData) => {
            if (!token || !receiverId) {
                  return false;
            }

            try {
                  const isFormDataPayload = typeof FormData !== 'undefined' && messageData instanceof FormData;
                  const requestHeaders = {
                        Authorization: `Bearer ${token}`
                  };

                  if (!isFormDataPayload) {
                        requestHeaders['Content-Type'] = 'application/json';
                  }

                  const res = await fetchWithTimeout(`${API_URL}/messages/${receiverId}`, {
                        method: 'POST',
                        headers: requestHeaders,
                        body: isFormDataPayload ? messageData : JSON.stringify(messageData || {})
                  }, DEFAULT_REQUEST_TIMEOUT_MS);

                  const data = await res.json().catch(() => null);
                  return Boolean(res.ok && data?.success);
            } catch {
                  return false;
            }
      }, [token]);

      const value = {
            user,
            token,
            loading,
            isAuthenticated: Boolean(token),
            login,
            googleLogin,
            register,
            verifyEmailOtp,
            resendOtp,
            logout,
            updateProfile,
            uploadAvatar,
            blockUser,
            unblockUser,
            updateFollowState,
            sendMessageFast
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
