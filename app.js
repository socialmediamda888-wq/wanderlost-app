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

const MAP_STYLES = {
  light: [
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
  ],
  dark: [
    { elementType:'geometry', stylers:[{color:'#1a1f20'}] },
    { elementType:'labels.icon', stylers:[{visibility:'off'}] },
    { elementType:'labels.text.fill', stylers:[{color:'#596061'}] },
    { elementType:'labels.text.stroke', stylers:[{color:'#0c0f0f'}] },
    { featureType:'poi', stylers:[{visibility:'off'}] },
    { featureType:'road', elementType:'geometry', stylers:[{color:'#2a3031'}] },
    { featureType:'road', elementType:'labels', stylers:[{visibility:'off'}] },
    { featureType:'transit', stylers:[{visibility:'off'}] },
    { featureType:'water', elementType:'geometry', stylers:[{color:'#0e1314'}] },
    { featureType:'administrative', elementType:'geometry.stroke', stylers:[{color:'#333a3c'}] },
    { featureType:'administrative.land_parcel', elementType:'labels', stylers:[{visibility:'off'}] },
  ],
};

// ── State ──
let state = {
  page: 'map',
  credits: 3,
  isPremium: false,
  user: null,
  authTab: 'login',
  activeCategory: null,
  currentPlace: null,
  savedPlaces: [],
  history: [],
  itinerary: [],
  userLocation: null,
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

// ── Navigation ──
function navigateTo(page) {
  state.page = page;
  renderPage();
  updateNav();
}
function updateNav() {
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.nav === state.page);
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
function onMapsReady() {
  if (state.page === 'map') initMap();
}
function initMap() {
  const container = document.getElementById('gmap');
  if (!container) return;
  const center = state.userLocation || { lat: 48.8566, lng: 2.3522 };
  if (!state.userLocation) state.userLocation = center;
  const isDark = state.theme === 'dark';
  const opts = {
    center, zoom: state._mapZoom || 3,
    disableDefaultUI: true, gestureHandling: 'greedy',
  };
  // mapId enables cloud styling + AdvancedMarker but overrides JSON styles.
  // In dark mode we drop mapId so our dark JSON style applies.
  if (!isDark) opts.mapId = MAP_ID;
  opts.styles = MAP_STYLES[state.theme];
  gmap = new google.maps.Map(container, opts);
  placesService = new google.maps.places.PlacesService(gmap);
  if (!state._geoResolved) {
    state._geoResolved = true;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => { state.userLocation = { lat: p.coords.latitude, lng: p.coords.longitude }; flyIn(); },
        () => flyIn()
      );
    } else { flyIn(); }
  } else {
    gmap.panTo(state.userLocation);
    gmap.setZoom(15);
    createUserMarker();
    // Re-add discovered markers
    state.discoveredMarkers.forEach(m => { if (m.position) addPoiMarkerAt(m.position.lat, m.position.lng); });
  }
}
function flyIn() {
  gmap.panTo(state.userLocation);
  let z = gmap.getZoom(), target = 15;
  const iv = setInterval(() => {
    if (z >= target) { clearInterval(iv); createUserMarker(); return; }
    z += (target - z) * 0.12;
    gmap.setZoom(z);
  }, 25);
}
function createUserMarker() {
  if (userMarker) { try { userMarker.map = null; } catch(e) { userMarker.setMap(null); } }
  const isDark = state.theme === 'dark';
  try {
    const el = document.createElement('div');
    el.style.cssText = 'position:relative;width:60px;height:60px;display:flex;align-items:center;justify-content:center';
    el.innerHTML = '<div class="sonar-glow"></div><div class="sonar-ping"></div><div class="sonar-core"></div>';
    userMarker = new google.maps.marker.AdvancedMarkerElement({ position: state.userLocation, map: gmap, content: el });
  } catch(e) {
    userMarker = new google.maps.Marker({ position: state.userLocation, map: gmap, icon: {
      path: google.maps.SymbolPath.CIRCLE, scale: 8,
      fillColor: isDark ? '#dde4e5' : '#5f5e5e', fillOpacity: 1,
      strokeColor: isDark ? '#333a3c' : '#fff', strokeWeight: 3,
    }});
  }
}
function addPoiMarker(lat, lng) {
  addPoiMarkerAt(lat, lng);
  state.discoveredMarkers.push({ position: { lat, lng } });
}
function addPoiMarkerAt(lat, lng) {
  const el = document.createElement('div');
  el.style.cssText = 'position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center';
  el.innerHTML = '<div class="poi-pulse"></div><div class="poi-dot"></div>';
  try {
    const m = new google.maps.marker.AdvancedMarkerElement({ position: { lat, lng }, map: gmap, content: el });
    poiMarkers.push(m);
  } catch(e) {
    // AdvancedMarker not available without mapId, use regular marker
    const m = new google.maps.Marker({ position: { lat, lng }, map: gmap, icon: {
      path: google.maps.SymbolPath.CIRCLE, scale: 7,
      fillColor: state.theme === 'dark' ? '#dde4e5' : '#5f5e5e', fillOpacity: 1,
      strokeColor: state.theme === 'dark' ? '#333a3c' : '#fff', strokeWeight: 2,
    }});
    poiMarkers.push(m);
  }
}

