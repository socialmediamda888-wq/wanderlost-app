/* ═══════════ WANDERLOST APP ENGINE ═══════════ */

const MAP_ID = 'fbb4c31d8d7ddda1d4548f5f';
const CATEGORIES = [
  { id:'restaurant', name:'Restaurants', icon:'restaurant' },
  { id:'meal_takeaway', name:'Take-away', icon:'takeout_dining' },
  { id:'cafe', name:'Cafes', icon:'coffee' },
  { id:'bakery', name:'Bakeries', icon:'bakery_dining' },
  { id:'bar', name:'Bars', icon:'local_bar' },
  { id:'park', name:'Parks', icon:'park' },
  { id:'library', name:'Libraries', icon:'local_library' },
  { id:'book_store', name:'Bookstores', icon:'menu_book' },
  { id:'museum', name:'Museums', icon:'museum' },
  { id:'art_gallery', name:'Galleries', icon:'palette' },
  { id:'grocery_or_supermarket', name:'Markets', icon:'shopping_bag' },
  { id:'tourist_attraction', name:'Viewpoints', icon:'visibility' },
  { id:'store', name:'Artisan Workshops', icon:'handyman' },
];

const MAP_STYLE_LIGHT = [
  { elementType:'geometry', stylers:[{color:'#f2f2f0'}] },
  { elementType:'labels.icon', stylers:[{visibility:'off'}] },
  { elementType:'labels.text.fill', stylers:[{color:'#8c8c8c'}] },
  { elementType:'labels.text.stroke', stylers:[{color:'#f5f5f5'}] },
  { featureType:'poi', stylers:[{visibility:'off'}] },
  { featureType:'road', elementType:'geometry', stylers:[{color:'#fff'}] },
  { featureType:'road', elementType:'labels', stylers:[{visibility:'off'}] },
  { featureType:'transit', stylers:[{visibility:'off'}] },
  { featureType:'water', elementType:'geometry', stylers:[{color:'#c8d0d8'}] },
  { featureType:'administrative.land_parcel', elementType:'labels', stylers:[{visibility:'off'}] },
];

// ── State ──
let state = {
  page: 'map',
  credits: 3,
  isPremium: false,
  user: null,
  authTab: 'login',
  activeCategory: 'restaurant',
  currentPlace: null,
  savedPlaces: [],
  history: [],
  itinerary: [],
  userLocation: null,
  searchCenter: null,
  _geoResolved: false,
  distanceUnit: 'meters',
  theme: 'light',
  selectedPlan: 'annual',
  discoveredMarkers: [],
};

let gmap, placesService, userMarker, poiMarkers = [];

// ── Haversine ──
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*r) * Math.cos(lat2*r) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function formatDist(km) {
  if (state.distanceUnit === 'feet') {
    const ft = km * 3280.84;
    return ft < 5280 ? Math.round(ft) + ' ft' : (ft / 5280).toFixed(1) + ' mi';
  }
  return km < 1 ? Math.round(km * 1000) + 'm' : km.toFixed(1) + 'km';
}
// Manual check if place is open from periods array (fallback when isOpen() throws)
function checkOpenFromPeriods(periods) {
  if (!periods || periods.length === 0) return null;
  // If only one period with no close → open 24/7
  if (periods.length === 1 && periods[0].open && !periods[0].close) return true;
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const time = now.getHours() * 100 + now.getMinutes();
  for (const period of periods) {
    if (!period.open || !period.close) continue;
    if (period.open.day === day) {
      const openTime = (period.open.hours || 0) * 100 + (period.open.minutes || 0);
      const closeDay = period.close.day;
      const closeTime = (period.close.hours || 0) * 100 + (period.close.minutes || 0);
      if (closeDay === day && time >= openTime && time < closeTime) return true;
      if (closeDay !== day && time >= openTime) return true; // closes next day
    }
  }
  return false;
}

// ── Navigation ──
function navigateTo(page) {
  state.page = page;
  renderPage();
  updateNav();
}
function updateNav() {
  document.querySelectorAll('.nav-btn').forEach(b => {
    if (b.dataset.nav === state.page) {
      b.classList.remove('text-on-surface-variant');
      b.classList.add('text-primary');
      b.querySelector('span:first-child').style.fontVariationSettings = "'FILL' 1";
    } else {
      b.classList.add('text-on-surface-variant');
      b.classList.remove('text-primary');
      b.querySelector('span:first-child').style.fontVariationSettings = "'FILL' 0";
    }
  });
  const topbar = document.getElementById('topbar');
  topbar.style.display = state.page === 'checkout' ? 'none' : '';
  const bottomnav = document.getElementById('bottomnav');
  bottomnav.style.display = ['checkout','settings'].includes(state.page) ? 'none' : '';
}
function updateCredits() {
  const el = document.getElementById('credits-text');
  if (!el) return;
  if (state.isPremium) { el.textContent = 'Premium Active'; return; }
  el.textContent = `${state.credits} Free ${state.credits === 1 ? 'Discovery' : 'Discoveries'}`;
  if (state.credits <= 0) el.style.color = '#9f403d';
}

// ── Map Init ──
let _mapsReadyFlag = false;
let _windowLoadedFlag = false;

function checkAppReady() {
  if (_mapsReadyFlag && _windowLoadedFlag) {
    // Slight delay to ensure Tailwind JIT has fully applied styles
    setTimeout(() => {
      const splash = document.getElementById('splash');
      const app = document.getElementById('app');
      if (splash) splash.classList.add('hidden');
      if (app) app.classList.add('ready');
      setTimeout(() => { if (splash) splash.remove(); }, 500);
    }, 150);
  }
}

window.addEventListener('load', () => {
  _windowLoadedFlag = true;
  checkAppReady();
});

