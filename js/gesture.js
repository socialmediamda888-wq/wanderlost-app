/* ═══════════════════════════════════════════════════════════════════════════
   WANDERLOST v4 — GESTURE HANDLER
   Bottom sheet with snap points: dismiss, peek (55% visible), expand (88%).
   Initialised once. Safe to call from any page.
   ═══════════════════════════════════════════════════════════════════════════ */

let _sheet    = null;
let _surface  = null;
let _handle   = null;
let _snap     = 'dismiss';
let _startY   = 0;
let _dragging = false;
let _onDismiss = null;

/* ── Init ─────────────────────────────────────────────────────────────── */

function init({ sheet, surface, handle, onDismiss }) {
  _sheet    = sheet;
  _surface  = surface;
  _handle   = handle;
  _onDismiss = onDismiss;

  // Drag events on handle pill
  _handle.addEventListener('touchstart', onTouchStart, { passive: true });
  _handle.addEventListener('mousedown',  onMouseStart);

  // Also allow drag from sheet header area
  const header = _surface.querySelector('.sheet-header');
  if (header) {
    header.addEventListener('touchstart', onTouchStart, { passive: true });
    header.addEventListener('mousedown',  onMouseStart);
  }
}

/* ── Touch ────────────────────────────────────────────────────────────── */

function onTouchStart(e) {
  _startY   = e.touches[0].clientY;
  _dragging = true;
  _surface.style.transition = 'none';
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend',  onTouchEnd);
}

function onTouchMove(e) {
  if (!_dragging) return;
  e.preventDefault();
  const delta  = e.touches[0].clientY - _startY;
  const curTop = _surface.getBoundingClientRect().top;
  const newTop = Math.max(window.innerHeight * 0.08, curTop + delta);
  _surface.style.transform = `translateY(${newTop}px)`;
  _startY = e.touches[0].clientY;
}

function onTouchEnd() {
  _dragging = false;
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend',  onTouchEnd);
  snapToNearest();
}

/* ── Mouse ────────────────────────────────────────────────────────────── */

function onMouseStart(e) {
  _startY   = e.clientY;
  _dragging = true;
  _surface.style.transition = 'none';
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup',   onMouseEnd);
}

function onMouseMove(e) {
  if (!_dragging) return;
  const delta  = e.clientY - _startY;
  const curTop = _surface.getBoundingClientRect().top;
  const newTop = Math.max(window.innerHeight * 0.08, curTop + delta);
  _surface.style.transform = `translateY(${newTop}px)`;
  _startY = e.clientY;
}

function onMouseEnd() {
  _dragging = false;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup',   onMouseEnd);
  snapToNearest();
}

/* ── Snap Logic ───────────────────────────────────────────────────────── */

function snapToNearest() {
  const pct = (_surface.getBoundingClientRect().top / window.innerHeight) * 100;
  if (pct > 75)      snapTo('dismiss');
  else if (pct > 35) snapTo('peek');
  else               snapTo('expand');
}

function snapTo(position) {
  if (!_surface) return;
  _snap = position;
  const TRANSITION = 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
  _surface.style.transition = TRANSITION;
  const vh = window.innerHeight;

  switch (position) {
    case 'dismiss':
      _surface.style.transform = `translateY(${vh}px)`;
      _sheet.classList.remove('sheet--open');
      setTimeout(() => { if (_onDismiss) _onDismiss(); }, 360);
      break;

    case 'peek':
      // 55% visible → top at 45% of viewport
      _surface.style.transform = `translateY(${vh * 0.45}px)`;
      _sheet.classList.add('sheet--open');
      break;

    case 'expand':
      // 88% visible → top at 12% of viewport
      _surface.style.transform = `translateY(${vh * 0.12}px)`;
      _sheet.classList.add('sheet--open');
      break;
  }
}

/* ── Public API ───────────────────────────────────────────────────────── */

function open() {
  if (!_sheet) return;
  _sheet.style.display = 'grid'; // ensure visible
  // Double rAF so display:grid takes effect before transform
  requestAnimationFrame(() => requestAnimationFrame(() => snapTo('peek')));
}

function dismiss() { snapTo('dismiss'); }
function getSnap() { return _snap; }

const Gesture = { init, open, dismiss, snapTo, getSnap };
export default Gesture;
