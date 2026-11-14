// KritZaar preview cards and hero slider (CrazyGames-style).
// Asset folder per game follows the KritZaar asset standard: /assets/games/<id>/
//   cover.webp 640x360 | banner.webp 1920x600 | icon.webp 256 | preview.webm + preview.mp4 | shots/1.webp...
// Every file is optional: a missing file falls back to the SVG cover, then to a generated colour card.
// All text is set with textContent.

export const asset = (id, file) => `/assets/games/${encodeURIComponent(id)}/${file}`;
export const hue = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v);
  }
  n.append(...kids);
  return n;
};

/** Previews play only when the person has not asked for less motion or less data. */
export function previewsAllowed() {
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const c = navigator.connection;
    if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return false;
  } catch { /* assume allowed */ }
  return true;
}

/** Picture box: webp asset first, then fallback image, then a generated colour card with the title. */
export function art(g, file, fallbackSrc) {
  const box = el('div', { class: 'kz-art' }, el('span', { class: 'kz-art-ph', text: g.title || g.id }));
  box.style.setProperty('--h', hue(g.id || g.title));
  const src = g.assets ? asset(g.id, file) : fallbackSrc;
  if (src) {
    const img = el('img', { src, alt: '', loading: 'lazy', decoding: 'async' });
    img.addEventListener('error', () => {
      if (fallbackSrc && img.getAttribute('src') !== fallbackSrc) img.src = fallbackSrc; else img.remove();
    }, { once: false });
    box.prepend(img);
  }
  return box;
}

/** A muted looping preview video that only starts loading when asked. */
export function previewVideo(g) {
  const v = el('video', { class: 'kz-pv', muted: '', loop: '', playsinline: '', preload: 'none', 'aria-hidden': 'true', tabindex: '-1' });
  v.muted = true;
  for (const t of ['webm', 'mp4']) v.append(el('source', { src: asset(g.id, 'preview.' + t), type: 'video/' + t }));
  return v;
}

/** Start/stop a preview inside `box` (a card or hero slide). Safe to call repeatedly. */
export function attachPreview(box, g) {
  if (!g.assets || !g.preview) return { start() {}, stop() {} };
  let v = null;
  return {
    start() {
      if (v || !previewsAllowed()) return;
      v = previewVideo(g);
      box.querySelector('.kz-art').append(v);
      v.addEventListener('playing', () => box.classList.add('is-previewing'), { once: true });
      v.play().catch(() => {});
    },
    stop() {
      box.classList.remove('is-previewing');
      if (v) { v.pause(); v.remove(); v = null; }
    }
  };
}

// On touch screens there is no hover, so the card that is mostly on screen plays instead.
let io = null;
const visible = new Map();
function observeForTouch(card, ctl) {
  if (!matchMedia('(hover: none)').matches || !('IntersectionObserver' in window)) return;
  io = io || new IntersectionObserver((entries) => {
    for (const e of entries) { if (e.isIntersecting && e.intersectionRatio >= 0.8) visible.set(e.target, e.target.__kzp); else { visible.delete(e.target); e.target.__kzp.stop(); } }
    let n = 0;
    for (const [, c] of visible) { if (n++ < 1) c.start(); else c.stop(); } // one preview at a time
  }, { threshold: [0, 0.8] });
  card.__kzp = ctl;
  io.observe(card);
}

/**
 * One game tile. g: { id, title, tagline?, genres?, cover?, assets?, preview?, href, badge? , extra? }
 * `extra` is an optional element (for example a compatibility badge) shown on hover.
 */
export function gameCard(g) {
  const info = el('div', { class: 'kz-pc-info' },
    el('b', { class: 'kz-pc-title', text: g.title }),
    el('span', { class: 'kz-pc-sub', text: (g.genres || []).join(' · ') }));
  const hover = el('div', { class: 'kz-pc-hover' }, el('span', { class: 'kz-pc-tag', text: g.tagline || '' }), el('span', { class: 'kz-pc-play', text: '▶ Play' }));
  info.append(hover);
  const a = el('a', { class: 'kz-pc', href: g.href, 'aria-label': 'Play ' + g.title }, art(g, 'cover.webp', g.cover), info);
  if (g.badge) a.append(el('i', { class: 'kz-pc-badge', text: g.badge }));
  if (g.extra) { g.extra.classList.add('kz-pc-extra'); a.append(g.extra); } // compatibility badge stays visible
  const ctl = attachPreview(a, g);
  a.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') ctl.start(); });
  a.addEventListener('pointerleave', ctl.stop);
  a.addEventListener('focus', ctl.start);
  a.addEventListener('blur', ctl.stop);
  observeForTouch(a, ctl);
  return a;
}

