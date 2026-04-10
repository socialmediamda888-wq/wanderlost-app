const CACHE_NAME = 'wanderlost-v1';
const STATIC_ASSETS = [
  '/wanderlost-app/',
  '/wanderlost-app/index.html',
  '/wanderlost-app/app.js',
  '/wanderlost-app/style.css',
  '/wanderlost-app/manifest.json',
  '/wanderlost-app/icons/icon-192.png',
  '/wanderlost-app/icons/icon-512.png',
];

// Install: pre-cache static assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API calls, cache-first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always fetch Google Maps API from the network
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com') || url.hostname.includes('google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        return response;
      });
    }).catch(() => caches.match('/wanderlost-app/index.html'))
  );
});
