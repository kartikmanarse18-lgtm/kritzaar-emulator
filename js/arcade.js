// KritZaar full arcade: every game on the site in one browsable grid.
// Sources: Originals (hosted by KritZaar), web games (Playgama feed), classic PC catalog (bring your own file), Arcade bridge.
// The grid draws in batches, so the page stays fast even with hundreds of games. All text uses textContent.
import { gameCard } from '/js/cards.js';
import { loadOriginals, loadCatalog } from '/js/catalog.js';
import { loadWebGames, webCardData } from '/js/cards.js';

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v != null && v !== false) n.setAttribute(k, v); }
  n.append(...kids); return n;
};
const pretty = (s) => String(s).replace(/-/g, ' ');
const json = (url, fallback) => fetch(url, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : fallback)).catch(() => fallback);

/** Every game on the site as card data, tagged with `kind`: original | web | classic | arcade. */
export async function loadAllGames() {
  const [originals, web, classic, arcade] = await Promise.all([
    loadOriginals().catch(() => []),
    loadWebGames().catch(() => []),
    loadCatalog().catch(() => []),
    json('/data/arcade.json', { games: [] }),
  ]);
  const out = [];
  for (const g of originals) out.push({ id: g.id, title: g.title, tagline: g.tagline || g.description, genres: g.genres || [], cover: g.cover, assets: !!g.assets, preview: !!g.preview,
    href: '/emulator/index.html?game=' + encodeURIComponent(g.id), badge: 'Original', kind: 'original', featured: !!g.featured, text: g.description || '' });
  for (const g of web) { const c = webCardData(g); out.push({ ...c, kind: 'web', text: g.description || '' }); }
  for (const g of classic) out.push({ id: g.id, title: g.title, tagline: g.description, genres: g.genres || [], cover: g.cover, assets: false, preview: false,
    href: '/games/' + encodeURIComponent(g.id) + '.html', badge: 'Classic PC', kind: 'classic', text: g.description || '' });
  for (const g of (arcade.games || [])) {
    if (!g || typeof g.url !== 'string' || !g.url.startsWith('/') || g.url.startsWith('//')) continue;
    out.push({ id: String(g.id || g.title), title: String(g.title || g.id), tagline: String(g.tagline || ''), genres: [], href: g.url,
      cover: g.thumb && g.thumb.startsWith('/') && !g.thumb.startsWith('//') ? g.thumb : '', assets: !!g.assets, preview: !!g.preview, badge: 'Arcade', kind: 'arcade', text: '' });
  }
  return out;
}

const KINDS = [['all', 'All games'], ['original', 'Originals'], ['web', 'Web games'], ['classic', 'Classic PC']];

/**
 * Mounts search, filter chips, a grid and a "Show more" button into `container`.
 * opts: { pageSize = 24, heading = true }
 */