// ── Discovery Engine ──
function triggerDiscovery() {
  if (!state.isPremium && state.credits <= 0) { showPremiumGate(); return; }
  if (!placesService || !state.userLocation) { navigateTo('map'); return; }
  const fab = document.getElementById('discover-fab');
  if (fab) fab.style.pointerEvents = 'none';
  const type = state.activeCategory || 'tourist_attraction';
  placesService.nearbySearch(
    { location: state.userLocation, radius: 2500, type: [type] },
    (results, status) => {
      if (fab) fab.style.pointerEvents = '';
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.length) return;
      // Filter for high-rated places (simulating >4.8 local-loved)
      const good = results.filter(r => (r.rating || 0) >= 4.5);
      const pool = good.length > 0 ? good : results;
      const pick = pool[Math.floor(Math.random() * Math.min(pool.length, 8))];
      const lat = pick.geometry.location.lat(), lng = pick.geometry.location.lng();
      const dist = haversine(state.userLocation.lat, state.userLocation.lng, lat, lng);
      state.currentPlace = {
        id: pick.place_id, name: pick.name,
        category: CATEGORIES.find(c => c.id === type)?.name || 'Hidden Gem',
        distance: formatDist(dist), address: pick.vicinity,
        rating: pick.rating, isOpen: pick.opening_hours?.isOpen?.() ?? null,
        lat, lng,
      };
      if (!state.isPremium) { state.credits--; updateCredits(); }
      state.history.unshift({ ...state.currentPlace, discoveredAt: new Date().toISOString() });
      gmap.panTo({ lat, lng }); gmap.setZoom(16.5);
      addPoiMarker(lat, lng);
      showDiscoverySheet();
      if (state.page !== 'map') navigateTo('map');
    }
  );
}

