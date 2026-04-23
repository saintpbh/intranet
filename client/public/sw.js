/* Service Worker - PROK (기장주소록) PWA + FCM Push */
const CACHE_NAME = 'prok-intranet-v2';
const PRECACHE_URLS = ['/', '/index.html'];

/* ---------- Firebase Messaging (Background Push) ---------- */

// Firebase SDK for background messaging
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

// Background message handler — Firebase SDK가 자동으로 notification 표시
// data-only 메시지의 경우 직접 처리
bgMessaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);
  
  // data-only 메시지인 경우 수동 알림 표시
  if (payload.data && !payload.notification) {
    const { title, body, notice_id, icon } = payload.data;
    self.registration.showNotification(title || '기장주소록 알림', {
      body: body || '',
      icon: icon || '/assets/pwa-192x192.png',
      badge: '/assets/pwa-192x192.png',
      tag: `notice-${notice_id || 'general'}`,
      data: { 
        url: `/?notice=${notice_id || ''}`,
        notice_id: notice_id 
      },
      vibrate: [200, 100, 200],
      requireInteraction: true
    });
  }
});

/* ---------- Push Event (fallback for non-Firebase push) ---------- */
self.addEventListener('push', (event) => {
  // Firebase SDK가 처리하지 않은 push만 여기서 처리
  if (event.data) {
    try {
      const payload = event.data.json();
      // Firebase가 이미 처리했으면 skip
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
      // text push
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
      // 이미 열린 앱 창이 있으면 포커스 + URL 이동
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          client.focus();
          client.navigate(fullUrl);
          return;
        }
      }
      // 열린 창이 없으면 새 창 열기
      return clients.openWindow(fullUrl);
    })
  );
});

/* ---------- Install / Activate / Fetch (기존 PWA 로직) ---------- */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET and API requests
  if (request.method !== 'GET' || request.url.includes('/api/')) return;

  // Navigation requests → network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets → cache-first
  if (request.url.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff2?|ttf|eot)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!request.url.startsWith('http')) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }
});
