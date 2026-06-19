import { useEffect, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import BottomTabBar from './BottomTabBar';
import PWAInstallPrompt from './PWAInstallPrompt';
import UpdateBar from './UpdateBar';
import OfflineIndicator from './OfflineIndicator';
import { initServiceWorker } from '../utils/swManager';
import { useDirectorySync } from '../hooks/useDirectorySync';
import { useSessionHeartbeat } from '../hooks/useSessionHeartbeat';
import { useAuth } from '../AuthContext';
import SimpleLogin from './SimpleLogin';

const TAB_PATHS = ['/', '/documents', '/church', '/directory', '/profile'];

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();

  // Initialize background directory sync (runs only if logged in)
  useDirectorySync(isLoggedIn);

  // Session heartbeat for real-time monitoring
  useSessionHeartbeat(user);

  // SW 초기화 (swManager가 업데이트 감지/프로그레스 관리)
  useEffect(() => {
    initServiceWorker();
  }, []);

  // Back-button guard: keeps users inside the app
  useEffect(() => {
    // Push a sentinel entry so there's always somewhere to go back to
    window.history.pushState({ pwaGuard: true }, '');

    const handlePopState = (e) => {
      // If a subview (like Pension Status, notices, etc.) is active,
      // let its own useBackButton hook handle the popstate.
      if (window.__isSubViewActive) {
        return;
      }

      const currentPath = window.location.pathname;

      // If we're on a sub-page (not a main tab), go to its parent tab
      if (!TAB_PATHS.includes(currentPath)) {
        // Navigate to the most logical parent
        if (currentPath.startsWith('/admin')) {
          navigate('/', { replace: true });
        } else {
          navigate(-1);
        }
        // Re-push the guard
        window.history.pushState({ pwaGuard: true }, '');
        return;
      }

      // If on a main tab that is NOT home, go to home
      if (currentPath !== '/') {
        navigate('/', { replace: true });
        window.history.pushState({ pwaGuard: true }, '');
        return;
      }

      // Already on home — just block exit by re-pushing guard
      window.history.pushState({ pwaGuard: true }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  // Push a new history entry on every internal navigation so back-button
  // inside the app is functional (tab → tab tracking)
  useEffect(() => {
    window.history.pushState({ pwaGuard: true, path: location.pathname }, '');
  }, [location.pathname]);

  // 첫 접속 시 로그인하지 않은 사용자는 다른 어떤 화면이나 메뉴도 보지 못하도록 강제 인증 차단막 작동
  if (!isLoggedIn) {
    return <SimpleLogin />;
  }

  return (
    <div className="app-shell pb-safe">
      <UpdateBar />
      <OfflineIndicator />
      <div className="app-content-area">
        <Outlet />
      </div>
      <BottomTabBar />
      <PWAInstallPrompt />
    </div>
  );
};

export default AppLayout;

