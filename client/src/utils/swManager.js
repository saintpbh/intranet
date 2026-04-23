/**
 * SW Update Manager
 * - SW 업데이트 감지 및 활성화
 * - 프로그레스 이벤트 (설치 → 활성화 → 완료)
 * - 오프라인 상태 감지
 * - 알림 권한 안내 트리거
 */

const listeners = new Set();

/** 상태 */
let state = {
  phase: 'idle',        // idle | checking | downloading | activating | done | error
  progress: 0,          // 0-100
  isOnline: navigator.onLine,
  needsRefresh: false,
  showNotifGuide: false, // 푸시 알림 안내 모달 표시
  version: null,
};

function notify() {
  const snapshot = { ...state };
  listeners.forEach((fn) => fn(snapshot));
}

export function subscribe(fn) {
  listeners.add(fn);
  fn({ ...state }); // 즉시 현재 상태 전달
  return () => listeners.delete(fn);
}

/** 오프라인/온라인 */
window.addEventListener('online', () => { state.isOnline = true; notify(); });
window.addEventListener('offline', () => { state.isOnline = false; notify(); });

/** 푸시 알림 안내 닫기 */
export function dismissNotifGuide() {
  state.showNotifGuide = false;
  localStorage.setItem('prok_notif_guided', String(Date.now()));
  notify();
}

/** SW 등록 및 업데이트 감지 */
export async function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');

    // 이미 활성 SW가 있고, 새 SW가 대기 중이면 → 업데이트 완료
    if (registration.waiting) {
      handleNewWorker(registration.waiting, registration);
    }

    // 새 SW 설치 감지
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      state.phase = 'downloading';
      state.progress = 30;
      notify();

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (registration.active) {
            // 기존 SW가 있었음 → 업데이트
            handleNewWorker(newWorker, registration);
          } else {
            // 최초 설치
            state.phase = 'done';
            state.progress = 100;
            notify();
            // 1초간 완료 표시 후 숨김
            setTimeout(() => {
              state.phase = 'idle';
              state.progress = 0;
              notify();
              checkFirstVisitGuide();
            }, 1200);
          }
        }
      });
    });

    // 주기적 업데이트 확인 (1시간마다)
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);

    // controllerchange → 실제 SW 교체 완료 시 페이지 갱신
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (state.needsRefresh) {
        state.needsRefresh = false;
        window.location.reload();
      }
    });

    // SW 메시지 수신 (오프라인 동기화 진행률 등)
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, progress: p } = event.data || {};
      if (type === 'SYNC_PROGRESS') {
        state.progress = p;
        notify();
      }
    });

    // 최초 방문 시 알림 가이드
    checkFirstVisitGuide();

  } catch (err) {
    console.error('[SWManager] Registration failed:', err);
    state.phase = 'error';
    notify();
  }
}

function handleNewWorker(worker, registration) {
  state.phase = 'activating';
  state.progress = 70;
  notify();

  // skipWaiting 메시지 전송 → SW가 즉시 활성화됨
  worker.postMessage({ type: 'SKIP_WAITING' });
  state.needsRefresh = true;

  // 프로그레스 애니메이션 (70 → 100)
  let p = 70;
  const interval = setInterval(() => {
    p = Math.min(p + 5, 100);
    state.progress = p;
    notify();
    if (p >= 100) {
      clearInterval(interval);
      state.phase = 'done';
      notify();
      setTimeout(() => {
        state.phase = 'idle';
        state.progress = 0;
        notify();
      }, 1200);
    }
  }, 100);
}

function checkFirstVisitGuide() {
  // Notification API가 없거나 이미 granted이면 skip
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') return;
  // 이미 FCM 토큰이 있으면 skip
  if (localStorage.getItem('fcm_token')) return;

  const guidedAt = localStorage.getItem('prok_notif_guided');
  if (guidedAt) {
    // 숫자가 아닌 '1'(구 형식)이면 → 7일 후 재안내 허용을 위해 현재 시각으로 갱신
    const ts = parseInt(guidedAt, 10);
    if (!isNaN(ts) && Date.now() - ts < 7 * 24 * 60 * 60 * 1000) {
      // 마지막 안내 후 7일이 안 지났으면 skip
      return;
    }
  }

  // 2초 후 안내 표시
  setTimeout(() => {
    state.showNotifGuide = true;
    notify();
  }, 2000);
}

/** 앱 캐시를 완전히 삭제하고 강제 새로고침하는 유틸 (수동 업데이트용) */
export async function forceAppUpdate() {
  try {
    // 1. 서비스 워커 제거
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    // 2. 브라우저 캐시 스토리지 제거 (SW 캐시 등)
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
    }
  } catch (err) {
    console.error('Failed to clear cache:', err);
  } finally {
    // 3. 페이지 새로고침
    window.location.reload(true);
  }
}

