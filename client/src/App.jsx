import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import { AuthProvider } from './AuthContext';
import './index.css';
import './theme-glass.css';

import AppLayout from './components/AppLayout';
import HomePage from './components/HomePage';
import SearchPage from './components/SearchPage';
import MyInfoPage from './components/MyInfoPage';
import AdminLayout from './components/admin/AdminLayout';
import DocumentsPage from './components/mobile/DocumentsPage';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* Main app with bottom tab bar */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/directory" element={<SearchPage />} />
              <Route path="/profile" element={<MyInfoPage />} />
              
              {/* Legacy fallback routes mapping to new paths */}
              <Route path="/presbytery" element={<DocumentsPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/myinfo" element={<MyInfoPage />} />
              <Route path="/minister" element={<SearchPage />} />
              <Route path="/elder" element={<SearchPage />} />
            </Route>
            {/* Admin (no tab bar) */}
            <Route path="/admin" element={<AdminLayout />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
