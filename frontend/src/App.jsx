import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketContextProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import { LanguageProvider } from './context/LanguageContext';
import { MusicProvider } from './context/MusicContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import all pages directly (no lazy loading)
import Landing from './pages/Landing';
import Home from './pages/Home';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ResetPassword from './pages/Auth/ResetPassword';
import Upload from './pages/Upload/Upload';
import Profile from './pages/Profile';
import ContentView from './pages/ContentView';
import AdminLogin from './pages/Admin/AdminLogin';
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
import LiveStream from './pages/LiveStream';
import Status from './pages/Status';

import SplashScreen from './components/SplashScreen';
import RouteSuspenseFallback from './components/RouteSuspenseFallback';
import Layout from './components/Layout/Layout';
import GlobalNotification from './components/GlobalNotification';
import CallOverlay from './components/CallOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import { API_URL } from './config';

// Simple App Router
function AppRouter() {
  const { isAuthenticated, user, token, loading } = useAuth();
  const hasActiveSession = Boolean(token);
  const navigate = useNavigate();

  // Show loading while auth is initializing
  if (loading) {
    return <RouteSuspenseFallback />;
  }

  return (
    <>
      <GlobalNotification />
      <CallOverlay />
      <ToastContainer theme="colored" autoClose={4000} />
      
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
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
      </Routes>
    </>
  );
}

// Main App Component
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
