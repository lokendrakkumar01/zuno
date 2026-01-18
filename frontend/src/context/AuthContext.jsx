import { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
      const [user, setUser] = useState(null);
      const [token, setToken] = useState(localStorage.getItem('zuno_token'));
      const [loading, setLoading] = useState(true);

      // Check if user is logged in on mount
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
                              } else {
                                    logout();
                              }
                        } catch (error) {
                              console.error('Auth check failed:', error);
                              logout();
                        }
                  }
                  setLoading(false);
            };
            checkAuth();
      }, [token]);

      const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
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
            try {
                  const res = await fetchWithTimeout(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                  });
                  const data = await res.json();

                  if (data.success) {
                        setUser(data.data.user);
                        setToken(data.data.token);
                        localStorage.setItem('zuno_token', data.data.token);
                        return { success: true, message: data.message };
                  }
                  return { success: false, message: data.message };
            } catch (error) {
                  return {
                        success: false,
                        message: error.name === 'AbortError'
                              ? 'Request timed out. Please check your connection.'
                              : 'Login failed. Please try again.'
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
                        setUser(prev => ({ ...prev, ...data.data.user }));
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
