import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketContextProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import { LanguageProvider } from './context/LanguageContext';
import { MusicProvider } from './context/MusicContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout/Layout';
import GlobalNotification from './components/GlobalNotification';
import CallOverlay from './components/CallOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import RouteSuspenseFallback from './components/RouteSuspenseFallback';
import { API_URL } from './config';

const Landing = lazy(() => import('./pages/Landing'));
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Auth/Login'));
const Register = lazy(() => import('./pages/Auth/Register'));
const VerifyEmail = lazy(() => import('./pages/Auth/VerifyEmail'));
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword'));
const Upload = lazy(() => import('./pages/Upload/Upload'));
const Profile = lazy(() => import('./pages/Profile'));
const ProfileById = lazy(() => import('./pages/ProfileById'));
const ContentView = lazy(() => import('./pages/ContentView'));
const AdminLogin = lazy(() => import('./pages/Admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const Settings = lazy(() => import('./pages/Settings/Settings'));
const Appearance = lazy(() => import('./pages/Settings/Appearance'));
const Privacy = lazy(() => import('./pages/Settings/Privacy'));
const Language = lazy(() => import('./pages/Settings/Language'));
const Notifications = lazy(() => import('./pages/Settings/Notifications'));
const TimeManagement = lazy(() => import('./pages/Settings/TimeManagement'));
const PasswordSecurity = lazy(() => import('./pages/Settings/PasswordSecurity'));
const CloseFriends = lazy(() => import('./pages/Settings/CloseFriends'));
const Activity = lazy(() => import('./pages/Settings/Activity'));
const ScheduledContent = lazy(() => import('./pages/Settings/ScheduledContent'));
const Insights = lazy(() => import('./pages/Settings/Insights'));
const Search = lazy(() => import('./pages/Search/Search'));
const Music = lazy(() => import('./pages/Music'));
const SavedContent = lazy(() => import('./pages/SavedContent'));
const MessagesLayout = lazy(() => import('./pages/Messages/MessagesLayout'));
const Chat = lazy(() => import('./pages/Chat'));
const GroupChat = lazy(() => import('./pages/Messages/GroupChat'));
const LiveStream = lazy(() => import('./pages/LiveStream'));
const Status = lazy(() => import('./pages/Status'));

function AppRouter() {
  const { isAuthenticated, token, loading } = useAuth();
  const queryClient = useQueryClient();
  const hasActiveSession = Boolean(token) || isAuthenticated;

  React.useEffect(() => {
    if (!hasActiveSession || !token) return;
    queryClient.prefetchQuery({
      queryKey: ['conversations'],
      staleTime: 60_000,
      queryFn: async () => {
        const res = await fetch(`${API_URL}/conversations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(data?.message || 'Could not load conversations.');
        return data.data?.conversations || data.conversations || [];
      }
    });
  }, [hasActiveSession, queryClient, token]);

  if (loading) return <RouteSuspenseFallback />;

  return (
    <>
      <GlobalNotification />
      <CallOverlay />
      <ToastContainer theme="colored" autoClose={4000} />
      <Suspense fallback={<RouteSuspenseFallback />}>
        <Routes>
          <Route path="/welcome" element={!hasActiveSession ? <Landing /> : <Navigate to="/" replace />} />
          <Route path="/login" element={!hasActiveSession ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/register" element={!hasActiveSession ? <Register /> : <Navigate to="/" replace />} />
          <Route path="/verify-email" element={!hasActiveSession ? <VerifyEmail /> : <Navigate to="/" replace />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={hasActiveSession ? <Layout /> : <Navigate to="/welcome" replace />}>
            <Route index element={<Home />} />
            <Route path="upload" element={<Upload />} />
            <Route path="profile" element={<Profile />} />
            <Route path="profile/:userId" element={<ProfileById />} />
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
            <Route path="music" element={<Music />} />
            <Route path="messages" element={<MessagesLayout />}>
              <Route index element={null} />
              <Route path="group/:groupId" element={<GroupChat />} />
              <Route path=":userId" element={<Chat />} />
            </Route>
            <Route path="chat/:userId" element={<Chat />} />
            <Route path="live/:hostId?" element={<LiveStream />} />
            <Route path="saved" element={<SavedContent />} />
            <Route path="content/saved" element={<SavedContent />} />
            <Route path="content/:id" element={<ContentView />} />
            <Route path="u/:username" element={<Profile />} />
          </Route>
          <Route path="/admin/login" element={<AdminLogin />} />
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
