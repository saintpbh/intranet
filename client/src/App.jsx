import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import { AuthProvider } from './AuthContext';
import './index.css';
import './theme-glass.css';

import AppLayout from './components/AppLayout';
import HomePage from './components/HomePage';
import PresbyterPage from './components/PresbyterPage';
import SearchPage from './components/SearchPage';
import MyInfoPage from './components/MyInfoPage';
import AdminLayout from './components/admin/AdminLayout';

// Legacy routes kept for backward compatibility
import MinisterApp from './components/MinisterApp';
import ElderApp from './components/ElderApp';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* Main app with bottom tab bar */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/presbytery" element={<PresbyterPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/myinfo" element={<MyInfoPage />} />
              {/* Legacy routes */}
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
