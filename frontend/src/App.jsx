import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketContextProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import { LanguageProvider } from './context/LanguageContext';
import { MusicProvider } from './context/MusicContext';
import { ThemeProvider } from './context/ThemeContext';
import SplashScreen from './components/SplashScreen';
import RouteSuspenseFallback from './components/RouteSuspenseFallback';
import Layout from './components/Layout/Layout';

// Lazy load all heavy page components
const Landing = React.lazy(loadLanding);
const Home = React.lazy(loadHome);
const Login = React.lazy(loadLogin);
const Register = React.lazy(loadRegister);
const ResetPassword = React.lazy(loadResetPassword);
const Upload = React.lazy(loadUpload);
const Profile = React.lazy(loadProfile);
const ContentView = React.lazy(loadContentView);
const AdminDashboard = React.lazy(loadAdminDashboard);
const Settings = React.lazy(loadSettings);
const Appearance = React.lazy(loadAppearance);
const Privacy = React.lazy(loadPrivacy);
const Language = React.lazy(loadLanguage);
const Notifications = React.lazy(loadNotifications);
const TimeManagement = React.lazy(loadTimeManagement);
const PasswordSecurity = React.lazy(loadPasswordSecurity);
const CloseFriends = React.lazy(loadCloseFriends);
const Activity = React.lazy(loadActivity);
const ScheduledContent = React.lazy(loadScheduledContent);
const Insights = React.lazy(loadInsights);
const Search = React.lazy(loadSearch);
const SavedContent = React.lazy(loadSavedContent);
const Messages = React.lazy(loadMessages);
const Chat = React.lazy(loadChat);
const GroupChat = React.lazy(loadGroupChat);
const LiveStream = React.lazy(loadLiveStream);
const Status = React.lazy(loadStatus);

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import GlobalNotification from './components/GlobalNotification';
import CallOverlay from './components/CallOverlay';
import GroupCallOverlay from './components/GroupCallOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import { API_URL } from './config';
import { fetchWithTimeout, DEFAULT_REQUEST_TIMEOUT_MS } from './utils/fetchWithTimeout';

const WARMUP_FETCH_MS = Math.min(DEFAULT_REQUEST_TIMEOUT_MS, 28000);

function loadLanding() { return import('./pages/Landing'); }
function loadHome() { return import('./pages/Home'); }
function loadLogin() { return import('./pages/Auth/Login'); }
function loadRegister() { return import('./pages/Auth/Register'); }
function loadResetPassword() { return import('./pages/Auth/ResetPassword'); }
function loadUpload() { return import('./pages/Upload/Upload'); }
function loadProfile() { return import('./pages/Profile'); }
function loadContentView() { return import('./pages/ContentView'); }
function loadAdminDashboard() { return import('./pages/Admin/AdminDashboard'); }
function loadSettings() { return import('./pages/Settings/Settings'); }
function loadAppearance() { return import('./pages/Settings/Appearance'); }
function loadPrivacy() { return import('./pages/Settings/Privacy'); }
function loadLanguage() { return import('./pages/Settings/Language'); }
function loadNotifications() { return import('./pages/Settings/Notifications'); }
function loadTimeManagement() { return import('./pages/Settings/TimeManagement'); }
function loadPasswordSecurity() { return import('./pages/Settings/PasswordSecurity'); }
function loadCloseFriends() { return import('./pages/Settings/CloseFriends'); }
function loadActivity() { return import('./pages/Settings/Activity'); }
function loadScheduledContent() { return import('./pages/Settings/ScheduledContent'); }
function loadInsights() { return import('./pages/Settings/Insights'); }
function loadSearch() { return import('./pages/Search/Search'); }
function loadSavedContent() { return import('./pages/SavedContent'); }
function loadMessages() { return import('./pages/Messages/Messages'); }
function loadChat() { return import('./pages/Messages/Chat'); }
function loadGroupChat() { return import('./pages/Messages/GroupChat'); }
function loadLiveStream() { return import('./pages/LiveStream'); }
function loadStatus() { return import('./pages/Status'); }

