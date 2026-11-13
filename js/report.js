// KritZaar problem reports. Nothing is sent automatically. The person can copy, download or e-mail the text.
// A report holds no game file, no file name and no save data: only what we need to reproduce a failure.
const LOG_KEY = 'kz-error-log';
const MAX_LOG = 25;

const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

export function environment() {
  return {
    userAgent: safe(() => navigator.userAgent, ''),
    language: safe(() => navigator.language, ''),
    screen: safe(() => `${screen.width}x${screen.height}@${devicePixelRatio}`, ''),
    touch: safe(() => matchMedia('(pointer: coarse)').matches, false),
    online: safe(() => navigator.onLine, null),
    serviceWorker: safe(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller), false),
    memoryGB: safe(() => navigator.deviceMemory || null, null),
    webgl2: safe(() => !!document.createElement('canvas').getContext('webgl2'), false),
  };
}

export function buildReport({ game = {}, detection = null, error = {}, extra = {} } = {}) {
  return {
    kritzaarReport: 1,
    createdAt: new Date().toISOString(),
    page: safe(() => location.pathname, ''),
    game: {
      id: game.id || null, title: game.title || null, platform: game.platform || null, engine: game.engine || null,
      core: game.core || null, source: game.source || null, sizeBytes: game.size || null, sha256: game.sha256 || null,
    },
    detection: detection ? { platform: detection.platform, engine: detection.engine, confidence: detection.confidence, reasons: detection.reasons } : null,
    error: { code: error.code || 'UNKNOWN', message: String(error.message || '').slice(0, 300) },
    env: environment(),
    ...extra,
  };
}

export function reportToText(r) {
  const g = r.game || {};
  return [
    'KritZaar problem report',
    `When: ${r.createdAt}`,
    `Game: ${g.title || '(not stored)'} [${g.id || '-'}]`,
    `Platform / engine: ${g.platform || '-'} / ${g.engine || '-'}${g.core ? ' (' + g.core + ')' : ''}`,
    `File: ${g.sizeBytes ? Math.round(g.sizeBytes / 1024) + ' KB' : '-'}  sha256 ${g.sha256 ? g.sha256.slice(0, 16) + '…' : '-'}`,
    r.detection ? `Detected as: ${r.detection.platform} (${r.detection.confidence}) ${(r.detection.reasons || []).join('; ')}` : 'Detected as: -',
    `Error: ${r.error.code}: ${r.error.message}`,
    `Browser: ${r.env.userAgent}`,
    `Screen: ${r.env.screen}  touch: ${r.env.touch}  online: ${r.env.online}  webgl2: ${r.env.webgl2}  offline-ready: ${r.env.serviceWorker}`,
    '',
    'Machine-readable copy:',
    JSON.stringify(r),
  ].join('\n');
}

/** Keeps the last few failures on this device so a person can still report one later. */
export function logError(report) {
  try {
    const list = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    list.push(report);
    localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(-MAX_LOG)));
  } catch { /* storage may be blocked */ }
}
export function getLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; } }
export function clearLog() { try { localStorage.removeItem(LOG_KEY); } catch { /* ignore */ } }

export async function reportEmail() {
  try { const r = await fetch('/data/site-config.json', { cache: 'no-cache' }); return (await r.json()).reportEmail || ''; } catch { return ''; }
}

export function downloadReport(report) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'kritzaar-report-' + Date.now() + '.json' });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export async function copyReport(report) {
  const text = reportToText(report);
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
export function mailtoLink(to, report) {
  const body = reportToText(report).slice(0, 1800);
  return 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent('KritZaar problem report: ' + (report.game.title || report.error.code)) + '&body=' + encodeURIComponent(body);
}
