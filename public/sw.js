// 최소 service worker - PWA 인식용 (오프라인 캐싱 없음)
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // 네트워크 통과 (기본 동작)
});
