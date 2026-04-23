/**
 * Firebase 초기화 및 FCM (Firebase Cloud Messaging) 설정
 * - FCM 토큰 발급 및 토픽 구독
 * - 포그라운드 메시지 수신 처리
 */
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// prok-ga 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyDB-_3hjGaS26UuTzntUJd9wVXp4qqGb1g",
  authDomain: "prok-ga.firebaseapp.com",
  projectId: "prok-ga",
  storageBucket: "prok-ga.firebasestorage.app",
  messagingSenderId: "113328278738",
  appId: "1:113328278738:web:bf2e4e0ff5a96e30cc710b",
  measurementId: "G-N48K9ZHJE1"
};

const app = initializeApp(firebaseConfig);

let messaging = null;
try {
  messaging = getMessaging(app);
} catch (err) {
  console.warn('[FCM] Messaging not supported in this browser:', err.message);
}

/**
 * FCM 알림 권한 요청 및 토큰 발급
 * @param {string} apiBase - API 서버 베이스 URL
 * @param {object} userData - 개별 알림 대상을 위한 사용자 정보
 * @returns {string|null} FCM 토큰 또는 null
 */
export async function requestNotificationPermission(apiBase = '', userData = null) {
  if (!messaging) {
    console.warn('[FCM] Messaging not available');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM] Notification permission denied');
      return null;
    }

    const VAPID_KEY = 'BKAUPz_sCHLy8_HKgkx2DjJpxNixmNG99TbtoYQGBEz1UonPBJjH7pcBOVqXJbM1MgtU_WEMec7eQkhinHWtRNY';
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.getRegistration()
    });

    if (token) {
      console.log('[FCM] Token obtained:', token.substring(0, 20) + '...');
      
      // 서버에 토큰을 보내서 "all_users" 토픽에 구독
      try {
        const response = await fetch(`${apiBase}/api/fcm/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, topic: 'all_users' })
        });
        const result = await response.json();
        if (result.success) {
          console.log('[FCM] Subscribed to all_users topic');
          // 로컬에 토큰 저장 (중복 구독 방지)
          localStorage.setItem('fcm_token', token);
        }
      } catch (err) {
        console.error('[FCM] Subscribe API failed:', err);
      }

      // 개별 사용자 정보를 등록하여 타겟팅 푸시 활성화
      if (userData && userData.code) {
        try {
          const pushRes = await fetch(`${apiBase}/api/push/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              minister_code: userData.code,
              minister_name: userData.name || '',
              noh_code: userData.nohCode || '',
              sichal_code: userData.chrCode || '',
              push_token: token,
              device_info: navigator.userAgent
            })
          });
          const pushData = await pushRes.json();
          if (pushData.success) {
            console.log('[FCM] Subscribed user individual push DB');
          }
        } catch (err) {
          console.error('[FCM] User Push DB subscribe failed:', err);
        }
      }

      return token;
    }
  } catch (err) {
    console.error('[FCM] Token request failed:', err);
  }

  return null;
}

/**
 * 이미 토큰이 등록되어 있는지 확인
 */
export function isTokenRegistered() {
  return !!localStorage.getItem('fcm_token');
}

/**
 * 포그라운드에서 메시지 수신 시 콜백 등록
 * @param {function} callback - 메시지 수신 콜백 (payload) => void
 */
export function onForegroundMessage(callback) {
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    console.log('[FCM] Foreground message:', payload);
    callback(payload);
  });
}

export { app, messaging };
