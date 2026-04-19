/* ═══════════════════════════════════════════════════════════════════════════
   WANDERLOST v4 — DISCOVERY ENGINE
   Secret recipe: >4.8★ places loved by locals (80% local-language reviews).
   Google Places API (New) + Firestore persistence.
   ═══════════════════════════════════════════════════════════════════════════ */

import { db }  from './firebase-config.js';
import Auth    from './auth.js';
import Shell   from './shell.js';

import {
  collection, addDoc, updateDoc, increment,
  doc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

/* ── Category Map (13 categories) ────────────────────────────────────── */

const CATEGORIES = {
  all:        { types: [],                                  icon: 'explore',        label: 'All' },
  restaurants:{ types: ['restaurant'],                      icon: 'restaurant',     label: 'Restaurants' },
  takeaway:   { types: ['meal_takeaway','meal_delivery'],   icon: 'takeout_dining', label: 'Take-away' },
  cafes:      { types: ['cafe'],                            icon: 'coffee',         label: 'Cafes' },
  bakeries:   { types: ['bakery'],                          icon: 'bakery_dining',  label: 'Bakeries' },
  bars:       { types: ['bar'],                             icon: 'local_bar',      label: 'Bars' },
  parks:      { types: ['park'],                            icon: 'park',           label: 'Parks' },
  libraries:  { types: ['library'],                         icon: 'local_library',  label: 'Libraries' },
  bookstores: { types: ['book_store'],                      icon: 'menu_book',      label: 'Bookstores' },
  museums:    { types: ['museum'],                          icon: 'museum',         label: 'Museums' },
  galleries:  { types: ['art_gallery'],                     icon: 'palette',        label: 'Galleries' },
  markets:    { types: ['supermarket','grocery_or_supermarket'], icon: 'storefront', label: 'Markets' },
  viewpoints: { types: ['tourist_attraction','point_of_interest'], icon: 'landscape', label: 'Viewpoints' },
  artisan:    { types: ['store','home_goods_store'],         icon: 'brush',         label: 'Artisan' },
};

/* ── Secret Recipe Constants ──────────────────────────────────────────── */
const DEFAULT_RADIUS     = 5000;
const MIN_RATING         = 4.8;
const MIN_REVIEW_COUNT   = 20;
const LOCAL_REVIEW_RATIO = 0.80;
const FREE_DISCOVERIES   = 3;

/* ── Country → Language Map ───────────────────────────────────────────── */
const COUNTRY_LANG = {
  RO:'ro', IT:'it', ES:'es', FR:'fr', DE:'de', PT:'pt', GR:'el', NL:'nl',
  PL:'pl', CZ:'cs', HU:'hu', HR:'hr', BG:'bg', RS:'sr', SK:'sk', AT:'de',
  CH:'de', BE:'nl', SE:'sv', NO:'no', DK:'da', FI:'fi', EE:'et', LV:'lv',
  LT:'lt', SI:'sl', BA:'bs', MK:'mk', AL:'sq', ME:'sr',
  JP:'ja', KR:'ko', TH:'th', VN:'vi', ID:'id', TW:'zh', CN:'zh', MY:'ms', PH:'tl',
  BR:'pt', MX:'es', AR:'es', CL:'es', CO:'es',
  TR:'tr', IL:'he', AE:'ar', SA:'ar',
};

const TOURIST_LANGS = new Set(['en','de','fr','zh','ja','ko','ru']);

let _detectedLang    = null;
let _detectedCountry = null;

async function detectLocalLanguage(lat, lng) {
  if (_detectedLang) return _detectedLang;

  try {
    if (window.google?.maps?.Geocoder) {
      const geocoder = new google.maps.Geocoder();
      const res = await geocoder.geocode({ location: { lat, lng } });
      if (res?.results?.length > 0) {
        for (const result of res.results) {
          const country = result.address_components?.find(c => c.types?.includes('country'));
          if (country?.short_name) {
            _detectedCountry = country.short_name;
            _detectedLang = COUNTRY_LANG[country.short_name] || null;
            console.log(`[Discovery] Local lang: ${_detectedLang} (${_detectedCountry})`);
            return _detectedLang;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Discovery] Geocoder error:', err.message);
  }

  _detectedLang = navigator.language?.split('-')[0] || null;
  return _detectedLang;
}

/* ── Local Love Filter (the secret sauce) ────────────────────────────── */

function isLocallyLoved(place, localLang) {
  if (!localLang) return !isTouristHeavy(place);
  const reviews = place.reviews;
  if (!reviews || reviews.length === 0) return true;

  let localCount = 0;
  for (const r of reviews) {
    const lang = r.languageCode || r.language || '';
    if (lang === localLang || lang.startsWith(localLang)) localCount++;
  }

  const threshold = reviews.length <= 2 ? 0.5 : LOCAL_REVIEW_RATIO;
  return (localCount / reviews.length) >= threshold;
}

function isTouristHeavy(place) {
  const reviews = place.reviews;
  if (!reviews || reviews.length === 0) return false;
  let touristCount = 0;
  for (const r of reviews) {
    const lang = r.languageCode || r.language || '';
    if (TOURIST_LANGS.has(lang)) touristCount++;
  }
  return (touristCount / reviews.length) >= 0.6;
}

/* ── Batch state ──────────────────────────────────────────────────────── */
let _batch  = [];
let _bIdx   = 0;
let _count  = 0; // session discovery count

/* ── Haversine ────────────────────────────────────────────────────────── */

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLon  = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatDistance(meters) {
  const unit = Shell.getDistUnit();
  if (unit === 'feet') {
    const ft = meters * 3.28084;
    return ft < 5280 ? `${Math.round(ft)} ft` : `${(ft/5280).toFixed(1)} mi`;
  }
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters/1000).toFixed(1)}km`;
}

/* ── Core: discover ───────────────────────────────────────────────────── */

async function discover(userLocation, category = 'all', opts = {}) {
  if (!userLocation?.lat || !userLocation?.lng) return null;

  const premium = Auth.isPremium();

  // Gate: free user hit limit
  if (!premium && _count >= FREE_DISCOVERIES) return { _needsPremium: true };

  // Gate: non-all category requires premium (fires here, not at pill click)
  if (!premium && category !== 'all') return { _needsPremium: true, _reason: 'category' };

  // Use existing batch if available
  if (_batch.length > 0 && _bIdx < _batch.length) {
    const result = _batch[_bIdx++];
    await persistDiscovery(result);
    return result;
  }

  // Fetch new batch from Google Places API
  if (!window.google?.maps?.places?.Place) {
    return discoverMock(userLocation, category, opts);
  }

  try {
    const localLang = await detectLocalLanguage(userLocation.lat, userLocation.lng);
    const catData   = CATEGORIES[category] || CATEGORIES.all;

    const request = {
      fields: [
        'displayName','formattedAddress','location',
        'rating','userRatingCount','priceLevel',
        'editorialSummary','primaryTypeDisplayName','primaryType',
        'regularOpeningHours','id','reviews',
      ],
      locationRestriction: {
        center: { lat: userLocation.lat, lng: userLocation.lng },
        radius: opts.radius || DEFAULT_RADIUS,
      },
      maxResultCount: 20,
    };

    if (catData.types.length > 0) request.includedPrimaryTypes = catData.types;

    const { places } = await google.maps.places.Place.searchNearby(request);
    if (!places?.length) return discoverMock(userLocation, category, opts);

    // ── SECRET RECIPE ──────────────────────────────────────────────────
    // Gate 1: Rating >= 4.8★
    // Gate 2: >= 20 reviews
    // Gate 3: 80% reviews in local language
    // ──────────────────────────────────────────────────────────────────
    let filtered = places.filter(p => {
      if ((p.rating || 0) < MIN_RATING)        return false;
      if ((p.userRatingCount || 0) < MIN_REVIEW_COUNT) return false;
      if (!isLocallyLoved(p, localLang))       return false;
      return true;
    });

    if (opts.openNow) {
      filtered = filtered.filter(p => {
        try { return p.regularOpeningHours?.isOpen?.() !== false; } catch { return true; }
      });
    }

    // Relaxation 1: drop local-language gate
    if (filtered.length < 3) {
      filtered = places.filter(p => (p.rating || 0) >= MIN_RATING && (p.userRatingCount || 0) >= MIN_REVIEW_COUNT);
    }
    // Relaxation 2: drop to 4.5★
    if (filtered.length < 3) {
      filtered = places.filter(p => (p.rating || 0) >= 4.5);
    }

    if (!filtered.length) return discoverMock(userLocation, category, opts);

    // Shuffle
    for (let i = filtered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }

    _batch = filtered.map(p => buildResult(p, userLocation));
    _bIdx  = 1;

    const result = _batch[0];
    await persistDiscovery(result);
    return result;

  } catch (err) {
    console.error('[Discovery] Error:', err);
    return discoverMock(userLocation, category, opts);
  }
}

/* ── Next in batch ────────────────────────────────────────────────────── */

async function discoverNext(userLocation) {
  if (_batch.length > 0 && _bIdx < _batch.length) {
    const result = _batch[_bIdx++];
    await persistDiscovery(result);
    return result;
  }
  // Batch exhausted
  _batch = [];
  _bIdx  = 0;
  return null;
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

async function persistDiscovery(result) {
  _count++;
  const user = Auth.getUser();
  if (!user) return;

  try {
    await addDoc(collection(db, 'discoveries'), {
      userId:      user.uid,
      placeId:     result.placeId,
      name:        result.name,
      description: result.description,
      category:    result.category,
      location:    result.location,
      distance:    result.distance,
      isOpen:      result.isOpen,
      address:     result.address,
      rating:      result.rating,
      priceLevel:  result.priceLevel,
      discoveredAt:serverTimestamp(),
    });
    await updateDoc(doc(db, 'users', user.uid), { totalDiscoveries: increment(1) });
  } catch (err) {
    console.warn('[Discovery] Persist failed:', err.message);
  }
}

function buildResult(place, userLocation) {
  const loc  = place.location;
  const lat  = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
  const lng  = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
  const dist = haversine(userLocation.lat, userLocation.lng, lat, lng);

  let isOpen = null;
  try { isOpen = place.regularOpeningHours?.isOpen?.() ?? null; } catch { /* */ }

  const prices = { FREE:'Free', INEXPENSIVE:'$', MODERATE:'$$', EXPENSIVE:'$$$', VERY_EXPENSIVE:'$$$$' };

  return {
    placeId:      place.id || '',
    name:         place.displayName || 'Unknown Place',
    description:  place.editorialSummary || '',
    category:     place.primaryTypeDisplayName || place.primaryType || 'Place',
    location:     { lat, lng },
    distance:     Math.round(dist),
    distanceText: formatDistance(dist),
    isOpen,
    address:      place.formattedAddress || '',
    rating:       place.rating || null,
    ratingCount:  place.userRatingCount || null,
    priceLevel:   prices[place.priceLevel] || null,
  };
}

function resetBatch() { _batch = []; _bIdx = 0; }
function getFreeRemaining() { return Math.max(0, FREE_DISCOVERIES - _count); }
function getCount() { return _count; }

/* ── Mock Data (when Places API unavailable / localhost) ─────────────── */

function discoverMock(userLocation, category, opts) {
  if (!Auth.isPremium() && _count >= FREE_DISCOVERIES) return { _needsPremium: true };

  const mocks = [
    { name:"Caru' cu Bere",       description:'Stunning Neo-Gothic beer hall with traditional Romanian cuisine, beloved by Bucharest locals since 1879.', category:'Restaurant', address:'Strada Stavropoleos 5, București', rating:4.9, priceLevel:'$$', isOpen:true },
    { name:'Origo Coffee',        description:'Third-wave specialty coffee roasted in-house. Minimalist interior, locals-only vibe.',                  category:'Café',       address:'Str. Lipscani 9, București',       rating:4.8, priceLevel:'$',  isOpen:true },
    { name:'Cărturești Carusel',  description:'Six floors of books in a restored 19th-century building. The most beautiful bookstore in Bucharest.',  category:'Bookstore',  address:'Strada Lipscani 55, București',    rating:4.8, priceLevel:'$',  isOpen:true },
    { name:'Parcul Natural Văcărești', description:'Urban delta — wetlands, wildlife, and walking trails where Bucharest meets nature.',              category:'Park',       address:'Splaiul Unirii, București',        rating:4.9, priceLevel:'Free',isOpen:true },
    { name:'Muzeu Kitsch Românesc',description:'A quirky celebration of Romanian pop culture and nostalgia — delightfully ironic.',                   category:'Museum',     address:'Strada Covaci 6, București',       rating:4.8, priceLevel:'$',  isOpen:false},
    { name:'Acuarela Bistro',     description:'Farm-to-table bistro with seasonal Romanian fusion. The secret menu changes weekly.',                  category:'Restaurant', address:'Str. Brezoianu 23-25, București',  rating:4.9, priceLevel:'$$$',isOpen:true },
    { name:'Energiea',            description:'Plant-based café with raw desserts and cold-pressed juices. Quiet courtyard seating.',                  category:'Café',       address:'Str. Brezoianu 10, București',     rating:4.8, priceLevel:'$',  isOpen:true },
    { name:'Atelierul de Ceramică',description:'Artisan pottery workshop where you create your own pieces. Classes run daily.',                       category:'Workshop',   address:'Str. Selari 14, București',        rating:4.9, priceLevel:'$$', isOpen:true },
    { name:'Piața Obor',          description:'The most authentic local market — fresh produce, cheeses, and Romanian specialties since 1862.',       category:'Market',     address:'Șos. Colentina 2, București',      rating:4.8, priceLevel:'$',  isOpen:true },
    { name:'Sky Tower Viewpoint', description:'Highest point in Bucharest. 360° panoramic views of the city and surrounding plains.',                 category:'Viewpoint',  address:'Calea Floreasca 246B, București',  rating:4.8, priceLevel:'$$', isOpen:true },
  ];

  const mock = mocks[Math.floor(Math.random() * mocks.length)];
  const lat  = userLocation.lat + (Math.random() - 0.5) * 0.018;
  const lng  = userLocation.lng + (Math.random() - 0.5) * 0.018;
  const dist = haversine(userLocation.lat, userLocation.lng, lat, lng);

  const result = {
    placeId: 'mock_' + Date.now(),
    name: mock.name, description: mock.description,
    category: mock.category, location: { lat, lng },
    distance: Math.round(dist), distanceText: formatDistance(dist),
    isOpen: mock.isOpen, address: mock.address,
    rating: mock.rating, ratingCount: null, priceLevel: mock.priceLevel,
  };

  persistDiscovery(result);
  return result;
}

const Discovery = {
  discover, discoverNext, resetBatch,
  getFreeRemaining, getCount,
  CATEGORIES, FREE_DISCOVERIES,
  formatDistance,
};

export default Discovery;
