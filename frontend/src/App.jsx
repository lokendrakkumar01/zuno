import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
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

function App() {
      return (
            <AuthProvider>
                  <Router>
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
                  </Router>
            </AuthProvider>
      );
}

export default App;
