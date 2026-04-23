/* Service Worker v3 - PROK (기장주소록) PWA + FCM Push + Offline API Cache */
const CACHE_VERSION = 'v3';
const STATIC_CACHE = `prok-static-${CACHE_VERSION}`;
const API_CACHE = `prok-api-${CACHE_VERSION}`;
const PRECACHE_URLS = ['/', '/index.html'];

/* ---------- Firebase Messaging (Background Push) ---------- */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDB-_3hjGaS26UuTzntUJd9wVXp4qqGb1g",
  authDomain: "prok-ga.firebaseapp.com",
  projectId: "prok-ga",
  storageBucket: "prok-ga.firebasestorage.app",
  messagingSenderId: "113328278738",
  appId: "1:113328278738:web:bf2e4e0ff5a96e30cc710b"
});

const bgMessaging = firebase.messaging();

bgMessaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);
  if (payload.data && !payload.notification) {
    const { title, body, notice_id, icon } = payload.data;
    self.registration.showNotification(title || '기장주소록 알림', {
      body: body || '',
      icon: icon || '/assets/pwa-192x192.png',
      badge: '/assets/pwa-192x192.png',
      tag: `notice-${notice_id || 'general'}`,
      data: { url: `/?notice=${notice_id || ''}`, notice_id },
      vibrate: [200, 100, 200],
      requireInteraction: true
    });
  }
});

/* ---------- Push Event (fallback) ---------- */
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload.fcmMessageId) return;
      const data = payload.data || payload;
      event.waitUntil(
        self.registration.showNotification(data.title || '기장주소록', {
          body: data.body || '',
          icon: '/assets/pwa-192x192.png',
          badge: '/assets/pwa-192x192.png',
          tag: `notice-${data.notice_id || 'general'}`,
          data: { url: `/?notice=${data.notice_id || ''}` },
          vibrate: [200, 100, 200]
        })
      );
    } catch (e) {
      event.waitUntil(
        self.registration.showNotification('기장주소록', {
          body: event.data.text(),
          icon: '/assets/pwa-192x192.png'
        })
      );
    }
  }
});

/* ---------- Notification Click → Deep Link ---------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlPath = event.notification.data?.url || '/';
  const fullUrl = new URL(urlPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          client.focus();
          client.navigate(fullUrl);
          return;
        }
      }
      return clients.openWindow(fullUrl);
    })
  );
});

/* ---------- Message Handler (SKIP_WAITING from swManager) ---------- */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ---------- Install ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // 새 SW가 설치되면 skipWaiting 하지 않음 — swManager가 제어
  // self.skipWaiting() 은 message 이벤트에서 처리
});

/* ---------- Activate ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ---------- Fetch ---------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // ── API 요청: network-first + 캐시 폴백 (오프라인 지원) ──
  if (url.pathname.startsWith('/api/')) {
    // FCM 구독/테스트 API는 캐시하지 않음
    if (url.pathname.includes('/fcm/')) return;

    event.respondWith(
      fetch(request)
        .then((response) => {
          // 성공한 API 응답을 캐시에 저장
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // 네트워크 실패 → 캐시에서 응답
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // 캐시도 없으면 오프라인 JSON 응답
            return new Response(
              JSON.stringify({ error: 'offline', message: '오프라인 상태입니다. 캐시된 데이터가 없습니다.' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // ── Navigation → network-first ──
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // ── Static assets → cache-first ──
  if (request.url.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff2?|ttf|eot)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!request.url.startsWith('http')) return response;
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }
});
