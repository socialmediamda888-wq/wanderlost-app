/* ═══════════════════════════════════════════════════════════════════════════
   WANDERLOST v4 — ROUTER
   Declarative client-side routing. Each route defines:
     render()      → returns HTML string to inject into #content
     onEnter()     → binds events after injection (passed as callback from app.js)
   ═══════════════════════════════════════════════════════════════════════════ */

const CONTENT_EL  = () => document.getElementById('content');
const CATEGORY_BAR = () => document.getElementById('category-bar');

let _currentRoute  = 'map';
let _routeHandlers = {};

/* ── Register Route Handlers ──────────────────────────────────────────── */

function register(routes) {
  _routeHandlers = routes;
}

/* ── Navigate ─────────────────────────────────────────────────────────── */

function navigate(route, params = {}) {
  _currentRoute = route;

  // Show/hide category bar
  const catBar = CATEGORY_BAR();
  if (catBar) catBar.classList.toggle('hidden', route !== 'map');

  // Update bottom nav highlights
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    const active = btn.dataset.page === route;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });

  const handler = _routeHandlers[route];
  const content  = CONTENT_EL();
  if (!content) return;

  if (!handler || route === 'map') {
    // Map page — content area is clear, map shows through
    content.innerHTML = '';
    content.classList.remove('page-active');
    return;
  }

  // Render HTML
  const html = handler.render ? handler.render(params) : '';
  content.innerHTML = html;
  content.classList.add('page-active');

  // Bind events
  if (handler.onEnter) handler.onEnter(params);
}

function getCurrent() { return _currentRoute; }

const Router = { register, navigate, getCurrent };
export default Router;
