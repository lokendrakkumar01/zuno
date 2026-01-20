import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import Search from './pages/Search/Search';
import SavedContent from './pages/SavedContent';

// Main App Router Component (inside AuthProvider)
function AppRouter() {
      const { isAuthenticated, loading } = useAuth();
      const [showSplash, setShowSplash] = useState(true);
      const navigate = useNavigate();

      useEffect(() => {
            // Check if splash has been shown this session
            const splashShown = sessionStorage.getItem('zuno_splash_shown');

            if (splashShown === 'true') {
                  setShowSplash(false);
            }
      }, []);

      const handleSplashComplete = () => {
            // Mark splash as shown for this session
            sessionStorage.setItem('zuno_splash_shown', 'true');
            setShowSplash(false);

            // Route based on authentication status
            if (!loading) {
                  if (isAuthenticated) {
                        navigate('/');
                  } else {
                        navigate('/login');
                  }
            }
      };

      // Show splash screen
      if (showSplash) {
            return <SplashScreen onComplete={handleSplashComplete} />;
      }

      return (
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
                        <Route path="search" element={<Search />} />
                        <Route path="content/:id" element={<ContentView />} />
                        <Route path="content/saved" element={<SavedContent />} />
                        <Route path="u/:username" element={<Profile />} />
                  </Route>

                  {/* Admin routes */}
                  <Route path="/admin/*" element={<AdminDashboard />} />
            </Routes>
      );
}

function App() {
      // Initialize theme on app load
      useEffect(() => {
            const savedTheme = localStorage.getItem('theme') || 'dark';
            document.documentElement.setAttribute('data-theme', savedTheme);
      }, []);

      return (
            <AuthProvider>
                  <Router>
                        <AppRouter />
                  </Router>
            </AuthProvider>
      );
}

export default App;
