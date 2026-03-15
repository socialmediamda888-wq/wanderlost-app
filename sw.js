const CACHE_NAME = 'wanderlost-cache-v21';
const urlsToCache = [
  '/wanderlost-app/',
  '/wanderlost-app/index.html',
  '/wanderlost-app/style.css',
  '/wanderlost-app/app.js',
  '/wanderlost-app/manifest.json',
  '/wanderlost-app/icon-192.png',
  '/wanderlost-app/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // If both cache and network fail, fall back to index if it's a navigation request
          if (event.request.mode === 'navigate') {
            return caches.match('/wanderlost-app/index.html');
          }
        });
      })
  );
});