function onMapsReady() {
  if (state.page === 'map') {
    initMap();
  } else {
    _mapsReadyFlag = true;
    checkAppReady();
  }
}
function initMap() {
  const container = document.getElementById('gmap');
  if (!container) return;
  const fallbackCenter = { lat: 48.8566, lng: 2.3522 };
  const center = state.userLocation || fallbackCenter;
  state.searchCenter = center;
  gmap = new google.maps.Map(document.getElementById('gmap'), {
    center, zoom: state.userLocation ? 15 : 3, mapId: MAP_ID,
    disableDefaultUI: true, gestureHandling: 'greedy',
    styles: MAP_STYLE_LIGHT,
  });
  
  google.maps.event.addListenerOnce(gmap, 'tilesloaded', () => {
    _mapsReadyFlag = true;
    checkAppReady();
  });

  placesService = new google.maps.places.PlacesService(gmap);

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    const autocomplete = new google.maps.places.Autocomplete(searchInput, { types: ['(cities)'] });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        state.searchCenter = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
        gmap.panTo(state.searchCenter);
        gmap.setZoom(13);
        createUserMarker();
        // Clear old discovered markers
        state.discoveredMarkers.forEach(m => { if (m.marker) m.marker.map = null; });
        state.discoveredMarkers = [];
        closeSearch();
      }
    });
  }
  if (!state._geoResolved) {
    state._geoResolved = true;
    requestUserLocation();
  } else if (state.searchCenter) {
    gmap.panTo(state.searchCenter);
    gmap.setZoom(15);
    createUserMarker();
    // Re-add discovered markers
    state.discoveredMarkers.forEach(m => { if (m.position) addPoiMarkerDirect(m.position.lat, m.position.lng); });
  }
}
function requestUserLocation() {
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    p => {
      state.userLocation = { lat: p.coords.latitude, lng: p.coords.longitude };
      state.searchCenter = { ...state.userLocation };
      flyIn();
    },
    err => {
      if (err.code === err.PERMISSION_DENIED) {
        showToast('Location access denied. Please enable location in your browser settings.');
      } else if (err.code === err.TIMEOUT) {
        showToast('Location request timed out. Trying again…');
        // Retry once with lower accuracy
        navigator.geolocation.getCurrentPosition(
          p => { state.userLocation = { lat: p.coords.latitude, lng: p.coords.longitude }; state.searchCenter = { ...state.userLocation }; flyIn(); },
          () => showToast('Could not get your location. Allow location access and refresh.'),
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
        );
      } else {
        showToast('Could not get your location. Allow location access and refresh.');
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}
function flyIn() {
  gmap.panTo(state.searchCenter);
  let z = gmap.getZoom(), target = 15;
  const iv = setInterval(() => {
    if (z >= target) { clearInterval(iv); createUserMarker(); return; }
    z += (target - z) * 0.12;
    gmap.setZoom(z);
  }, 25);
}
function createUserMarker() {
  if (userMarker) userMarker.map = null;
  const el = document.createElement('div');
  el.style.cssText = 'position:relative;width:60px;height:60px;display:flex;align-items:center;justify-content:center';
  el.innerHTML = '<div class="sonar-glow"></div><div class="sonar-ping"></div><div class="sonar-core"></div>';
  userMarker = new google.maps.marker.AdvancedMarkerElement({ position: state.userLocation || state.searchCenter, map: gmap, content: el });
}
function addPoiMarker(lat, lng) {
  addPoiMarkerDirect(lat, lng);
  state.discoveredMarkers.push({ position: { lat, lng } });
}
function addPoiMarkerDirect(lat, lng) {
  const el = document.createElement('div');
  el.style.cssText = 'position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center';
  el.innerHTML = '<div class="poi-pulse"></div><div class="poi-dot"></div>';
  const m = new google.maps.marker.AdvancedMarkerElement({ position: { lat, lng }, map: gmap, content: el });
  poiMarkers.push(m);
}

// ── Discovery Engine ──
let _lastDiscoveryCategory = null;
function triggerDiscovery() {
  if (!state.isPremium && state.credits <= 0) { showPremiumGate(); return; }
  if (!gmap) { showToast('Map is loading…'); return; }
  if (!state.userLocation) {
    showToast('Getting your location…');
    requestUserLocation();
    return;
  }
  if (!placesService) {
    placesService = new google.maps.places.PlacesService(gmap);
  }
  // Loading state on FAB
  const fab = document.getElementById('discover-fab');
  if (fab) {
    fab.style.pointerEvents = 'none';
    fab.querySelector('.material-symbols-outlined').textContent = 'progress_activity';
    fab.classList.add('animate-pulse');
  }
  // If no category selected, rotate through random categories (avoiding last used)
  let type = state.activeCategory;
  if (!type) {
    const available = CATEGORIES.filter(c => c.id !== _lastDiscoveryCategory);
    type = available[Math.floor(Math.random() * available.length)].id;
  }
  _lastDiscoveryCategory = type;
  // Vary search radius to get different results each time
  const radiusOptions = [1500, 2000, 2500, 3000, 3500, 4000, 5000];
  const radius = radiusOptions[Math.floor(Math.random() * radiusOptions.length)];
  const request = {
    location: new google.maps.LatLng(state.searchCenter.lat, state.searchCenter.lng),
    radius: radius,
    type: type,
  };
  placesService.nearbySearch(request, (results, status) => {
    // Reset FAB
    if (fab) {
      fab.style.pointerEvents = '';
      fab.querySelector('.material-symbols-outlined').textContent = 'explore';
      fab.classList.remove('animate-pulse');
    }
    if (status !== google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {
      showToast('No discoveries nearby. Try a different category!');
      return;
    }
    // First, filter out places the user has already discovered
    const discoveredIds = new Set(state.history.map(h => h.id));
    const fresh = results.filter(p => !discoveredIds.has(p.place_id));
    
    // Categorize remaining fresh places by quality tiers
    const exceptional = fresh.filter(r => (r.rating || 0) >= 4.8 && (r.user_ratings_total || 0) >= 5);
    const good = fresh.filter(r => (r.rating || 0) >= 4.5 && (r.user_ratings_total || 0) >= 10);
    const decent = fresh.filter(r => (r.rating || 0) >= 4.0);
    
    // Pick the highest available tier of undiscovered places
    let candidates = exceptional.length > 0 ? exceptional 
      : good.length > 0 ? good 
      : decent.length > 0 ? decent 
      : fresh;
      
    // If we have literally seen everything in this radius, recycle the pool
    if (candidates.length === 0) candidates = results;
    // Shuffle the entire candidate list (Fisher-Yates) for true randomness
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const pick = candidates[0];
    const lat = pick.geometry.location.lat();
    const lng = pick.geometry.location.lng();
    const origin = state.userLocation || state.searchCenter;
    const dist = haversine(origin.lat, origin.lng, lat, lng);
    const categoryName = CATEGORIES.find(c => c.id === type)?.name || 'Hidden Gem';
    const basicOpen = pick.opening_hours != null ? (pick.opening_hours.open_now === true ? true : pick.opening_hours.open_now === false ? false : null) : null;
    state.currentPlace = {
      id: pick.place_id, name: pick.name,
      category: categoryName,
      distance: formatDist(dist), address: pick.vicinity,
      rating: pick.rating, reviews: pick.user_ratings_total || 0,
      isOpen: basicOpen,
      lat, lng,
    };
    if (!state.isPremium) { state.credits--; updateCredits(); }
    state.history.unshift({ ...state.currentPlace, discoveredAt: new Date().toISOString() });
    gmap.panTo({ lat, lng });
    gmap.setZoom(16.5);
    addPoiMarker(lat, lng);
    showDiscoverySheet();
    if (state.page !== 'map') navigateTo('map');
    // Fetch detailed info (opening hours, phone, website) in background
    const _pickId = pick.place_id;
    try {
      placesService.getDetails(
        { placeId: _pickId, fields: ['opening_hours', 'current_opening_hours', 'business_status', 'formatted_phone_number', 'website', 'url'] },
        (detail, detailStatus) => {
          if (!state.currentPlace || state.currentPlace.id !== _pickId) return;
          state.currentPlace._detailsFetched = true;
          if (detailStatus !== google.maps.places.PlacesServiceStatus.OK || !detail) {
            console.warn('Place details fetch failed:', detailStatus);
            showDiscoverySheet();
            return;
          }
          // Update open status from detailed data
          if (detail.opening_hours) {
            try {
              state.currentPlace.isOpen = detail.opening_hours.isOpen() ? true : false;
            } catch (e) {
              // isOpen() can throw if hours data is incomplete
              if (detail.opening_hours.periods) {
                state.currentPlace.isOpen = checkOpenFromPeriods(detail.opening_hours.periods);
              }
            }
          }
          if (detail.business_status) {
            state.currentPlace.businessStatus = detail.business_status;
            if (detail.business_status === 'CLOSED_TEMPORARILY' || detail.business_status === 'CLOSED_PERMANENTLY') {
              state.currentPlace.isOpen = false;
            }
          }
          if (detail.formatted_phone_number) state.currentPlace.phone = detail.formatted_phone_number;
          if (detail.website) state.currentPlace.website = detail.website;
          if (detail.url) state.currentPlace.googleUrl = detail.url;
          // Update history entry too
          const histEntry = state.history.find(h => h.id === _pickId);
          if (histEntry) histEntry.isOpen = state.currentPlace.isOpen;
          // Re-render sheet with updated info
          showDiscoverySheet();
        }
      );
    } catch (e) {
      console.warn('getDetails call error:', e);
      if (state.currentPlace) state.currentPlace._detailsFetched = true;
    }
  });
}

// ── Toast Notification ──
function showToast(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:999;padding:12px 24px;border-radius:999px;font-size:13px;font-weight:600;letter-spacing:0.02em;pointer-events:none;opacity:0;transition:opacity 0.3s;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);';
    document.body.appendChild(toast);
  }
  const isDark = state.theme === 'dark';
  toast.style.background = isDark ? 'rgba(51,58,60,0.92)' : 'rgba(255,255,255,0.92)';
  toast.style.color = isDark ? '#dde4e5' : '#2d3435';
  toast.style.boxShadow = '0 8px 32px rgba(0,0,0,0.15)';
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// ── Discovery Sheet ──
function showDiscoverySheet() {
  const p = state.currentPlace; if (!p) return;
  const isSaved = state.savedPlaces.some(s => s.id === p.id);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}&query_place_id=${p.id}`;
  let openStatus;
  if (p.isOpen === true) {
    openStatus = '<span style="color:#10b981;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:4px;background:rgba(16,185,129,0.1);padding:4px 10px;border-radius:999px"><span style="font-size:8px">●</span> Open Now</span>';
  } else if (p.isOpen === false) {
    const closedLabel = p.businessStatus === 'CLOSED_PERMANENTLY' ? 'Permanently Closed' : p.businessStatus === 'CLOSED_TEMPORARILY' ? 'Temporarily Closed' : 'Closed';
    openStatus = `<span style="color:#ef4444;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:4px;background:rgba(239,68,68,0.1);padding:4px 10px;border-radius:999px"><span style="font-size:8px">●</span> ${closedLabel}</span>`;
  } else if (p._detailsFetched) {
    openStatus = `<a href="${mapUrl}" target="_blank" rel="noopener" style="color:var(--c-primary);font-weight:600;font-size:11px;text-decoration:none;display:inline-flex;align-items:center;gap:3px">Check hours <span class="material-symbols-outlined" style="font-size:14px">open_in_new</span></a>`;
  } else {
    openStatus = '<span style="color:var(--c-on-surface-variant);opacity:0.5;font-size:11px;display:inline-flex;align-items:center;gap:4px"><span class="material-symbols-outlined" style="font-size:14px;animation:spin 1s linear infinite">progress_activity</span> Checking hours…</span>';
  }
  // Star rating display
  const stars = p.rating ? Array.from({length: 5}, (_, i) => {
    const fill = p.rating >= i + 1 ? 1 : p.rating >= i + 0.5 ? 0.5 : 0;
    return `<span class="material-symbols-outlined text-sm" style="font-variation-settings:'FILL' ${fill >= 0.5 ? 1 : 0};color:${fill > 0 ? '#f59e0b' : 'var(--c-outline-variant)'}">star</span>`;
  }).join('') : '';
  document.getElementById('discovery-content').innerHTML = `
    <div class="flex flex-col items-center pt-3 pb-2 px-6">
      <div class="w-12 h-1 bg-on-surface-variant/20 rounded-full mb-4"></div>
      <div class="w-full flex justify-between items-start">
        <button onclick="collapseSheet()" class="p-2 bg-surface-container-high rounded-full"><span class="material-symbols-outlined text-on-surface text-lg">keyboard_arrow_down</span></button>
        <button onclick="dismissSheet()" class="p-2 bg-surface-container-high rounded-full"><span class="material-symbols-outlined text-on-surface text-lg">close</span></button>
      </div>
    </div>
    <div class="px-7 pb-8">
      <span class="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant opacity-70">${p.category}</span>
      <h2 class="text-3xl font-headline font-extrabold tracking-tighter text-on-surface mt-1 mb-3">${p.name}</h2>
      <div class="flex flex-wrap items-center gap-4 mb-4">
        <div class="flex items-center gap-1.5"><span class="material-symbols-outlined text-primary text-sm">near_me</span><span class="font-label text-xs uppercase tracking-wider font-medium">${p.distance} away</span></div>
        <div class="flex items-center gap-1.5 text-xs tracking-wider">${openStatus}</div>
      </div>
      ${p.rating ? `
      <div class="flex items-center gap-2.5 mb-4 p-3 bg-surface-container-low rounded-xl">
        <span class="text-xl font-extrabold text-on-surface">${p.rating.toFixed(1)}</span>
        <div class="flex flex-col">
          <div class="flex items-center gap-0.5">${stars}</div>
          <span class="text-[10px] text-on-surface-variant mt-0.5">${p.reviews ? p.reviews.toLocaleString() + ' reviews' : ''}</span>
        </div>
      </div>` : ''}
      ${p.address ? `<p class="text-on-surface-variant text-sm leading-relaxed mb-4">${p.address}</p>` : ''}
      ${(p.phone || p.website) ? `
      <div class="flex flex-wrap gap-2 mb-5">
        ${p.phone ? `<a href="tel:${p.phone.replace(/[^\d+]/g,'')}" class="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high rounded-xl text-xs font-medium text-on-surface active:scale-95 transition-all"><span class="material-symbols-outlined text-sm">call</span>${p.phone}</a>` : ''}
        ${p.website ? `<a href="${p.website}" target="_blank" rel="noopener" class="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high rounded-xl text-xs font-medium text-on-surface active:scale-95 transition-all"><span class="material-symbols-outlined text-sm">language</span>Website</a>` : ''}
      </div>` : '<div class="mb-5"></div>'}
      <div class="flex gap-3">
        <a href="${mapUrl}" target="_blank" rel="noopener" class="flex-1 py-3.5 bg-primary text-on-primary font-label text-xs uppercase tracking-widest font-bold rounded-full text-center shadow-lg shadow-primary/20 active:scale-95 transition-transform">Open in Maps</a>
        <button onclick="toggleSave()" class="px-5 py-3.5 bg-surface-container-high text-on-surface font-label text-xs uppercase tracking-widest font-bold rounded-full active:scale-95 transition-transform ${isSaved ? '!bg-primary !text-on-primary' : ''}"><span class="material-symbols-outlined text-sm align-middle mr-1" style="font-variation-settings:'FILL' ${isSaved ? 1 : 0}">favorite</span>${isSaved ? 'Saved' : 'Save'}</button>
      </div>
    </div>`;
  const sheet = document.getElementById('discovery-sheet');
  sheet.style.transform = 'translateY(0)';
}
function collapseSheet() {
  document.getElementById('discovery-sheet').style.transform = 'translateY(100%)';
}
function dismissSheet() {
  collapseSheet();
  state.currentPlace = null;
  if (state.searchCenter && gmap) { gmap.panTo(state.searchCenter); gmap.setZoom(15); }
}
function toggleSave() {
  const p = state.currentPlace; if (!p) return;
  const idx = state.savedPlaces.findIndex(s => s.id === p.id);
  if (idx >= 0) state.savedPlaces.splice(idx, 1);
  else state.savedPlaces.push({ ...p });
  showDiscoverySheet();
}

// ── Premium Gate ──
function showPremiumGate() {
  const gate = document.getElementById('premium-gate');
  const card = document.getElementById('premium-card');
  card.innerHTML = `
    <div class="mb-6 p-4 rounded-full bg-white/20 backdrop-blur-md shadow-lg inline-flex"><span class="material-symbols-outlined text-3xl text-primary" style="font-variation-settings:'FILL' 1">auto_awesome</span></div>
    <h1 class="font-headline text-3xl font-extrabold tracking-tighter text-on-surface leading-tight mb-3">Unlock the possibilities.</h1>
    <p class="text-on-surface-variant text-sm font-light leading-relaxed max-w-sm mx-auto mb-8">Join a curated world of modern explorers and archive your journeys with precision.</p>
    <div class="grid grid-cols-2 gap-3 mb-8 text-left">
      ${['Unlimited discoveries','Filter by category','Availability','Show History','Save Places','Create Itinerary'].map(f => `
        <div class="bg-white/10 p-3 rounded-lg flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-surface-container-lowest flex items-center justify-center"><span class="material-symbols-outlined text-primary text-base">check</span></div><span class="font-label text-[10px] tracking-wider font-bold">${f}</span></div>
      `).join('')}
    </div>
    <button onclick="navigateTo('checkout'); closePremiumGate();" class="w-full py-4 rounded-full golden-shimmer text-on-primary font-label text-sm tracking-widest font-bold shadow-xl active:scale-95 transition-transform mb-4">Unlock Premium</button>
    <button onclick="closePremiumGate()" class="text-on-surface-variant text-xs hover:text-on-surface transition-colors">Maybe Later</button>`;
  gate.style.opacity = '1'; gate.style.pointerEvents = 'auto';
  card.classList.remove('scale-95'); card.classList.add('scale-100');
}
function closePremiumGate() {
  const gate = document.getElementById('premium-gate');
  const card = document.getElementById('premium-card');
  gate.style.opacity = '0'; gate.style.pointerEvents = 'none';
  card.classList.add('scale-95'); card.classList.remove('scale-100');
}

// ── Page Renderers ──
function renderPage() {
  const c = document.getElementById('page-container');
  const mv = document.getElementById('map-view');
  
  if (state.page === 'map') {
    mv.classList.remove('hidden');
    c.innerHTML = ''; // Keep container empty
    c.className = 'flex-1 pt-0 pb-0 overflow-hidden relative z-10 w-full pointer-events-none';
    renderMapOverlay(c);
  } else {
    mv.classList.add('hidden');
    c.className = 'flex-1 pt-14 pb-20 overflow-y-auto bg-surface relative z-10 w-full pointer-events-auto';
    switch(state.page) {
      case 'account': renderAccount(c); break;
      case 'settings': renderSettings(c); break;
      case 'checkout': renderCheckout(c); break;
    }
  }
}

function renderMapOverlay(c) {
  // We no longer recreate #gmap, just overlay items like the category strip
  c.innerHTML = `
    <div class="absolute top-16 left-3 right-3 z-10 pointer-events-auto">
      <div class="flex overflow-x-auto hide-scrollbar gap-2 pb-3" id="cat-strip"></div>
    </div>`;
  renderCategories();
  setTimeout(() => {
    if (typeof google !== 'undefined') initMap();
  }, 100);
}

function renderCategories() {
  const strip = document.getElementById('cat-strip');
  if (!strip) return;
  strip.innerHTML = CATEGORIES.map(c => `
    <button onclick="selectCategory('${c.id}')" class="cat-chip flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/30 backdrop-blur-md border-t border-l border-white/30 shadow-sm text-on-surface whitespace-nowrap ${state.activeCategory === c.id ? 'active' : ''}">
      <span class="material-symbols-outlined text-base">${c.icon}</span>
      <span class="text-[10px] uppercase tracking-widest font-medium">${c.name}</span>
    </button>
  `).join('');
}

function selectCategory(id) {
  if (!state.isPremium && state.credits <= 0) { showPremiumGate(); return; }
  state.activeCategory = state.activeCategory === id ? null : id;
  renderCategories();
}

function renderAccount(c) {
  c.className = 'flex-1 pt-14 pb-20 overflow-y-auto';
  const isLogin = state.authTab === 'login';
  const memberType = state.isPremium ? 'Premium Explorer' : 'Standard Member';
  c.innerHTML = `<div class="page-enter px-6 pt-6 pb-12 max-w-lg mx-auto">
    <!-- Auth Tabs -->
    <div class="flex gap-8 items-end mb-6">
      <button onclick="state.authTab='login'; navigateTo('account')" class="font-headline text-3xl ${isLogin ? 'font-light border-b-2 border-surface-tint' : 'font-extralight text-on-surface-variant'} tracking-tighter pb-1">Log In</button>
      <button onclick="state.authTab='register'; navigateTo('account')" class="font-headline text-xl ${!isLogin ? 'font-light border-b-2 border-surface-tint' : 'font-extralight text-on-surface-variant'} tracking-tighter pb-1">Register</button>
    </div>
    
    <!-- Auth Form -->
    <div class="mb-10">
      ${isLogin ? `
      <form onsubmit="event.preventDefault(); handleLogin(this)" class="flex flex-col gap-5">
        <div><label class="font-label text-[10px] tracking-widest text-on-surface-variant px-3 mb-1 block">IDENTITY</label><input id="login-user" class="w-full bg-surface-container-low border-none rounded-full py-4 px-6 text-on-surface placeholder:text-stone-400 focus:bg-surface-container-high transition-colors" placeholder="Username" type="text" required/></div>
        <div><label class="font-label text-[10px] tracking-widest text-on-surface-variant px-3 mb-1 block">ACCESS KEY</label><input id="login-pass" class="w-full bg-surface-container-low border-none rounded-full py-4 px-6 text-on-surface placeholder:text-stone-400 focus:bg-surface-container-high transition-colors" placeholder="Password" type="password" required/></div>
        <button type="submit" class="mt-2 py-4 rounded-full bg-surface-tint text-on-primary font-label tracking-widest text-xs shadow-xl active:scale-[0.98] transition-transform">ENTER SANCTUARY</button>
        <a href="#" onclick="event.preventDefault(); showToast('Check your email for reset instructions.')" class="text-center font-label text-[10px] tracking-widest text-on-surface-variant">FORGOT CREDENTIALS?</a>
      </form>` : `
      <form onsubmit="event.preventDefault(); handleRegister(this)" class="flex flex-col gap-5">
        <div><label class="font-label text-[10px] tracking-widest text-on-surface-variant px-3 mb-1 block">FULL NAME</label><input id="reg-name" class="w-full bg-surface-container-low border-none rounded-full py-4 px-6 placeholder:text-stone-400 focus:bg-surface-container-high transition-colors" placeholder="Your name" type="text" required/></div>
        <div><label class="font-label text-[10px] tracking-widest text-on-surface-variant px-3 mb-1 block">EMAIL</label><input id="reg-email" class="w-full bg-surface-container-low border-none rounded-full py-4 px-6 placeholder:text-stone-400 focus:bg-surface-container-high transition-colors" placeholder="Email address" type="email" required/></div>
        <div><label class="font-label text-[10px] tracking-widest text-on-surface-variant px-3 mb-1 block">DATE OF BIRTH</label><input id="reg-dob" class="w-full bg-surface-container-low border-none rounded-full py-4 px-6 placeholder:text-stone-400 focus:bg-surface-container-high transition-colors" placeholder="DD/MM/YYYY" type="text"/></div>
        <div><label class="font-label text-[10px] tracking-widest text-on-surface-variant px-3 mb-1 block">PASSWORD</label><input id="reg-pass" class="w-full bg-surface-container-low border-none rounded-full py-4 px-6 placeholder:text-stone-400 focus:bg-surface-container-high transition-colors" placeholder="Password" type="password" required/></div>
        <div><label class="font-label text-[10px] tracking-widest text-on-surface-variant px-3 mb-1 block">CONFIRM PASSWORD</label><input id="reg-pass2" class="w-full bg-surface-container-low border-none rounded-full py-4 px-6 placeholder:text-stone-400 focus:bg-surface-container-high transition-colors" placeholder="Confirm password" type="password" required/></div>
        <button type="submit" class="mt-2 py-4 rounded-full bg-surface-tint text-on-primary font-label tracking-widest text-xs shadow-xl active:scale-[0.98] transition-transform">CREATE VOYAGE</button>
      </form>`}
    </div>

    <!-- Member Status -->
    <div class="p-6 rounded-lg bg-surface-container-low mb-4">
      <div class="flex justify-between items-start mb-3">
        <div><h3 class="font-headline text-lg font-semibold">Member Status</h3><p class="text-on-surface-variant text-xs mt-0.5">Unlock exclusive itineraries and local secrets.</p></div>
        <span class="material-symbols-outlined text-primary">auto_awesome</span>
      </div>
      <div class="flex items-center gap-3 p-3 rounded-full bg-surface-container-lowest border border-outline-variant/10 mb-4">
        <div class="w-9 h-9 rounded-full bg-surface-tint flex items-center justify-center text-on-primary"><span class="material-symbols-outlined text-sm">workspace_premium</span></div>
        <span class="text-sm font-medium">${memberType}</span>
      </div>
      ${!state.isPremium ? '<button onclick="showPremiumGate()" class="w-full py-3.5 rounded-full bg-surface-tint text-on-primary font-label tracking-widest text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform">JOIN PREMIUM <span class="material-symbols-outlined text-sm">arrow_forward</span></button>' : '<p class="text-xs text-on-surface-variant">Next payment: May 7, 2026</p>'}
    </div>

    <!-- History + Itinerary -->
    <div class="grid grid-cols-2 gap-3 mb-8">
      <button onclick="showHistory()" class="flex flex-col items-center justify-center p-5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors">
        <span class="material-symbols-outlined text-2xl mb-2 text-stone-500">history</span><span class="font-label text-[10px] tracking-widest text-stone-600">HISTORY</span>
      </button>
      <button onclick="showItinerary()" class="flex flex-col items-center justify-center p-5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors">
        <span class="material-symbols-outlined text-2xl mb-2 text-stone-500">event_note</span><span class="font-label text-[10px] tracking-widest text-stone-600">ITINERARY</span>
      </button>
    </div>
  </div>`;
}

function renderSettings(c) {
  c.className = 'flex-1 pt-14 pb-8 overflow-y-auto';
  c.innerHTML = `<div class="page-enter px-6 pt-6 pb-12 max-w-lg mx-auto">
    <button onclick="navigateTo('map')" class="mb-4 flex items-center gap-1 text-on-surface-variant text-sm"><span class="material-symbols-outlined text-lg">arrow_back</span> Back</button>
    <span class="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1 block">Personalization</span>
    <h1 class="text-4xl font-extrabold tracking-tighter text-on-surface mb-8">Settings</h1>
    <!-- Membership -->
    <h2 class="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-4 ml-1">Membership</h2>
    <div class="bg-surface-container-lowest rounded-lg p-5 mb-8 shadow-xl shadow-black/5">
      <div class="flex justify-between items-center mb-4">
        <div><p class="font-bold">${state.isPremium ? 'Premium Tier' : 'Free Tier'}</p><p class="text-xs text-on-surface-variant">${state.isPremium ? 'Unlimited discoveries' : '3 free discoveries'}</p></div>
        <span class="bg-primary text-on-primary px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">${state.isPremium ? 'Active' : 'Free'}</span>
      </div>
      ${state.isPremium ? `
      <div class="pt-3 border-t border-surface-container space-y-2">
        <button onclick="showToast('Manage your subscription in your App Store settings.')" class="w-full flex justify-between items-center py-2 hover:bg-surface-container-low rounded-lg px-2 transition-colors"><span class="font-medium text-sm">Manage Membership</span><span class="material-symbols-outlined text-outline-variant text-lg">chevron_right</span></button>
        <button onclick="showConfirm('Cancel Membership?','Your premium access will remain active until the end of your billing period.',cancelMembership)" class="w-full flex justify-between items-center py-2 hover:bg-surface-container-low rounded-lg px-2 transition-colors"><span class="font-medium text-sm text-error">Cancel Membership</span><span class="material-symbols-outlined text-outline-variant text-lg">chevron_right</span></button>
      </div>` : `<button onclick="showPremiumGate()" class="w-full py-3 rounded-full bg-surface-tint text-on-primary font-label tracking-widest text-xs mt-2 active:scale-95 transition-transform">JOIN PREMIUM</button>`}
    </div>
    <!-- Preferences -->
    <h2 class="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-4 ml-1">Preferences</h2>
    <div class="bg-surface-container-lowest rounded-lg p-5 mb-3 shadow-xl shadow-black/5">
      <div class="flex justify-between items-center"><span class="font-bold text-sm">Distance Units</span>
        <div class="bg-surface-container-high p-1 rounded-full flex gap-1">
          <button onclick="state.distanceUnit='meters'; navigateTo('settings')" class="px-4 py-1.5 rounded-full text-xs font-bold ${state.distanceUnit==='meters' ? 'toggle-active' : 'text-on-surface-variant'}">Meters</button>
          <button onclick="state.distanceUnit='feet'; navigateTo('settings')" class="px-4 py-1.5 rounded-full text-xs font-bold ${state.distanceUnit==='feet' ? 'toggle-active' : 'text-on-surface-variant'}">Feet</button>
        </div>
      </div>
    </div>
    <div class="bg-surface-container-lowest rounded-lg p-5 mb-8 shadow-xl shadow-black/5">
      <div class="flex justify-between items-center"><span class="font-bold text-sm">Theme</span>
        <div class="bg-surface-container-high p-1 rounded-full flex gap-1">
          <button onclick="setTheme('light')" class="px-4 py-1.5 rounded-full text-xs font-bold ${state.theme==='light' ? 'toggle-active' : 'text-on-surface-variant'}">Light</button>
          <button onclick="setTheme('dark')" class="px-4 py-1.5 rounded-full text-xs font-bold ${state.theme==='dark' ? 'toggle-active' : 'text-on-surface-variant'}">Dark</button>
        </div>
      </div>
    </div>
    <!-- Support -->
    <h2 class="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-4 ml-1">Support & Legal</h2>
    <div class="bg-surface-container-lowest rounded-lg overflow-hidden mb-8 shadow-xl shadow-black/5">
      <button onclick="openHelpCenter()" class="w-full flex items-center gap-3 p-5 hover:bg-surface-container-low transition-colors text-left"><span class="material-symbols-outlined text-primary">help_center</span><span class="flex-1 font-bold text-sm">Help Center & Support</span><span class="material-symbols-outlined text-outline-variant text-lg">open_in_new</span></button>
      <button onclick="showLegal('terms')" class="w-full flex items-center gap-3 p-5 hover:bg-surface-container-low transition-colors text-left"><span class="material-symbols-outlined text-primary">gavel</span><span class="flex-1 font-bold text-sm">Terms & Conditions</span><span class="material-symbols-outlined text-outline-variant text-lg">chevron_right</span></button>
      <button onclick="showLegal('privacy')" class="w-full flex items-center gap-3 p-5 hover:bg-surface-container-low transition-colors text-left"><span class="material-symbols-outlined text-primary">shield_person</span><span class="flex-1 font-bold text-sm">Privacy & Policy</span><span class="material-symbols-outlined text-outline-variant text-lg">chevron_right</span></button>
      <button onclick="showLegal('safety')" class="w-full flex items-center gap-3 p-5 hover:bg-surface-container-low transition-colors text-left"><span class="material-symbols-outlined text-primary">health_and_safety</span><span class="flex-1 font-bold text-sm">Safety Measures</span><span class="material-symbols-outlined text-outline-variant text-lg">chevron_right</span></button>
    </div>
    <!-- Account Actions -->
    <h2 class="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-4 ml-1">Account Actions</h2>
    <div class="bg-surface-container-lowest rounded-lg overflow-hidden mb-8 shadow-xl shadow-black/5">
      <button onclick="logOut()" class="w-full flex items-center gap-3 p-5 hover:bg-surface-container-low transition-colors text-left"><span class="material-symbols-outlined text-on-surface">logout</span><span class="flex-1 font-bold text-sm">Log out</span></button>
      <button onclick="showConfirm('Delete All Data?','This will permanently erase your discovery history, saved places, and itinerary. This cannot be undone.',deleteMyData)" class="w-full flex items-center gap-3 p-5 hover:bg-error/5 transition-colors text-left"><span class="material-symbols-outlined text-error">delete_sweep</span><span class="flex-1 font-bold text-sm text-error">Delete My Data</span></button>
      <button onclick="showConfirm('Delete Account?','This will permanently remove your account and all associated data. This action is irreversible.',deleteMyAccount)" class="w-full flex items-center gap-3 p-5 hover:bg-error/5 transition-colors text-left border-t border-surface-container"><span class="material-symbols-outlined text-error">person_remove</span><span class="flex-1 font-bold text-sm text-error">Delete My Account</span></button>
    </div>
    <div class="text-center pt-4 pb-8"><p class="text-[10px] uppercase tracking-widest text-on-surface-variant/60 font-medium">Wanderlost v2.4.0</p><p class="text-[10px] uppercase tracking-widest text-on-surface-variant/30 mt-0.5">Digital Sanctuary Project</p></div>
  </div>`;
}

function renderCheckout(c) {
  c.className = 'flex-1 pt-0 pb-0 overflow-y-auto';
  const isAnnual = state.selectedPlan === 'annual';
  const price = isAnnual ? '$100.00' : '$10.00';
  c.innerHTML = `<div class="page-enter">
    <header class="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-[40px] flex justify-between items-center px-6 py-4">
      <div class="flex items-center gap-2"><button onclick="navigateTo('map')" class="material-symbols-outlined text-on-surface-variant">arrow_back</button><h1 class="text-xl font-semibold tracking-tighter text-on-surface">Wanderlost</h1></div>
      <span class="material-symbols-outlined text-on-surface-variant">lock</span>
    </header>
    <div class="pt-24 pb-12 px-6 max-w-lg mx-auto">
      <p class="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">Checkout</p>
      <h2 class="text-3xl font-extrabold tracking-tight mb-3">Secure Checkout</h2>
      <p class="text-on-surface-variant text-sm font-light leading-relaxed mb-8">Choose your path to the extraordinary. Unlimited access to curated escapes and hidden gems.</p>
      <!-- Plans -->
      <label class="text-[10px] uppercase tracking-widest font-bold text-stone-500 px-1 mb-3 block">Select your plan</label>
      <div class="grid grid-cols-2 gap-3 mb-8">
        <div onclick="state.selectedPlan='annual'; navigateTo('checkout')" class="cursor-pointer p-5 rounded-lg transition-all ${isAnnual ? 'bg-surface-container-lowest ring-2 ring-primary' : 'bg-surface-container-low'}">
          ${isAnnual ? '<div class="flex justify-end mb-1"><div class="h-5 w-5 rounded-full bg-primary flex items-center justify-center"><span class="material-symbols-outlined text-white text-xs">check</span></div></div>' : ''}
          <p class="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-1">Save 15%</p>
          <h3 class="text-lg font-bold">Annual</h3>
          <div class="mt-2"><span class="text-2xl font-extrabold">$100</span><span class="text-on-surface-variant text-xs">/ year</span></div>
        </div>
        <div onclick="state.selectedPlan='monthly'; navigateTo('checkout')" class="cursor-pointer p-5 rounded-lg transition-all ${!isAnnual ? 'bg-surface-container-lowest ring-2 ring-primary' : 'bg-surface-container-low'}">
          ${!isAnnual ? '<div class="flex justify-end mb-1"><div class="h-5 w-5 rounded-full bg-primary flex items-center justify-center"><span class="material-symbols-outlined text-white text-xs">check</span></div></div>' : ''}
          <h3 class="text-lg font-bold">Monthly</h3>
          <div class="mt-2"><span class="text-2xl font-extrabold">$10</span><span class="text-on-surface-variant text-xs">/ month</span></div>
        </div>
      </div>
      <!-- Express Checkout -->
      <label class="text-[10px] uppercase tracking-widest font-bold text-stone-500 px-1 mb-3 block">Express Checkout</label>
      <div class="grid grid-cols-2 gap-3 mb-6">
        <button onclick="showToast('Apple Pay is not available in this demo.')" class="h-12 bg-black text-white rounded-full font-semibold text-sm active:scale-95 transition-transform"> Apple Pay</button>
        <button onclick="showToast('Google Pay is not available in this demo.')" class="h-12 bg-surface-container-highest border border-outline-variant/20 rounded-full font-semibold text-sm active:scale-95 transition-transform">Google Pay</button>
      </div>
      <!-- Card Form -->
      <div class="flex items-center gap-3 mb-6"><div class="h-px flex-1 bg-surface-container-highest"></div><span class="text-[10px] uppercase tracking-widest font-bold text-stone-400">Or Pay by card</span><div class="h-px flex-1 bg-surface-container-highest"></div></div>
      <div class="space-y-3 mb-8">
        <input class="w-full h-12 px-5 bg-surface-container-low border-none rounded-full focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-stone-400 text-sm" placeholder="Cardholder Name" type="text"/>
        <div class="relative"><input class="w-full h-12 px-5 bg-surface-container-low border-none rounded-full focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-stone-400 text-sm" placeholder="Card Number" type="text"/><span class="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-stone-400">credit_card</span></div>
        <div class="grid grid-cols-2 gap-3"><input class="h-12 px-5 bg-surface-container-low border-none rounded-full focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-stone-400 text-sm" placeholder="MM / YY" type="text"/><input class="h-12 px-5 bg-surface-container-low border-none rounded-full focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-stone-400 text-sm" placeholder="CVC" type="text"/></div>
      </div>
      <!-- Summary -->
      <div class="glass-panel p-6 rounded-lg shadow-xl shadow-black/5 bg-white/50 mb-6">
        <h4 class="text-[10px] uppercase tracking-widest font-bold text-stone-500 mb-4">Order Summary</h4>
        <div class="flex justify-between items-center mb-2"><span class="text-on-surface-variant text-sm">${isAnnual ? 'Annual' : 'Monthly'} Premium</span><span class="font-semibold">${price}</span></div>
        <div class="flex justify-between items-center mb-3"><span class="text-on-surface-variant text-sm">Platform Access Fee</span><span class="font-semibold">$0.00</span></div>
        <div class="pt-3 border-t border-on-surface/5 flex justify-between items-center"><span class="font-bold">Total Due Today</span><span class="text-xl font-extrabold tracking-tight">${price}</span></div>
      </div>
      <button onclick="completePurchase()" class="w-full h-12 bg-primary text-white font-bold rounded-full shadow-xl shadow-primary/20 active:scale-95 transition-transform mb-4">Complete Payment</button>
      <div class="flex flex-col items-center gap-2 mb-8">
        <div class="flex items-center gap-1 text-[10px] font-medium text-stone-500"><span class="material-symbols-outlined text-xs">event_repeat</span><span>Cancel anytime. Subscriptions renew automatically.</span></div>
        <div class="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-stone-400"><span class="material-symbols-outlined text-xs">security</span><span>256-bit Encrypted SSL</span></div>
      </div>
      <footer class="text-center py-8 opacity-40"><h1 class="text-lg font-bold tracking-tighter mb-1">Wanderlost</h1><p class="text-[10px] uppercase tracking-tight">Privacy • Terms • Global Support</p></footer>
    </div>
  </div>`;
}

function completePurchase() {
  state.isPremium = true;
  state.credits = Infinity;
  updateCredits();
  // Show success overlay
  const overlay = document.getElementById('checkout-overlay');
  document.getElementById('checkout-content').innerHTML = `
    <div class="page-enter flex flex-col items-center justify-center min-h-screen text-center px-6">
      <div class="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
        <span class="material-symbols-outlined text-4xl text-emerald-500" style="font-variation-settings:'FILL' 1">check_circle</span>
      </div>
      <h1 class="text-3xl font-extrabold tracking-tighter text-on-surface mb-3">Welcome to Premium</h1>
      <p class="text-on-surface-variant text-sm leading-relaxed mb-8 max-w-xs">You now have unlimited access to curated discoveries, saved places, and travel history.</p>
      <button onclick="closeCheckoutOverlay(); navigateTo('map')" class="py-4 px-12 rounded-full bg-primary text-on-primary font-label tracking-widest text-xs font-bold shadow-xl active:scale-95 transition-transform">START EXPLORING</button>
    </div>`;
  overlay.style.opacity = '1';
  overlay.style.pointerEvents = 'auto';
}

function showHistory() {
  const modal = document.getElementById('legal-modal');
  const content = document.getElementById('legal-content');
  const items = state.history;
  content.innerHTML = `
    <div class="mb-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
          <span class="material-symbols-outlined text-primary">history</span>
        </div>
        <span class="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Your Journeys</span>
      </div>
      <h1 class="text-3xl font-extrabold tracking-tighter text-on-surface mb-2">Discovery History</h1>
      <p class="text-on-surface-variant text-xs">${items.length} ${items.length === 1 ? 'discovery' : 'discoveries'} made</p>
    </div>
    ${items.length === 0 ? `
      <div class="flex flex-col items-center py-12 text-center">
        <span class="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4">explore_off</span>
        <p class="text-on-surface-variant text-sm">No discoveries yet.</p>
        <p class="text-on-surface-variant/60 text-xs mt-1">Tap Discover on the map to find hidden gems.</p>
      </div>
    ` : items.map((h, i) => `
      <div class="flex gap-4 mb-4 p-4 bg-surface-container-low rounded-xl">
        <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center flex-shrink-0">
          <span class="text-sm font-extrabold text-on-surface-variant">${items.length - i}</span>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-sm text-on-surface truncate">${h.name}</h3>
          <p class="text-[10px] text-on-surface-variant uppercase tracking-wider mt-0.5">${h.category} · ${h.distance} away</p>
          ${h.rating ? `<div class="flex items-center gap-1 mt-1"><span class="text-amber-500 text-xs font-bold">${h.rating.toFixed(1)} ★</span><span class="text-[10px] text-on-surface-variant">${h.reviews ? h.reviews + ' reviews' : ''}</span></div>` : ''}
          ${h.address ? `<p class="text-xs text-on-surface-variant/60 mt-1 truncate">${h.address}</p>` : ''}
        </div>
        <a href="https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}&query_place_id=${h.id}" target="_blank" rel="noopener" class="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <span class="material-symbols-outlined text-primary text-sm">open_in_new</span>
        </a>
      </div>
    `).join('')}
  `;
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'auto';
  modal.scrollTop = 0;
}

function showItinerary() {
  if (!state.isPremium) { showPremiumGate(); return; }
  const modal = document.getElementById('legal-modal');
  const content = document.getElementById('legal-content');
  const items = state.savedPlaces;
  content.innerHTML = `
    <div class="mb-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
          <span class="material-symbols-outlined text-primary">event_note</span>
        </div>
        <span class="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Your Collection</span>
      </div>
      <h1 class="text-3xl font-extrabold tracking-tighter text-on-surface mb-2">Saved Itinerary</h1>
      <p class="text-on-surface-variant text-xs">${items.length} ${items.length === 1 ? 'place' : 'places'} saved</p>
    </div>
    ${items.length === 0 ? `
      <div class="flex flex-col items-center py-12 text-center">
        <span class="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4">bookmark_border</span>
        <p class="text-on-surface-variant text-sm">No saved places yet.</p>
        <p class="text-on-surface-variant/60 text-xs mt-1">Save discoveries to build your itinerary.</p>
      </div>
    ` : items.map((p, i) => `
      <div class="flex gap-4 mb-4 p-4 bg-surface-container-low rounded-xl">
        <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings:'FILL' 1">favorite</span>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-sm text-on-surface truncate">${p.name}</h3>
          <p class="text-[10px] text-on-surface-variant uppercase tracking-wider mt-0.5">${p.category} · ${p.distance} away</p>
          ${p.rating ? `<div class="flex items-center gap-1 mt-1"><span class="text-amber-500 text-xs font-bold">${p.rating.toFixed(1)} ★</span></div>` : ''}
          ${p.address ? `<p class="text-xs text-on-surface-variant/60 mt-1 truncate">${p.address}</p>` : ''}
        </div>
        <div class="flex flex-col gap-1 flex-shrink-0">
          <a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}&query_place_id=${p.id}" target="_blank" rel="noopener" class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <span class="material-symbols-outlined text-primary text-sm">open_in_new</span>
          </a>
          <button onclick="removeSavedPlace('${p.id}')" class="w-9 h-9 rounded-full bg-error/10 flex items-center justify-center">
            <span class="material-symbols-outlined text-error text-sm">close</span>
          </button>
        </div>
      </div>
    `).join('')}
  `;
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'auto';
  modal.scrollTop = 0;
}

function removeSavedPlace(id) {
  state.savedPlaces = state.savedPlaces.filter(p => p.id !== id);
  showItinerary(); // re-render
}

// ── Auth Handlers ──
function handleLogin(form) {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  if (!user || !pass) { showToast('Please fill in all fields.'); return; }
  state.user = { name: user, email: user + '@wanderlost.app' };
  showToast('Welcome back, ' + user + '!');
  navigateTo('account');
}
function handleRegister(form) {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  if (!name || !email || !pass) { showToast('Please fill in all required fields.'); return; }
  if (pass !== pass2) { showToast('Passwords do not match.'); return; }
  state.user = { name, email };
  showToast('Welcome aboard, ' + name + '!');
  navigateTo('account');
}
function logOut() {
  state.user = null;
  showToast('You have been logged out.');
  navigateTo('map');
}

// ── Confirmation Dialog ──
function showConfirm(title, message, onConfirm) {
  const gate = document.getElementById('premium-gate');
  const card = document.getElementById('premium-card');
  card.innerHTML = `
    <div class="mb-4 p-3 rounded-full bg-error/10 inline-flex"><span class="material-symbols-outlined text-2xl text-error">warning</span></div>
    <h2 class="font-headline text-2xl font-extrabold tracking-tighter text-on-surface mb-3">${title}</h2>
    <p class="text-on-surface-variant text-sm leading-relaxed mb-8">${message}</p>
    <button id="confirm-action-btn" class="w-full py-3.5 rounded-full bg-error text-white font-label text-xs tracking-widest font-bold shadow-xl active:scale-95 transition-transform mb-3">Confirm</button>
    <button onclick="closePremiumGate()" class="text-on-surface-variant text-xs hover:text-on-surface transition-colors">Cancel</button>
  `;
  document.getElementById('confirm-action-btn').onclick = () => { closePremiumGate(); onConfirm(); };
  gate.style.opacity = '1'; gate.style.pointerEvents = 'auto';
  card.classList.remove('scale-95'); card.classList.add('scale-100');
}

function cancelMembership() {
  state.isPremium = false;
  state.credits = 0;
  updateCredits();
  showToast('Your premium membership has been cancelled.');
  navigateTo('settings');
}
function deleteMyData() {
  state.history = [];
  state.savedPlaces = [];
  state.discoveredMarkers = [];
  poiMarkers.forEach(m => { m.map = null; });
  poiMarkers = [];
  showToast('All your data has been deleted.');
  navigateTo('settings');
}
function deleteMyAccount() {
  state.user = null;
  state.isPremium = false;
  state.credits = 3;
  state.history = [];
  state.savedPlaces = [];
  state.discoveredMarkers = [];
  poiMarkers.forEach(m => { m.map = null; });
  poiMarkers = [];
  showToast('Your account has been deleted.');
  navigateTo('map');
}

function setTheme(t) {
  state.theme = t;
  document.documentElement.classList.toggle('dark', t === 'dark');
  // CSS filter handles dark map — no reinit needed
  renderPage();
}

// ── Legal Modal ──
const LEGAL_CONTENT = {
  terms: {
    icon: 'gavel',
    label: 'Legal',
    title: 'Terms & Conditions',
    updated: 'Last updated: April 7, 2026',
    sections: [
      { h: '1. Acceptance of Terms', p: 'By downloading, accessing, or using Wanderlost, you agree to be bound by these Terms and Conditions. If you do not agree, do not use the application.' },
      { h: '2. The Service (Discovery, Not Curation)', p: 'Wanderlost is a recommendation engine that utilizes third-party algorithms to identify high-rated locations.', list: ['<strong>No Curation:</strong> We do not manually vet, visit, or curate these locations.', '<strong>No Travel Guide:</strong> Wanderlost does not provide travel advice, safety ratings, or guided services. We provide a visual interface for public data.'] },
      { h: '3. User Responsibility & Safety', p: 'All travel undertaken as a result of a "Discovery" is at your own risk.', list: ['<strong>Self-Directed Travel:</strong> All travel undertaken as a result of a "Discovery" is at your own risk.', '<strong>Self-Preservation:</strong> You are solely responsible for assessing the safety, legality, and accessibility of any location before and during your visit.', '<strong>Awareness:</strong> You agree to maintain situational awareness and adhere to local laws. Wanderlost is not responsible for accidents, injuries, or legal issues encountered during your journey.'] },
      { h: '4. Subscriptions & Billing', list: ['<strong>Free Tier:</strong> Users receive 3 free "Discoveries." Once exhausted, a Premium subscription is required for further access.', '<strong>Premium Plans:</strong> $10.00/month or $100.00/year.', '<strong>Renewals:</strong> Subscriptions auto-renew through your Apple ID or Google Play account unless canceled at least 24 hours before the end of the current period.', '<strong>Refunds:</strong> All billing is handled by the respective App Stores; Wanderlost does not issue direct refunds.'] },
      { h: '5. Account Security', p: 'You are responsible for maintaining the confidentiality of your account credentials (Email, Password). Wanderlost is not liable for unauthorized access to your account resulting from your failure to secure your login details.' },
      { h: '6. Limitation of Liability', p: 'To the maximum extent permitted by law, Wanderlost and its creators shall not be liable for any direct, indirect, incidental, or consequential damages resulting from:', list: ['Your use of the app or reliance on its recommendations.', 'Any interactions with third-party locations or individuals at those locations.', 'Data inaccuracies or map errors provided by third-party SDKs (Google Maps).'] },
      { h: '7. Prohibited Use', p: 'You agree not to:', list: ['Reverse engineer or scrape data from the "Neural Map."', 'Use the app for any illegal purposes or to harass others.', 'Circumvent the "3 Free Discoveries" limit through technical manipulation.'] },
      { h: '8. Termination', p: 'We reserve the right to suspend or terminate your account if you violate these terms. You may delete your account and data at any time via the Settings menu.' },
      { h: '9. Changes to Terms', p: 'Wanderlost may update these terms to reflect changes in the law or app features. Continued use of the app after updates constitutes acceptance of the new terms.' },
      { h: '10. Governing Law', p: 'These terms are governed by the laws of your local jurisdiction, without regard to conflict of law principles.' },
    ],
  },
  privacy: {
    icon: 'shield_person',
    label: 'Privacy',
    title: 'Privacy Policy',
    updated: 'Last updated: April 7, 2026',
    sections: [
      { h: '1. Data We Collect', p: 'Wanderlost collects the minimum data necessary to deliver the service:', list: ['<strong>Location Data:</strong> Used exclusively to find nearby discoveries. Not stored on our servers.', '<strong>Account Information:</strong> Email address and encrypted password for authentication.', '<strong>Usage Data:</strong> Number of discoveries used (for free-tier tracking). No browsing history is collected.'] },
      { h: '2. Data We Do Not Collect', list: ['We do not collect contacts, photos, or files.', 'We do not track your movements or create location history.', 'We do not sell or share personal data with third parties for advertising.'] },
      { h: '3. Third-Party Services', p: 'The app uses the Google Maps Platform to power the map and discovery interface. Google\'s own privacy policy governs their data handling. We recommend reviewing it at <em>policies.google.com/privacy</em>.' },
      { h: '4. Data Storage & Security', list: ['Account data is encrypted at rest and in transit using industry-standard 256-bit SSL/TLS.', 'Passwords are hashed using bcrypt; we cannot see your password.', 'We use no third-party analytics, trackers, or advertising SDKs.'] },
      { h: '5. Your Rights', p: 'You have the right to:', list: ['<strong>Access:</strong> View all data associated with your account.', '<strong>Delete:</strong> Permanently remove your account and all associated data via Settings → Delete My Account.', '<strong>Portability:</strong> Request an export of your data by contacting support.'] },
      { h: '6. Children\'s Privacy', p: 'Wanderlost is not directed at children under 13. We do not knowingly collect data from minors. If you believe we have inadvertently collected such data, contact us for immediate removal.' },
      { h: '7. Contact', p: 'For privacy concerns, contact us at <strong>privacy@wanderlost.app</strong>.' },
    ],
  },
  safety: {
    icon: 'health_and_safety',
    label: 'Safety',
    title: 'Safety Measures',
    updated: 'Your safety is your own responsibility',
    sections: [
      { h: 'The Self-Preservation Principle', p: 'Wanderlost surfaces high-rated locations from public data. We do not guarantee the safety, legality, or accessibility of any discovered place. Before every journey, practice self-preservation.' },
      { h: '1. Before You Go', list: ['<strong>Research:</strong> Read recent reviews and verify the location\'s current status online.', '<strong>Inform Someone:</strong> Share your destination with a trusted person.', '<strong>Connectivity:</strong> Ensure your phone is charged and you have signal or an offline map downloaded.', '<strong>Local Laws:</strong> Verify that visiting the location is legal, especially for natural sites, private property, or restricted areas.'] },
      { h: '2. During Your Visit', list: ['<strong>Situational Awareness:</strong> Stay alert to your surroundings at all times.', '<strong>Trust Your Instincts:</strong> If a situation feels unsafe, leave immediately.', '<strong>Respect Locals:</strong> You are a guest. Be respectful of the community, their customs, and their property.', '<strong>Travel Light:</strong> Minimize visible valuables. Keep your phone secure.'] },
      { h: '3. Emergency Preparedness', list: ['Know the local emergency number (112 in EU, 911 in US, etc.).', 'Carry basic first-aid supplies for remote locations.', 'Have local currency and a backup payment method.', 'Download offline maps for areas with limited connectivity.'] },
      { h: '4. What Wanderlost Is Not', list: ['We are <strong>not</strong> a tour operator or travel agency.', 'We are <strong>not</strong> responsible for the condition, safety, or quality of any location.', 'We are <strong>not</strong> a substitute for professional travel advice or local guidance.', 'We <strong>do not</strong> verify health and safety standards of any establishment.'] },
      { h: '5. Report a Concern', p: 'If you discover a location that poses a safety risk, please report it to us at <strong>safety@wanderlost.app</strong> so we can take appropriate action.' },
    ],
  },
};

function showLegal(type) {
  const data = LEGAL_CONTENT[type];
  if (!data) return;
  const modal = document.getElementById('legal-modal');
  const content = document.getElementById('legal-content');
  content.innerHTML = `
    <div class="mb-8">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
          <span class="material-symbols-outlined text-primary">${data.icon}</span>
        </div>
        <span class="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">${data.label}</span>
      </div>
      <h1 class="text-3xl font-extrabold tracking-tighter text-on-surface mb-2">${data.title}</h1>
      <p class="text-on-surface-variant text-xs font-light">${data.updated}</p>
    </div>
    ${data.sections.map(s => `
      <div class="mb-8">
        <h2 class="text-base font-bold text-on-surface mb-3">${s.h}</h2>
        ${s.p ? `<p class="text-on-surface-variant text-sm leading-relaxed mb-3">${s.p}</p>` : ''}
        ${s.list ? `<ul class="space-y-2.5">${s.list.map(li => `
          <li class="flex gap-3 text-sm text-on-surface-variant leading-relaxed">
            <span class="material-symbols-outlined text-primary text-sm mt-0.5 flex-shrink-0">chevron_right</span>
            <span>${li}</span>
          </li>
        `).join('')}</ul>` : ''}
      </div>
    `).join('')}
    <div class="pt-6 border-t border-surface-container mt-8">
      <p class="text-xs font-bold text-on-surface mb-3">Related Documents</p>
      <div class="flex flex-col gap-2">
        ${Object.entries(LEGAL_CONTENT).filter(([k]) => k !== type).map(([k, v]) => `
          <button onclick="showLegal('${k}')" class="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors text-left">
            <span class="material-symbols-outlined text-primary text-lg">${v.icon}</span>
            <span class="flex-1 text-sm font-semibold text-on-surface">${v.title}</span>
            <span class="material-symbols-outlined text-outline-variant text-sm">arrow_forward</span>
          </button>
        `).join('')}
      </div>
      <p class="text-[10px] uppercase tracking-widest text-on-surface-variant/40 text-center mt-6">Wanderlost — Digital Sanctuary Project</p>
    </div>
  `;
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'auto';
  modal.scrollTop = 0;
}

function closeLegalModal() {
  const modal = document.getElementById('legal-modal');
  modal.style.opacity = '0';
  modal.style.pointerEvents = 'none';
}

function closeCheckoutOverlay() {
  const overlay = document.getElementById('checkout-overlay');
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
}

function openHelpCenter() {
  window.open('mailto:support@wanderlost.app', '_blank');
  showToast('Opening email client for support@wanderlost.app');
}

function openSearch() {
  const ov = document.getElementById('search-overlay');
  if (ov) {
    ov.style.opacity = '1';
    ov.style.pointerEvents = 'auto';
    setTimeout(() => document.getElementById('search-input')?.focus(), 100);
  }
}
function closeSearch() {
  const ov = document.getElementById('search-overlay');
  if (ov) {
    ov.style.opacity = '0';
    ov.style.pointerEvents = 'none';
  }
}

// ── Globals ──
window.openSearch = openSearch;
window.closeSearch = closeSearch;
window.onMapsReady = onMapsReady;
window.navigateTo = navigateTo;
window.triggerDiscovery = triggerDiscovery;
window.selectCategory = selectCategory;
window.toggleSave = toggleSave;
window.showPremiumGate = showPremiumGate;
window.closePremiumGate = closePremiumGate;
window.collapseSheet = collapseSheet;
window.dismissSheet = dismissSheet;
window.completePurchase = completePurchase;
window.showHistory = showHistory;
window.showItinerary = showItinerary;
window.setTheme = setTheme;
window.showLegal = showLegal;
window.closeLegalModal = closeLegalModal;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.logOut = logOut;
window.showConfirm = showConfirm;
window.cancelMembership = cancelMembership;
window.deleteMyData = deleteMyData;
window.deleteMyAccount = deleteMyAccount;
window.removeSavedPlace = removeSavedPlace;
window.closeCheckoutOverlay = closeCheckoutOverlay;
window.openHelpCenter = openHelpCenter;

// ── Init ──
navigateTo('map');