// ── Discovery Sheet ──
function showDiscoverySheet() {
  const p = state.currentPlace; if (!p) return;
  const isSaved = state.savedPlaces.some(s => s.id === p.id);
  const mapUrl = `https://www.google.com/maps/place/?q=place_id:${p.id}`;
  const openStatus = p.isOpen === true ? '<span class="text-emerald-500 font-bold">● Open Now</span>' : p.isOpen === false ? '<span class="text-red-400 font-bold">● Closed</span>' : '<span class="text-stone-400">Hours unknown</span>';
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
      <div class="flex items-center gap-5 mb-4">
        <div class="flex items-center gap-1.5"><span class="material-symbols-outlined text-primary text-sm">near_me</span><span class="font-label text-xs uppercase tracking-wider font-medium">${p.distance} away</span></div>
        <div class="flex items-center gap-1.5 text-xs uppercase tracking-wider">${openStatus}</div>
      </div>
      ${p.address ? `<p class="text-on-surface-variant text-sm leading-relaxed mb-6">${p.address}</p>` : ''}
      <div class="flex gap-3">
        <a href="${mapUrl}" target="_blank" rel="noopener" class="flex-1 py-3.5 bg-primary text-on-primary font-label text-xs uppercase tracking-widest font-bold rounded-full text-center shadow-lg shadow-primary/20 active:scale-95 transition-transform">Open in Google Maps</a>
        <button onclick="toggleSave()" class="px-5 py-3.5 bg-surface-container-high text-on-surface font-label text-xs uppercase tracking-widest font-bold rounded-full active:scale-95 transition-transform ${isSaved ? 'bg-primary text-on-primary' : ''}">${isSaved ? 'Saved ♥' : 'Save'}</button>
      </div>
    </div>`;
  const sheet = document.getElementById('discovery-sheet');
  sheet.classList.remove('translate-y-full');
  sheet.classList.add('translate-y-0');
}
function collapseSheet() {
  document.getElementById('discovery-sheet').classList.add('translate-y-full');
  document.getElementById('discovery-sheet').classList.remove('translate-y-0');
}
function dismissSheet() {
  collapseSheet();
  state.currentPlace = null;
  if (state.userLocation && gmap) { gmap.panTo(state.userLocation); gmap.setZoom(15); }
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
  c.className = 'flex-1 pt-14 pb-20 overflow-hidden';
  switch(state.page) {
    case 'map': renderMap(c); break;
    case 'account': renderAccount(c); break;
    case 'settings': renderSettings(c); break;
    case 'checkout': renderCheckout(c); break;
    default: renderMap(c);
  }
}

function renderMap(c) {
  c.className = 'flex-1 pt-0 pb-0 overflow-hidden relative';
  c.innerHTML = `
    <div id="gmap" class="absolute inset-0"></div>
    <div class="scrim-top"></div>
    <div class="scrim-bottom"></div>
    <div class="absolute top-16 left-3 right-3 z-10">
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
    <!-- Profile Card -->
    <div class="relative w-full aspect-[4/3] rounded-lg overflow-hidden mb-6">
      <div class="absolute inset-0 bg-gradient-to-br from-surface-container-highest to-surface-container"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
      <div class="absolute bottom-6 left-6">
        <p class="font-label text-white/70 tracking-widest text-[10px] mb-1">CURRENT STATUS</p>
        <h2 class="text-2xl font-headline text-white font-light tracking-tight italic">${state.isPremium ? 'Premium Explorer' : 'Free Spirit'}</h2>
      </div>
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
    <!-- Auth Tabs -->
    <div class="flex gap-8 items-end mb-6">
      <button onclick="state.authTab='login'; navigateTo('account')" class="font-headline text-3xl ${isLogin ? 'font-light border-b-2 border-surface-tint' : 'font-extralight text-on-surface-variant'} tracking-tighter pb-1">Log In</button>
      <button onclick="state.authTab='register'; navigateTo('account')" class="font-headline text-xl ${!isLogin ? 'font-light border-b-2 border-surface-tint' : 'font-extralight text-on-surface-variant'} tracking-tighter pb-1">Register</button>
    </div>
    ${isLogin ? `
    <form onsubmit="event.preventDefault(); alert('Login simulation — connected!')" class="flex flex-col gap-5">
      <div><label class="font-label text-[10px] tracking-widest text-on-surface-variant px-3 mb-1 block">IDENTITY</label><input class="w-full bg-surface-container-low border-none rounded-full py-4 px-6 text-on-surface placeholder:text-stone-400 focus:bg-surface-container-high transition-colors" placeholder="Username" type="text"/></div>
      <div><label class="font-label text-[10px] tracking-widest text-on-surface-variant px-3 mb-1 block">ACCESS KEY</label><input class="w-full bg-surface-container-low border-none rounded-full py-4 px-6 text-on-surface placeholder:text-stone-400 focus:bg-surface-container-high transition-colors" placeholder="Password" type="password"/></div>
      <button type="submit" class="mt-2 py-4 rounded-full bg-surface-tint text-on-primary font-label tracking-widest text-xs shadow-xl active:scale-[0.98] transition-transform">ENTER SANCTUARY</button>
      <a href="#" class="text-center font-label text-[10px] tracking-widest text-on-surface-variant">FORGOT CREDENTIALS?</a>
    </form>` : `
    <form onsubmit="event.preventDefault(); alert('Account created — welcome!')" class="flex flex-col gap-5">
      <div><label class="font-label text-[10px] tracking-widest text-on-surface-variant px-3 mb-1 block">FULL NAME</label><input class="w-full bg-surface-container-low border-none rounded-full py-4 px-6 placeholder:text-stone-400 focus:bg-surface-container-high transition-colors" placeholder="Your name" type="text"/></div>
      <div><label class="font-label text-[10px] tracking-widest text-on-surface-variant px-3 mb-1 block">EMAIL</label><input class="w-full bg-surface-container-low border-none rounded-full py-4 px-6 placeholder:text-stone-400 focus:bg-surface-container-high transition-colors" placeholder="Email address" type="email"/></div>
      <div><label class="font-label text-[10px] tracking-widest text-on-surface-variant px-3 mb-1 block">DATE OF BIRTH</label><input class="w-full bg-surface-container-low border-none rounded-full py-4 px-6 placeholder:text-stone-400 focus:bg-surface-container-high transition-colors" placeholder="DD/MM/YYYY" type="text"/></div>
      <div><label class="font-label text-[10px] tracking-widest text-on-surface-variant px-3 mb-1 block">PASSWORD</label><input class="w-full bg-surface-container-low border-none rounded-full py-4 px-6 placeholder:text-stone-400 focus:bg-surface-container-high transition-colors" placeholder="Password" type="password"/></div>
      <div><label class="font-label text-[10px] tracking-widest text-on-surface-variant px-3 mb-1 block">CONFIRM PASSWORD</label><input class="w-full bg-surface-container-low border-none rounded-full py-4 px-6 placeholder:text-stone-400 focus:bg-surface-container-high transition-colors" placeholder="Confirm password" type="password"/></div>
      <button type="submit" class="mt-2 py-4 rounded-full bg-surface-tint text-on-primary font-label tracking-widest text-xs shadow-xl active:scale-[0.98] transition-transform">CREATE VOYAGE</button>
    </form>`}
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
        <button class="w-full flex justify-between items-center py-2"><span class="font-medium text-sm">Manage Membership</span><span class="material-symbols-outlined text-outline-variant text-lg">chevron_right</span></button>
        <button class="w-full flex justify-between items-center py-2"><span class="font-medium text-sm">Cancel Membership</span><span class="material-symbols-outlined text-outline-variant text-lg">chevron_right</span></button>
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
      ${[{i:'help_center',t:'Help Center & Support',a:'open_in_new'},{i:'gavel',t:'Terms & Conditions',a:'chevron_right'},{i:'shield_person',t:'Privacy & Policy',a:'chevron_right'},{i:'health_and_safety',t:'Safety Measures',a:'chevron_right'}].map(x=>`<button class="w-full flex items-center gap-3 p-5 hover:bg-surface-container-low transition-colors text-left"><span class="material-symbols-outlined text-primary">${x.i}</span><span class="flex-1 font-bold text-sm">${x.t}</span><span class="material-symbols-outlined text-outline-variant text-lg">${x.a}</span></button>`).join('')}
    </div>
    <!-- Account Actions -->
    <h2 class="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-4 ml-1">Account Actions</h2>
    <div class="bg-surface-container-lowest rounded-lg overflow-hidden mb-8 shadow-xl shadow-black/5">
      <button class="w-full flex items-center gap-3 p-5 hover:bg-surface-container-low transition-colors text-left"><span class="material-symbols-outlined text-on-surface">logout</span><span class="flex-1 font-bold text-sm">Log out</span></button>
      <button class="w-full flex items-center gap-3 p-5 hover:bg-error/5 transition-colors text-left"><span class="material-symbols-outlined text-error">delete_sweep</span><span class="flex-1 font-bold text-sm text-error">Delete My Data</span></button>
      <button class="w-full flex items-center gap-3 p-5 hover:bg-error/5 transition-colors text-left border-t border-surface-container"><span class="material-symbols-outlined text-error">person_remove</span><span class="flex-1 font-bold text-sm text-error">Delete My Account</span></button>
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
        <button class="h-12 bg-black text-white rounded-full font-semibold text-sm active:scale-95 transition-transform"> Apple Pay</button>
        <button class="h-12 bg-surface-container-highest border border-outline-variant/20 rounded-full font-semibold text-sm active:scale-95 transition-transform">Google Pay</button>
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
  alert('Welcome to Premium! 🎉 You now have unlimited discoveries.');
  navigateTo('map');
}

