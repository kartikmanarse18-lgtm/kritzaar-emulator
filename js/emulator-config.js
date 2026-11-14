// KritZaar emulator config loader.
// Reads /data/emulator-config.json once, merges it over safe defaults and never throws:
// if the file is missing, blocked or broken, the defaults below are used.
// Text values are never placed into the page as HTML.

export const DEFAULTS = Object.freeze({
  player: { compactToolbar: true, fullscreenBar: true, autoHideBarMs: 2600, landscapeLockOnPhones: true, rotateTip: true, gamepadToast: true },
  controls: { touchDefault: 'auto', gamepadEnabled: true },
  webGames: { preload: 'ask', allowRemember: true, readyPill: true, readyTitle: true, readyVibrate: true, slowLoadHintSec: 40 },
});

const ENUMS = { 'controls.touchDefault': ['auto', 'on', 'off', 'tap'], 'webGames.preload': ['ask', 'always', 'never'] };

function merge(base, over, path = '') {
  const out = {};
  for (const [k, def] of Object.entries(base)) {
    const v = over && Object.prototype.hasOwnProperty.call(over, k) ? over[k] : undefined;
    const p = path ? path + '.' + k : k;
    if (def && typeof def === 'object') out[k] = merge(def, v && typeof v === 'object' ? v : {}, p);
    else if (typeof def === 'boolean') out[k] = typeof v === 'boolean' ? v : def;
    else if (typeof def === 'number') out[k] = Number.isFinite(v) ? Math.min(Math.max(v, 0), 600000) : def;
    else if (typeof def === 'string') out[k] = typeof v === 'string' && (!ENUMS[p] || ENUMS[p].includes(v)) ? v : def;
    else out[k] = def;
  }
  return out;
}

let cached;
/** Resolves to the merged config. Cached after the first call. */
export function getConfig() {
  cached = cached || fetch('/data/emulator-config.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((raw) => merge(DEFAULTS, raw));
  return cached;
}

/** Per-device remembered answers (for example "always load web games in the background"). */
export function getPref(key, fallback = null) {
  try { const v = localStorage.getItem('kz-pref:' + key); return v == null ? fallback : v; } catch { return fallback; }
}
export function setPref(key, value) {
  try { if (value == null) localStorage.removeItem('kz-pref:' + key); else localStorage.setItem('kz-pref:' + key, String(value)); } catch { /* optional */ }
}
