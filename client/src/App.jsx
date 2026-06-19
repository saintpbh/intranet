import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import { AuthProvider } from './AuthContext';
import './index.css';
import './theme-glass.css';

import AppLayout from './components/AppLayout';
import HomePage from './components/HomePage';
import SearchPage from './components/SearchPage';
import MyInfoPage from './components/MyInfoPage';
import DocumentsPage from './components/mobile/DocumentsPage';
import PensionInsurancePage from './components/mobile/PensionInsurancePage';
import ChurchManagePage from './components/ChurchManagePage';

// 어드민 대용량 번들을 코드가 필요한 시점에만 동적으로 불러오도록 Code Splitting(코드 분할) 처리
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* Main app with bottom tab bar */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/documents" element={<PensionInsurancePage />} />
              <Route path="/cert-request" element={<DocumentsPage />} />
              <Route path="/church" element={<ChurchManagePage />} />
              <Route path="/directory" element={<SearchPage />} />
              <Route path="/profile" element={<MyInfoPage />} />
              
              {/* Legacy fallback routes mapping to new paths */}
              <Route path="/presbytery" element={<DocumentsPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/myinfo" element={<MyInfoPage />} />
              <Route path="/minister" element={<SearchPage />} />
              <Route path="/elder" element={<SearchPage />} />
            </Route>
            {/* Admin (no tab bar) - dynamic import with premium visual fallback */}
            <Route path="/admin" element={
              <Suspense fallback={
                <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-100 font-bold text-sm font-['Manrope','Pretendard']">
                  <div className="flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-[32px] text-indigo-400 animate-spin">sync</span>
                    <span>교회 어드민 관리 모듈 로드 중...</span>
                  </div>
                </div>
              }>
                <AdminLayout />
              </Suspense>
            } />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
