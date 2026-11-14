// KritZaar games hub: Originals (first-party, one-click) + Arcade bridge. The third-party catalog is mounted by search-ui.js.
import { loadOriginals } from '/js/catalog.js';
import { compatBadge } from '/js/compat-ui.js';
import { cardGrid, chipRow, mountHero as mountHeroSlider, gameCard } from '/js/cards.js';

const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v); } n.append(...kids); return n; };

const toCard = (g) => ({ id: g.id, title: g.title, tagline: g.tagline || g.description, genres: g.genres, cover: g.cover, assets: !!g.assets, preview: !!g.preview,
  href: '/emulator/index.html?game=' + encodeURIComponent(g.id), extra: compatBadge(g.compat) });

export async function mountOriginals(container, { max = 99, chips = false } = {}) {
  container.textContent = '';
  let games;
  try { games = (await loadOriginals()).slice(0, max); } catch (e) { container.append(el('p', { class: 'kz-hub-lead', text: e.message })); return; }
  const cards = games.map(toCard);
  const holder = el('div');
  const draw = (cat) => holder.replaceChildren(cardGrid(cat === 'All' ? cards : cards.filter((c) => (c.genres || []).includes(cat))));
  const cats = [...new Set(games.flatMap((g) => g.genres || []))];
  if (chips && cats.length > 1) container.append(chipRow(cats, draw));
  container.append(holder);
  draw('All');
}

// Featured slider: games marked "featured", or the first three published Originals.
export async function mountHero(container, { max = 4 } = {}) {
  let games;
  try { games = await loadOriginals(); } catch { container.hidden = true; return; }
  const feat = games.filter((g) => g.featured);
  mountHeroSlider(container, (feat.length ? feat : games).slice(0, max).map(toCard));
}

// Arcade bridge: /data/arcade.json is a plain list the Arcade side can publish. Missing file = section stays hidden.
// Shape: { "games": [ { "id": "snake", "title": "Snake", "url": "/arcade/snake/", "thumb": "/arcade/snake.png", "tagline": "..." } ] }
export async function mountArcade(section, container) {
  try {
    const res = await fetch('/data/arcade.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const games = ((await res.json()).games || []).filter((g) => g && typeof g.url === 'string' && g.url.startsWith('/') && !g.url.startsWith('//'));
    if (!games.length) return;
    const grid = cardGrid(games.map((g) => ({ id: String(g.id || g.title), title: String(g.title || g.id), tagline: String(g.tagline || ''), href: g.url,
      cover: g.thumb && g.thumb.startsWith('/') && !g.thumb.startsWith('//') ? g.thumb : '', assets: !!g.assets, preview: !!g.preview, badge: 'Arcade' })));
    container.replaceChildren(grid); section.hidden = false;
  } catch { /* the Arcade is optional */ }
}
