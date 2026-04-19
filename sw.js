/* ═══════════════════════════════════════════════════════════════════════════
   WANDERLOST v4 — SERVICE WORKER
   Network-first for API calls. Cache-first for static assets.
   ═══════════════════════════════════════════════════════════════════════════ */

const CACHE_NAME   = 'wanderlost-v4';
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/css/tokens.css',
  '/css/reset.css',
  '/css/shell.css',
  '/css/components.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/discovery.js',
  '/js/firebase-config.js',
  '/js/gesture.js',
  '/js/map.js',
  '/js/router.js',
  '/js/shell.js',
  '/manifest.json',
  '/icons/logo.png',
  '/icons/splash-logo.png',
];

/* ── Install: pre-cache static assets ────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_CACHE))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Cache install failed:', err))
  );
});

/* ── Activate: clear old caches ──────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: network-first with cache fallback ─────────────────────────── */
self.addEventListener('fetch', event => {
  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isLocal = url.origin === self.location.origin;
  const isFont  = url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com');

  if (!isLocal && !isFont) return; // Let Google Maps API requests pass through

  event.respondWith(
    fetch(event.request)
      .then(res => {
        // Cache successful GET responses to same-origin requests
        if (res.ok && isLocal) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
