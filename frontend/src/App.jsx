import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketContextProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import { LanguageProvider } from './context/LanguageContext';
import { MusicProvider } from './context/MusicContext';
import SplashScreen from './components/SplashScreen';
import Layout from './components/Layout/Layout';

// Lazy load all heavy page components
const Home = React.lazy(() => import('./pages/Home'));
const Login = React.lazy(() => import('./pages/Auth/Login'));
const Register = React.lazy(() => import('./pages/Auth/Register'));
const Upload = React.lazy(() => import('./pages/Upload/Upload'));
const Profile = React.lazy(() => import('./pages/Profile'));
const ContentView = React.lazy(() => import('./pages/ContentView'));
const AdminDashboard = React.lazy(() => import('./pages/Admin/AdminDashboard'));
const Settings = React.lazy(() => import('./pages/Settings/Settings'));
const Appearance = React.lazy(() => import('./pages/Settings/Appearance'));
const Privacy = React.lazy(() => import('./pages/Settings/Privacy'));
const Language = React.lazy(() => import('./pages/Settings/Language'));
const Notifications = React.lazy(() => import('./pages/Settings/Notifications'));
const TimeManagement = React.lazy(() => import('./pages/Settings/TimeManagement'));
const PasswordSecurity = React.lazy(() => import('./pages/Settings/PasswordSecurity'));
const CloseFriends = React.lazy(() => import('./pages/Settings/CloseFriends'));
const Activity = React.lazy(() => import('./pages/Settings/Activity'));
const ScheduledContent = React.lazy(() => import('./pages/Settings/ScheduledContent'));
const Insights = React.lazy(() => import('./pages/Settings/Insights'));
const Search = React.lazy(() => import('./pages/Search/Search'));
const SavedContent = React.lazy(() => import('./pages/SavedContent'));
const Messages = React.lazy(() => import('./pages/Messages/Messages'));
const Chat = React.lazy(() => import('./pages/Messages/Chat'));
const GroupChat = React.lazy(() => import('./pages/Messages/GroupChat'));
const LiveStream = React.lazy(() => import('./pages/LiveStream'));
const Status = React.lazy(() => import('./pages/Status'));

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import GlobalNotification from './components/GlobalNotification';
import CallOverlay from './components/CallOverlay';
import GroupCallOverlay from './components/GroupCallOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import { API_BASE_URL } from './config';

// Main App Router Component (inside AuthProvider)
function AppRouter() {
      const { isAuthenticated, loading } = useAuth();
      const [showSplash, setShowSplash] = useState(() => {
            const shown = localStorage.getItem('zuno_splash_shown');
            const time = localStorage.getItem('zuno_splash_time');
            if (shown === 'true' && time && (Date.now() - parseInt(time) < 24 * 60 * 60 * 1000)) {
                  return false;
            }
            return true;
      });
      const navigate = useNavigate();

      useEffect(() => {
            // Check if splash has been shown recently
            const splashShown = localStorage.getItem('zuno_splash_shown');
            const splashTimestamp = localStorage.getItem('zuno_splash_time');
            const now = Date.now();

            // Only show splash once every 24 hours
            if (splashShown === 'true' && splashTimestamp && (now - parseInt(splashTimestamp)) < 24 * 60 * 60 * 1000) {
                  setShowSplash(false);
            }
      }, []);

      const handleSplashComplete = () => {
            // Mark splash as shown
            localStorage.setItem('zuno_splash_shown', 'true');
            localStorage.setItem('zuno_splash_time', Date.now().toString());
            setShowSplash(false);

            // Navigate if not already on a route
            if (window.location.pathname === '/' || window.location.pathname === '/login') {
                  if (isAuthenticated) navigate('/');
                  else navigate('/login');
            }
      };

      // Show splash screen
      if (showSplash) {
            return <SplashScreen onComplete={handleSplashComplete} />;
      }

      return (
            <>
                  <GlobalNotification />
                  <CallOverlay />
                  {/* Group Call Overlay handled via CallContext later, or we can render it conditionally here using CallContext state. For now, we will add the state to CallContext and let CallProvider render it, or we render it here consuming the context. Actually, let's keep GroupCallOverlay rendering inside App conditionally based on useCallContext state.*/}
                  <ToastContainer theme="colored" autoClose={4000} />
                  <Suspense fallback={<div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#ef4444', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>}>
                    <Routes>
                          {/* Auth routes - no layout */}
                          <Route path="/login" element={<Login />} />
                          <Route path="/register" element={<Register />} />

                          {/* Main routes with layout */}
                          <Route path="/" element={<Layout />}>
                                <Route index element={<Home />} />
                                <Route path="upload" element={<Upload />} />
                                <Route path="profile" element={<Profile />} />
                                <Route path="settings" element={<Settings />} />
                                <Route path="settings/appearance" element={<Appearance />} />
                                <Route path="settings/privacy" element={<Privacy />} />
                                <Route path="settings/language" element={<Language />} />
                                <Route path="settings/notifications" element={<Notifications />} />
                                <Route path="settings/time-management" element={<TimeManagement />} />
                                <Route path="settings/password-security" element={<PasswordSecurity />} />
                                <Route path="settings/close-friends" element={<CloseFriends />} />
                                <Route path="settings/activity" element={<Activity />} />
                                <Route path="settings/scheduled-content" element={<ScheduledContent />} />
                                <Route path="settings/insights" element={<Insights />} />
                                <Route path="status" element={<Status />} />
                                <Route path="search" element={<Search />} />
                                <Route path="messages" element={<Messages />} />
                                <Route path="messages/group/:groupId" element={<GroupChat />} />
                                <Route path="messages/:userId" element={<Chat />} />
                                <Route path="live/:hostId?" element={<LiveStream />} />
                                <Route path="live" element={<LiveStream />} />
                                <Route path="saved" element={<SavedContent />} />
                                <Route path="content/saved" element={<SavedContent />} />
                                <Route path="content/:id" element={<ContentView />} />
                                <Route path="u/:username" element={<Profile />} />
                          </Route>

                          {/* Admin routes */}
                          <Route path="/admin/*" element={<AdminDashboard />} />
                    </Routes>
                  </Suspense>
            </>
      );
}

function App() {
      // Initialize theme on app load
      useEffect(() => {
            const savedTheme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);
      }, []);

      // Keep-alive ping to prevent Render free tier server from sleeping
      // This helps avoid login failures and content loading delays
      useEffect(() => {
            const ping = () => {
                  fetch(`${API_BASE_URL}/api/ping`, { method: 'GET' })
                        .catch(() => {}); // Silent - don't show any error
            };
            // Ping immediately on load
            ping();
            // Then ping every 13 minutes (Render sleeps after 15 mins of inactivity)
            const interval = setInterval(ping, 13 * 60 * 1000);
            return () => clearInterval(interval);
      }, []);

      return (
            <AuthProvider>
                  <SocketContextProvider>
                        <LanguageProvider>
                              <MusicProvider>
                                    <Router>
                                          <ErrorBoundary>
                                                <CallProvider>
                                                      <AppRouter />
                                                </CallProvider>
                                          </ErrorBoundary>
                                    </Router>
                              </MusicProvider>
                        </LanguageProvider>
                  </SocketContextProvider>
            </AuthProvider>
      );
}

export default App;
