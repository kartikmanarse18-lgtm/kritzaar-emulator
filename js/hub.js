// KritZaar games hub: Originals (first-party, one-click) + Arcade bridge. The third-party catalog is mounted by search-ui.js.
import { loadOriginals } from '/js/catalog.js';
import { compatBadge } from '/js/compat-ui.js';

const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v); } n.append(...kids); return n; };

export async function mountOriginals(container, { max = 99 } = {}) {
  container.textContent = '';
  let games;
  try { games = await loadOriginals(); } catch (e) { container.append(el('p', { class: 'kz-hub-lead', text: e.message })); return; }
  const grid = el('ul', { class: 'kz-hub-grid' });
  for (const g of games.slice(0, max)) {
    const play = el('a', { class: 'kz-btn kz-btn--primary', href: '/emulator/index.html?game=' + encodeURIComponent(g.id), 'aria-label': 'Play ' + g.title, text: 'Play now' });
    grid.append(el('li', {}, el('article', { class: 'kz-hub-card' },
      el('img', { src: g.cover, alt: '', width: '320', height: '180', loading: 'lazy' }),
      el('h3', { text: g.title }), el('p', { text: g.tagline || g.description }),
      el('div', { class: 'kz-hub-row' }, play, compatBadge(g.compat), el('span', { class: 'kz-badge kz-badge--muted', text: 'KritZaar Original' })))));
  }
  container.append(grid);
}

// Arcade bridge: /data/arcade.json is a plain list the Arcade side can publish. Missing file = section stays hidden.
// Shape: { "games": [ { "id": "snake", "title": "Snake", "url": "/arcade/snake/", "thumb": "/arcade/snake.png", "tagline": "..." } ] }
export async function mountArcade(section, container) {
  try {
    const res = await fetch('/data/arcade.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const games = ((await res.json()).games || []).filter((g) => g && typeof g.url === 'string' && g.url.startsWith('/') && !g.url.startsWith('//'));
    if (!games.length) return;
    const grid = el('ul', { class: 'kz-hub-grid' });
    for (const g of games) {
      grid.append(el('li', {}, el('article', { class: 'kz-hub-card' },
        g.thumb && g.thumb.startsWith('/') ? el('img', { src: g.thumb, alt: '', width: '320', height: '180', loading: 'lazy' }) : el('span'),
        el('h3', { text: String(g.title || g.id) }), el('p', { text: String(g.tagline || '') }),
        el('div', { class: 'kz-hub-row' }, el('a', { class: 'kz-btn kz-btn--primary', href: g.url, text: 'Play in Arcade' })))));
    }
    container.replaceChildren(grid); section.hidden = false;
  } catch { /* the Arcade is optional */ }
}
