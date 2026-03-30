import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import BottomTabBar from './BottomTabBar';

const AppLayout = () => {
  // Global back button guard: prevent exiting the PWA
  useEffect(() => {
    // Push an initial history entry so there's always somewhere to "go back" to
    window.history.pushState({ appRoot: true }, '');

    const handlePopState = (e) => {
      // If we hit the app root, push another entry to prevent exit
      // This creates an infinite "cushion" so the user can never back out
      window.history.pushState({ appRoot: true }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="app-shell">
      <div className="app-content-area">
        <Outlet />
      </div>
      <BottomTabBar />
    </div>
  );
};

export default AppLayout;