// Main App Router Component (inside AuthProvider)
function AppRouter() {
      const { isAuthenticated, user, token, loading } = useAuth();
      const hasActiveSession = Boolean(token);
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

      useEffect(() => {
            if (isAuthenticated && user?.role === 'admin') {
                  loadAdminDashboard();
            }
      }, [isAuthenticated, user?.role]);

      useEffect(() => {
            if (!isAuthenticated || !user?._id) return undefined;

            const scheduleIdle = typeof window !== 'undefined' && 'requestIdleCallback' in window
                  ? window.requestIdleCallback.bind(window)
                  : (callback) => window.setTimeout(callback, 900);
            const cancelIdle = typeof window !== 'undefined' && 'cancelIdleCallback' in window
                  ? window.cancelIdleCallback.bind(window)
                  : window.clearTimeout.bind(window);

            const jobId = scheduleIdle(async () => {
                  await Promise.allSettled([
                        loadProfile(),
                        loadSettings(),
                        loadMessages(),
                        loadChat(),
                        loadLiveStream(),
                        user?.role === 'admin' ? loadAdminDashboard() : Promise.resolve()
                  ]);

                  if (!token) return;

                  try {
                        const feedUrl = new URL(`${API_URL}/feed`);
                        feedUrl.searchParams.set('mode', 'all');
                        feedUrl.searchParams.set('limit', '12');

                        const encodedUsername = encodeURIComponent(user.username);
                        const headers = { Authorization: `Bearer ${token}` };

                        const [conversationsRes, streamsRes, feedRes, profileRes] = await Promise.all([
                              fetchWithTimeout(`${API_URL}/messages/conversations`, {
                                    headers
                              }, WARMUP_FETCH_MS),
                              fetchWithTimeout(`${API_URL}/livestream/active`, {}, WARMUP_FETCH_MS),
                              fetchWithTimeout(feedUrl.toString(), {
                                    headers
                              }, WARMUP_FETCH_MS),
                              fetchWithTimeout(`${API_URL}/users/${encodedUsername}?postsLimit=24`, {
                                    headers
                              }, WARMUP_FETCH_MS)
                        ]);

                        const [conversationsData, streamsData, feedData, profileData] = await Promise.all([
                              conversationsRes.json().catch(() => null),
                              streamsRes.json().catch(() => null),
                              feedRes.json().catch(() => null),
                              profileRes.json().catch(() => null)
                        ]);

                        if (conversationsData?.success) {
                              localStorage.setItem(
                                    `zuno_conversations_cache_${user._id}`,
                                    JSON.stringify(conversationsData.data.conversations || [])
                              );
                        }

                        if (streamsData?.success) {
                              localStorage.setItem(
                                    'zuno_live_streams_cache',
                                    JSON.stringify(streamsData.data.streams || [])
                              );
                        }

                        if (feedData?.success) {
                              localStorage.setItem(
                                    'zuno_feedCache_all',
                                    JSON.stringify(feedData.data.contents || [])
                              );
                        }

                        if (profileData?.success) {
                              localStorage.setItem(
                                    `zuno_profile_cache_${user.username}`,
                                    JSON.stringify(profileData.data.user || null)
                              );
                              localStorage.setItem(
                                    `zuno_posts_cache_${user.username}`,
                                    JSON.stringify(profileData.data.contents || [])
                              );
                        }
                  } catch {
                        // Warmup is best-effort only.
                  }
            });

            return () => cancelIdle(jobId);
      }, [isAuthenticated, token, user?._id, user?.role]);

      const handleSplashComplete = () => {
            // Mark splash as shown
            localStorage.setItem('zuno_splash_shown', 'true');
            localStorage.setItem('zuno_splash_time', Date.now().toString());
            setShowSplash(false);

            // Navigate if not already on a route and auth has finished restoring
            if (!loading && window.location.pathname === '/') {
                  if (isAuthenticated) navigate('/');
                  else navigate('/welcome');
            }
      };

      // Show splash screen
      if (showSplash) {
            return <SplashScreen onComplete={handleSplashComplete} />;
      }

      if (loading) {
            return <RouteSuspenseFallback />;
      }

      return (
            <>
                  <GlobalNotification />
                  <CallOverlay />
                  {/* Group Call Overlay handled via CallContext later, or we can render it conditionally here using CallContext state. For now, we will add the state to CallContext and let CallProvider render it, or we render it here consuming the context. Actually, let's keep GroupCallOverlay rendering inside App conditionally based on useCallContext state.*/}
                  <ToastContainer theme="colored" autoClose={4000} />
                  <Suspense fallback={<RouteSuspenseFallback />}>
                    <Routes>
                          {/* Welcome/Landing Page */}
                          <Route path="/welcome" element={!isAuthenticated ? <Landing /> : <Navigate to="/" replace />} />

                          {/* Auth routes - no layout */}
                          <Route path="/login" element={!hasActiveSession ? <Login /> : <Navigate to="/" replace />} />
                          <Route path="/register" element={!hasActiveSession ? <Register /> : <Navigate to="/" replace />} />
                          <Route path="/reset-password" element={<ResetPassword />} />

                          {/* Main routes with layout */}
                          <Route path="/" element={hasActiveSession ? <Layout /> : <Navigate to="/welcome" replace />}>
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
      return (
            <ThemeProvider>
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
            </ThemeProvider>
      );
}

export default App;
