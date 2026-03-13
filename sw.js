const CACHE_NAME = 'wanderlost-cache-v3';
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
