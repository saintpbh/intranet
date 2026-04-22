import { useEffect, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import BottomTabBar from './BottomTabBar';
import PWAInstallPrompt from './PWAInstallPrompt';

const TAB_PATHS = ['/', '/documents', '/directory', '/profile'];

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Back-button guard: keeps users inside the app
  useEffect(() => {
    // Push a sentinel entry so there's always somewhere to go back to
    window.history.pushState({ pwaGuard: true }, '');

    const handlePopState = (e) => {
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

  return (
    <div className="app-shell pb-safe">
      <div className="app-content-area">
        <Outlet />
      </div>
      <BottomTabBar />
      <PWAInstallPrompt />
    </div>
  );
};

export default AppLayout;
