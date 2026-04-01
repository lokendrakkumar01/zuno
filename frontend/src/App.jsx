import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketContextProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import { LanguageProvider } from './context/LanguageContext';
import { MusicProvider } from './context/MusicContext'; // Correct placement
import SplashScreen from './components/SplashScreen';
import Layout from './components/Layout/Layout';
import Home from './pages/Home';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Upload from './pages/Upload/Upload';
import Profile from './pages/Profile';
import ContentView from './pages/ContentView';
import AdminDashboard from './pages/Admin/AdminDashboard';
import Settings from './pages/Settings/Settings';
import Appearance from './pages/Settings/Appearance';
import Privacy from './pages/Settings/Privacy';
import Language from './pages/Settings/Language';
import Notifications from './pages/Settings/Notifications';
import TimeManagement from './pages/Settings/TimeManagement';
import PasswordSecurity from './pages/Settings/PasswordSecurity';
import CloseFriends from './pages/Settings/CloseFriends';
import Activity from './pages/Settings/Activity';
import ScheduledContent from './pages/Settings/ScheduledContent';
import Insights from './pages/Settings/Insights';
import Search from './pages/Search/Search';
import SavedContent from './pages/SavedContent';
import Messages from './pages/Messages/Messages';
import Chat from './pages/Messages/Chat';
import GroupChat from './pages/Messages/GroupChat';
import Status from './pages/Status';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import GlobalNotification from './components/GlobalNotification';
import CallOverlay from './components/CallOverlay';
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
                  <ToastContainer theme="colored" autoClose={4000} />
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
                              <Route path="saved" element={<SavedContent />} />
                              <Route path="content/saved" element={<SavedContent />} />
                              <Route path="content/:id" element={<ContentView />} />
                              <Route path="u/:username" element={<Profile />} />
                        </Route>

                        {/* Admin routes */}
                        <Route path="/admin/*" element={<AdminDashboard />} />
                  </Routes>
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