function showHistory() {
  if (!state.isPremium && state.history.length > 3) { showPremiumGate(); return; }
  const items = state.history.length ? state.history.map(h => `<div class="p-4 bg-surface-container-low rounded-lg mb-2"><p class="font-bold text-sm">${h.name}</p><p class="text-[10px] text-on-surface-variant uppercase tracking-wider">${h.category} · ${h.distance}</p></div>`).join('') : '<p class="text-on-surface-variant text-sm">No discoveries yet. Start exploring!</p>';
  alert('History:\n' + state.history.map(h => `${h.name} (${h.category})`).join('\n') || 'No discoveries yet.');
}
function showItinerary() {
  if (!state.isPremium) { showPremiumGate(); return; }
  alert('Itinerary:\n' + (state.savedPlaces.map(p => p.name).join('\n') || 'No saved places yet.'));
}

function setTheme(t) {
  state.theme = t;
  document.documentElement.classList.toggle('dark', t === 'dark');
  // Force full map re-init with correct mapId / styles
  state._mapZoom = 15;
  if (gmap) {
    // Clear old markers
    poiMarkers.forEach(m => { try { m.map = null; } catch(e) { m.setMap(null); } });
    poiMarkers = [];
    if (userMarker) { try { userMarker.map = null; } catch(e) { userMarker.setMap(null); } userMarker = null; }
  }
  // Re-render settings page with the updated toggle states
  renderPage();
}

// ── Globals ──
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

// ── Init ──
navigateTo('map');