export async function mountArcadeHub(container, { pageSize = 24 } = {}) {
  container.replaceChildren(el('p', { class: 'kz-ax-status', role: 'status', text: 'Loading games…' }));
  let all;
  try { all = await loadAllGames(); } catch { all = []; }
  if (!all.length) { container.replaceChildren(el('p', { class: 'kz-ax-status', text: 'The game list could not be loaded. Check your connection and try again.' })); return; }

  const state = { kind: 'all', genre: '', q: new URLSearchParams(location.search).get('q') || '', shown: 0, list: [] };
  const input = el('input', { type: 'search', class: 'kz-ax-search', placeholder: 'Search ' + all.length + ' games', autocomplete: 'off', 'aria-label': 'Search games', value: state.q });
  const count = el('p', { class: 'kz-ax-count', role: 'status', 'aria-live': 'polite' });
  const kindRow = el('div', { class: 'kz-ax-chips', role: 'group', 'aria-label': 'Game type' });
  const genreRow = el('div', { class: 'kz-ax-chips kz-ax-genres', role: 'group', 'aria-label': 'Genre' });
  const grid = el('ul', { class: 'kz-pc-grid kz-ax-grid' });
  const more = el('button', { type: 'button', class: 'kz-btn kz-ax-more', text: 'Show more games' });
  const sentinel = el('div', { class: 'kz-ax-sentinel', 'aria-hidden': 'true' });
  const empty = el('p', { class: 'kz-ax-status', hidden: '', text: 'No games match. Try fewer words or another genre.' });
  container.replaceChildren(el('div', { class: 'kz-ax-bar' }, input, count), kindRow, genreRow, grid, empty, el('div', { class: 'kz-ax-foot' }, more), sentinel);

  const kindCount = (k) => (k === 'all' ? all.length : all.filter((g) => g.kind === k).length);
  for (const [k, label] of KINDS) {
    if (k !== 'all' && !kindCount(k)) continue;
    const b = el('button', { type: 'button', class: 'kz-chip' + (k === state.kind ? ' on' : ''), 'aria-pressed': String(k === state.kind), text: label + ' · ' + kindCount(k) });
    b.dataset.kind = k;
    b.addEventListener('click', () => { state.kind = k; state.genre = ''; sync(); });
    kindRow.append(b);
  }
  const buildGenres = () => {
    const pool = state.kind === 'all' ? all : all.filter((g) => g.kind === state.kind);
    const tally = new Map();
    for (const g of pool) for (const x of g.genres) tally.set(x, (tally.get(x) || 0) + 1);
    const top = [...tally].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 16).map(([x]) => x);
    genreRow.replaceChildren();
    genreRow.hidden = top.length < 2;
    for (const x of top) {
      const b = el('button', { type: 'button', class: 'kz-chip kz-chip--sm' + (x === state.genre ? ' on' : ''), 'aria-pressed': String(x === state.genre), text: pretty(x) });
      b.addEventListener('click', () => { state.genre = state.genre === x ? '' : x; sync(); });
      genreRow.append(b);
    }
  };

  const words = () => state.q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const matches = (g, w) => {
    const hay = (g.title + ' ' + g.genres.join(' ') + ' ' + g.badge + ' ' + g.text).toLowerCase();
    return w.every((x) => hay.includes(x));
  };
  // Originals first (they work with one click), then everything else in a stable mix so genres are not clumped.
  const rank = (g) => (g.kind === 'original' ? 0 : g.kind === 'web' ? 1 : 2);

  function filter() {
    const w = words();
    state.list = all
      .filter((g) => (state.kind === 'all' || g.kind === state.kind) && (!state.genre || g.genres.includes(state.genre)) && (!w.length || matches(g, w)))
      .sort((a, b) => (w.length ? (b.title.toLowerCase().startsWith(w[0]) ? 1 : 0) - (a.title.toLowerCase().startsWith(w[0]) ? 1 : 0) : 0) || rank(a) - rank(b));
  }
  function draw(reset) {
    if (reset) { grid.replaceChildren(); state.shown = 0; }
    const next = state.list.slice(state.shown, state.shown + pageSize);
    for (const g of next) grid.append(el('li', {}, gameCard(g)));
    state.shown += next.length;
    const left = state.list.length - state.shown;
    more.hidden = left <= 0;
    more.textContent = 'Show ' + Math.min(left, pageSize) + ' more (' + left + ' left)';
    empty.hidden = state.list.length > 0;
    count.textContent = state.list.length === all.length ? all.length + ' games' : state.list.length + ' of ' + all.length + ' games';
  }
  function sync() {
    kindRow.querySelectorAll('.kz-chip').forEach((b) => { const on = b.dataset.kind === state.kind; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    buildGenres(); filter(); draw(true);
  }

  let t = 0;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = input.value; filter(); draw(true); }, 120); });
  more.addEventListener('click', () => draw(false));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => { if (e[0].isIntersecting && state.shown < state.list.length) draw(false); }, { rootMargin: '600px 0px' }).observe(sentinel);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
  });
  sync();
  return { games: all };
}

/** Featured slider over every kind: marked originals first, then the first web games with good art. */
export async function pickFeatured(max = 5) {
  const all = await loadAllGames();
  const feat = all.filter((g) => g.featured);
  const rest = all.filter((g) => !g.featured && g.kind === 'original');
  const web = all.filter((g) => g.kind === 'web').slice(0, 3);
  return feat.concat(rest, web).slice(0, max);
}
