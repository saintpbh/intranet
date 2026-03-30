import { useEffect, useRef } from 'react';

/**
 * Custom hook for handling Android hardware back button in PWA.
 * When a sub-view becomes active, pushes a marker to history.
 * On popstate, if active, calls onBack to close the sub-view
 * and re-pushes the app-root guard so the user can never exit.
 */
export const useBackButton = (isActive, onBack) => {
  const isActiveRef = useRef(isActive);
  const onBackRef = useRef(onBack);
  const pushedRef = useRef(false);

  useEffect(() => {
    isActiveRef.current = isActive;
    onBackRef.current = onBack;
  }, [isActive, onBack]);

  useEffect(() => {
    if (isActive && !pushedRef.current) {
      // Push a sub-view entry
      window.history.pushState({ subView: true }, '');
      pushedRef.current = true;
    }
    if (!isActive) {
      pushedRef.current = false;
    }
  }, [isActive]);

  useEffect(() => {
    const handlePopState = () => {
      if (isActiveRef.current) {
        onBackRef.current();
        // Re-push guard so AppLayout's handler doesn't also fire
        pushedRef.current = false;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
};