export function cardGrid(games) {
  const ul = el('ul', { class: 'kz-pc-grid' });
  for (const g of games) ul.append(el('li', {}, gameCard(g)));
  return ul;
}

/** Category chips. Calls onPick(category|'All'). */
export function chipRow(categories, onPick) {
  const row = el('div', { class: 'kz-chips', role: 'group', 'aria-label': 'Filter by category' });
  ['All', ...categories].forEach((c, i) => {
    const b = el('button', { class: 'kz-chip' + (i ? '' : ' on'), type: 'button', 'aria-pressed': String(!i), text: c });
    b.addEventListener('click', () => {
      row.querySelectorAll('.kz-chip').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      onPick(c);
    });
    row.append(b);
  });
  return row;
}

/** Hero slider of featured games. The active slide plays its preview clip. */
export function mountHero(container, games) {
  container.replaceChildren();
  if (!games.length) { container.hidden = true; return; }
  const hero = el('div', { class: 'kz-hero', role: 'region', 'aria-roledescription': 'carousel', 'aria-label': 'Featured games' });
  const dots = el('div', { class: 'kz-hero-dots' });
  let i = 0, timer = 0, paused = false;
  const slides = games.map((g, k) => {
    const s = el('div', { class: 'kz-slide', role: 'group', 'aria-roledescription': 'slide', 'aria-label': `${k + 1} of ${games.length}: ${g.title}` },
      art(g, 'banner.webp', g.cover),
      el('div', { class: 'kz-slide-cap' },
        el('h2', { text: g.title }), el('p', { text: g.tagline || '' }),
        el('a', { class: 'kz-btn kz-btn--primary kz-slide-play', href: g.href, text: '▶ Play now' })));
    const ctl = attachPreview(s, g);
    s.__ctl = ctl;
    dots.append(el('button', { type: 'button', class: 'kz-hero-dot', 'aria-label': 'Show ' + g.title, onclick: null }));
    hero.append(s);
    return s;
  });
  const show = (k) => {
    i = (k + slides.length) % slides.length;
    slides.forEach((s, j) => {
      const on = j === i;
      s.classList.toggle('on', on);
      if (on) s.removeAttribute('inert'); else s.setAttribute('inert', '');
      dots.children[j].classList.toggle('on', on);
      dots.children[j].setAttribute('aria-current', on ? 'true' : 'false');
      if (on) s.__ctl.start(); else s.__ctl.stop();
    });
  };
  [...dots.children].forEach((d, k) => d.addEventListener('click', () => show(k)));
  hero.append(dots);
  container.append(hero);
  container.hidden = false;
  show(0);
  if (slides.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const tick = () => { if (!paused && !document.hidden) show(i + 1); };
    timer = setInterval(tick, 7000);
    hero.addEventListener('pointerenter', () => { paused = true; });
    hero.addEventListener('pointerleave', () => { paused = false; });
    hero.addEventListener('focusin', () => { paused = true; });
    hero.addEventListener('focusout', () => { paused = false; });
  }
  return () => clearInterval(timer);
}

// ---- Web games (third-party, embedded from their own host; see /data/web-games.json) ----
let webPromise;
export function loadWebGames() {
  webPromise = webPromise || Promise.all([
    fetch('/data/web-games.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : { games: [] })).catch(() => ({ games: [] })),
    fetch('/data/site-config.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]).then(([w, c]) => {
    const hosts = (c.embedHosts || []).map(String);
    return (w.games || []).filter((g) => allowedEmbed(g.url, hosts) && /^https:\/\//.test(g.image || ''));
  });
  return webPromise;
}
export function allowedEmbed(url, hosts) {
  try { const u = new URL(url); return u.protocol === 'https:' && hosts.includes(u.hostname); } catch { return false; }
}
export const webCardData = (g) => ({ id: g.id, title: g.title, tagline: g.description, genres: g.genres, cover: g.image, assets: false, preview: false,
  href: '/play/index.html?g=' + encodeURIComponent(g.id), badge: 'Web game' });
/** n games for a rail: same genre first, then a stable shuffle so the rails differ per game. */
export function pickMore(list, n, key = '', genres = []) {
  const h = (s) => [...(key + s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const scored = list.filter((g) => g.id !== key).map((g) => ({ g, k: (g.genres || []).some((x) => genres.includes(x)) ? 0 : 1, r: h(g.id) }));
  return scored.sort((a, b) => a.k - b.k || a.r - b.r).slice(0, n).map((x) => x.g);
}
