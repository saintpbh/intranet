import { useState, useEffect, useRef } from 'react';
import API_BASE from '../api';

/**
 * OfflineIndicator — detects two scenarios:
 * 1. Browser completely offline (navigator.onLine === false)
 * 2. API server unreachable (ngrok tunnel down, server stopped, CORS block)
 *
 * Shows a floating banner at the bottom so the user knows what's happening
 * without breaking the rest of the UI.
 */
const OfflineIndicator = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isServerDown, setIsServerDown] = useState(false);
  const checkTimerRef = useRef(null);
  const failCountRef = useRef(0);

  // ── Browser online/offline events ──
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── API server health check ──
  useEffect(() => {
    // Only meaningful if we have an external API URL (production)
    if (!API_BASE) {
      return;
    }

    const checkServer = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${API_BASE}/api/system/heartbeat`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          failCountRef.current = 0;
          setIsServerDown(false);
        } else {
          failCountRef.current++;
          if (failCountRef.current >= 2) setIsServerDown(true);
        }
      } catch {
        failCountRef.current++;
        // After 2 consecutive failures, show the banner
        if (failCountRef.current >= 2) setIsServerDown(true);
      }
    };

    // Listen for fetch interceptor failures
    const handleApiError = () => {
      failCountRef.current++;
      if (failCountRef.current >= 2) setIsServerDown(true);
    };
    window.addEventListener('api-connection-error', handleApiError);

    // Initial check after a short delay (give page time to load)
    const initialDelay = setTimeout(checkServer, 3000);

    // Periodic check every 30s
    checkTimerRef.current = setInterval(checkServer, 30000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(checkTimerRef.current);
      window.removeEventListener('api-connection-error', handleApiError);
    };
  }, []);

  // Determine what to show
  const showBanner = isOffline || isServerDown;
  const message = isOffline
    ? '오프라인 모드 — 인터넷 연결을 확인하세요'
    : isServerDown
      ? '새로운 데이터 베이스로 연결중입니다.... (시간이 필요합니다)'
      : '';
  const icon = isOffline ? 'wifi_off' : 'cloud_off';
  const bgColor = isOffline ? '#ef4444' : '#f59e0b';

  if (!showBanner) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: bgColor,
      color: '#ffffff',
      padding: '10px 20px',
      borderRadius: '24px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      zIndex: 9999,
      fontWeight: '600',
      fontSize: '0.85rem',
      fontFamily: "'Plus Jakarta Sans', 'Pretendard', sans-serif",
      animation: 'offlineSlideUp 0.3s ease-out',
      whiteSpace: 'nowrap',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
      {message}
      <style>{`
        @keyframes offlineSlideUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
};

export default OfflineIndicator;
