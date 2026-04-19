/* ═══════════════════════════════════════════════════════════════════════════
   WANDERLOST v4 — MAP MODULE
   Google Maps with custom dark/light game styles.
   AdvancedMarkerElement for pulsating discovery dots.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── State ────────────────────────────────────────────────────────────── */
let _map        = null;
let _isReady    = false;
let _userLat    = null;
let _userLng    = null;
let _userMarker = null;
let _markers    = [];

/* ── Map Styles ───────────────────────────────────────────────────────── */

const STYLE_DARK = [
  { elementType: 'geometry',            stylers: [{ color: '#0d1117' }] },
  { elementType: 'labels.icon',         stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#3d4f5f' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#0d1117' }] },
  { featureType: 'poi',                 elementType: 'geometry',          stylers: [{ color: '#111a22' }] },
  { featureType: 'poi',                 elementType: 'labels',            stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park',            elementType: 'geometry',          stylers: [{ color: '#0a1f12' }] },
  { featureType: 'road',                elementType: 'geometry',          stylers: [{ color: '#141e28' }] },
  { featureType: 'road',                elementType: 'labels',            stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway',        elementType: 'geometry',          stylers: [{ color: '#1a2636' }] },
  { featureType: 'road.arterial',       elementType: 'geometry',          stylers: [{ color: '#151f2a' }] },
  { featureType: 'transit',             elementType: 'geometry',          stylers: [{ color: '#111a22' }] },
  { featureType: 'transit',             elementType: 'labels',            stylers: [{ visibility: 'off' }] },
  { featureType: 'water',               elementType: 'geometry',          stylers: [{ color: '#081018' }] },
  { featureType: 'water',               elementType: 'labels.text',       stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative',      elementType: 'geometry.stroke',   stylers: [{ color: '#1a2636' }] },
  { featureType: 'administrative',      elementType: 'labels.text.fill',  stylers: [{ color: '#2a3a4a' }] },
];

const STYLE_LIGHT = [
  { elementType: 'geometry',            stylers: [{ color: '#f0f4f8' }] },
  { elementType: 'labels.icon',         stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#8898aa' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#f0f4f8' }] },
  { featureType: 'poi',                 elementType: 'labels',            stylers: [{ visibility: 'off' }] },
  { featureType: 'poi',                 elementType: 'geometry',          stylers: [{ color: '#e8ecf0' }] },
  { featureType: 'poi.park',            elementType: 'geometry',          stylers: [{ color: '#e0f0e0' }] },
  { featureType: 'road',                elementType: 'geometry',          stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',                elementType: 'labels',            stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway',        elementType: 'geometry',          stylers: [{ color: '#e0e4e8' }] },
  { featureType: 'transit',             elementType: 'labels',            stylers: [{ visibility: 'off' }] },
  { featureType: 'water',               elementType: 'geometry',          stylers: [{ color: '#c0daf0' }] },
];

/* ── Suppress Google Maps Error Dialog ───────────────────────────────── */
// Fires when API key referrer restrictions don't match localhost.
// Purely cosmetic — map loads and works fine.

function suppressMapsError() {
  function nuke() {
    document.querySelectorAll(
      '.gm-err-container, .gm-err-content, .gm-err-autocomplete, .gm-err-box, .gm-style-cc'
    ).forEach(el => {
      el.style.setProperty('display', 'none', 'important');
      el.remove();
    });
  }
  nuke();
  const iv = setInterval(nuke, 50);
  setTimeout(() => clearInterval(iv), 10000);
}

/* ── Init ─────────────────────────────────────────────────────────────── */

function init() {
  const container = document.getElementById('gmap');
  if (!container || !window.google?.maps) {
    console.warn('[Map] Google Maps not available');
    return;
  }

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

  _map = new google.maps.Map(container, {
    center:            { lat: 44.4268, lng: 26.1025 }, // Bucharest default
    zoom:              13,
    disableDefaultUI:  true,
    gestureHandling:   'greedy',
    mapId:             'DEMO_MAP_ID',                  // Required for AdvancedMarkerElement
    styles:            isDark ? STYLE_DARK : STYLE_LIGHT,
    backgroundColor:   isDark ? '#0d1117' : '#f0f4f8',
  });

  suppressMapsError();
  _map.addListener('idle', suppressMapsError);

  _isReady = true;
  console.log('[Map] Initialized');
  requestUserLocation();
}

/* ── Theme ────────────────────────────────────────────────────────────── */

function setTheme(isDark) {
  if (!_map) return;
  _map.setOptions({
    styles:          isDark ? STYLE_DARK : STYLE_LIGHT,
    backgroundColor: isDark ? '#0d1117' : '#f0f4f8',
  });
}

/* ── User Location ────────────────────────────────────────────────────── */

function requestUserLocation() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    pos => {
      _userLat = pos.coords.latitude;
      _userLng = pos.coords.longitude;
      if (_map) {
        _map.panTo({ lat: _userLat, lng: _userLng });
        _map.setZoom(14);
        addUserMarker();
      }
      console.log('[Map] Location acquired');
    },
    err => console.warn('[Map] Geolocation failed:', err.message),
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
  );
}

function getUserLocation() {
  if (_userLat === null || _userLng === null) return null;
  return { lat: _userLat, lng: _userLng };
}

/* ── User Marker ──────────────────────────────────────────────────────── */

function addUserMarker() {
  if (!_map || _userLat === null || _userMarker) return;

  const el = document.createElement('div');
  el.className = 'user-marker';
  el.innerHTML = `<div class="user-marker-ring"></div><div class="user-marker-dot"></div>`;

  try {
    if (google.maps.marker?.AdvancedMarkerElement) {
      _userMarker = new google.maps.marker.AdvancedMarkerElement({
        map: _map, position: { lat: _userLat, lng: _userLng }, content: el, title: 'You are here',
      });
      return;
    }
  } catch { /* fall through */ }

  _userMarker = new google.maps.Marker({
    position: { lat: _userLat, lng: _userLng }, map: _map,
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8,
            fillColor: '#2CD7D7', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 },
  });
}

/* ── Discovery Markers ────────────────────────────────────────────────── */

function addDiscoveryMarker({ lat, lng, title, onClick }) {
  if (!_map) return null;

  const el = document.createElement('div');
  el.className = 'discovery-dot';
  el.innerHTML = `<div class="discovery-dot-pulse"></div><div class="discovery-dot-core"></div>`;
  if (onClick) { el.style.cursor = 'pointer'; el.addEventListener('click', onClick); }

  let marker;
  try {
    if (google.maps.marker?.AdvancedMarkerElement) {
      marker = new google.maps.marker.AdvancedMarkerElement({
        map: _map, position: { lat, lng }, content: el, title: title || '',
      });
    } else throw new Error('');
  } catch {
    marker = new google.maps.Marker({
      position: { lat, lng }, map: _map, title: title || '',
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10,
              fillColor: '#2CD7D7', fillOpacity: 0.9, strokeColor: '#fff', strokeWeight: 2 },
      animation: google.maps.Animation.DROP,
    });
  }

  _markers.push(marker);
  return marker;
}

function clearMarkers() {
  _markers.forEach(m => {
    if (m.map !== undefined) m.map = null;    // AdvancedMarkerElement
    if (m.setMap) m.setMap(null);             // Classic marker
  });
  _markers = [];
}

function panToDiscovery(lat, lng, title, onClick) {
  if (!_map) return;
  clearMarkers();
  _map.panTo({ lat, lng });
  _map.setZoom(15);
  return addDiscoveryMarker({ lat, lng, title, onClick });
}

const WanderlostMap = {
  init, setTheme,
  addDiscoveryMarker, clearMarkers, panToDiscovery,
  getUserLocation,
  getMap:    () => _map,
  isReady:   () => _isReady,
};

export default WanderlostMap;
