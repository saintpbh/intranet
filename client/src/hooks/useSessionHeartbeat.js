import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import API_BASE from '../api';

/**
 * useSessionHeartbeat
 * Sends a heartbeat to the server every 30s so the System Admin tab
 * can show real-time active users.
 * 
 * The session_id is generated once per browser tab and persisted
 * in sessionStorage so page reloads reuse the same ID.
 */
const getSessionId = () => {
  let sid = sessionStorage.getItem('prok_session_id');
  if (!sid) {
    sid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('prok_session_id', sid);
  }
  return sid;
};

const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Mac/i.test(ua)) return 'Mac';
  return 'Other';
};

export function useSessionHeartbeat(user) {
  const location = useLocation();
  const timerRef = useRef(null);
  const sessionId = useRef(getSessionId());

  useEffect(() => {
    const sendHeartbeat = () => {
      // Don't send heartbeats if the server URL is not available
      if (!API_BASE && window.location.hostname !== 'localhost') return;

      const body = {
        session_id: sessionId.current,
        minister_code: user?.code || '',
        minister_name: user?.name || '',
        page: location.pathname,
        device_info: getDeviceInfo(),
      };

      fetch(`${API_BASE}/api/system/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => { /* silently ignore heartbeat failures */ });
    };

    // Send immediately on mount and page change
    sendHeartbeat();

    // Then every 30 seconds
    timerRef.current = setInterval(sendHeartbeat, 30000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user?.code, user?.name, location.pathname]);
}
