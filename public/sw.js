const CACHE_NAME = 'loan-tracker-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests and skip server actions / API calls / chrome-extension
  if (
    event.request.method !== 'GET' ||
    event.request.headers.get('accept')?.includes('text/x-component') ||
    event.request.url.includes('/api/') ||
    !event.request.url.startsWith(self.location.origin)
  ) {
    return;
  }

  // Network-first strategy for dynamic pages, falling back to cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful responses for static assets only
        if (
          networkResponse.status === 200 &&
          (event.request.url.includes('/_next/static/') ||
            event.request.url.includes('/icons/'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
