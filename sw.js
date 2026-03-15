const CACHE_NAME = 'wanderlost-cache-v30';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

async function startScan() {
    const locationPermModal = document.getElementById('location-permission-modal');
    const btnScan = document.getElementById('scan-btn');
    
    if (locationPermModal) locationPermModal.classList.add('hidden');
    if (btnScan) {
        btnScan.disabled = true;
        btnScan.innerHTML = '<i class="fa-solid fa-location-crosshairs fa-spin"></i> Getting GPS...';
    }
    
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            if (btnScan) btnScan.innerHTML = '<i class="fa-solid fa-filter fa-spin"></i> Analyzing Culture...';
            
            try {
                const response = await fetch('https://wanderlost-app.onrender.com/api/discover', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lat: latitude, lng: longitude })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    setTimeout(() => {
                        const node = {
                            id: Date.now(),
                            title: result.data.title,
                            desc: result.data.desc,
                            lat: result.data.lat,
                            lng: result.data.lng,
                            x: 30 + Math.random() * 40, 
                            y: 30 + Math.random() * 40,
                            status: 'active'
                        };
                        
                        state.nodes.push(node);
                        state.currentNodeIndex = state.nodes.length - 1;
                        
                        renderNodes();
                        showLocationDetails(node);
                        
                        if (btnScan) {
                            btnScan.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Initiate Scan';
                            btnScan.disabled = false;
                        }
                    }, 1800);
                } else {
                    alert(result.message || "No local gems found nearby.");
                    if (btnScan) {
                        btnScan.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Initiate Scan';
                        btnScan.disabled = false;
                    }
                }
            } catch (err) {
                console.error(err);
                if (btnScan) {
                    btnScan.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Initiate Scan';
                    btnScan.disabled = false;
                }
            }
        }, (error) => {
            alert("Local scan failed. Please enable location services.");
            if (btnScan) {
                btnScan.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Initiate Scan';
                btnScan.disabled = false;
            }
        });
    }
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  clients.claim();
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
  // Network-first strategy: always try to get fresh content, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache the fresh response for offline
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => {
        // Network failed, serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/wanderlost-app/index.html');
          }
        });
      })
  );
});
