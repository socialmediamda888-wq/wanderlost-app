/* ═══════════════════════════════════════════════════════════════════════════
   WANDERLOST v4 — SHELL
   Theme management + splash screen dismissal. No logic beyond this.
   ═══════════════════════════════════════════════════════════════════════════ */

const THEME_KEY   = 'wanderlost-theme';
const DIST_KEY    = 'wanderlost-dist-unit';

/* ── Theme ────────────────────────────────────────────────────────────── */

function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

/* ── Distance Unit ────────────────────────────────────────────────────── */

function getDistUnit() {
  return localStorage.getItem(DIST_KEY) || 'meters';
}

function toggleDistUnit() {
  const next = getDistUnit() === 'meters' ? 'feet' : 'meters';
  localStorage.setItem(DIST_KEY, next);
  return next;
}

/* ── Splash ───────────────────────────────────────────────────────────── */

function dismissSplash() {
  const splash = document.getElementById('splash');
  const app    = document.getElementById('app');
  if (!splash) { if (app) app.classList.add('app--ready'); return; }

  setTimeout(() => {
    splash.classList.add('splash--out');
    setTimeout(() => {
      splash.close?.();
      splash.remove();
      if (app) app.classList.add('app--ready');
    }, 450);
  }, 2200);
}

/* ── Init ─────────────────────────────────────────────────────────────── */

function init() {
  applyTheme(getTheme());
}

const Shell = { init, getTheme, applyTheme, toggleTheme, getDistUnit, toggleDistUnit, dismissSplash };
export default Shell;
