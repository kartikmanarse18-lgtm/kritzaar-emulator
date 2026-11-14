// Homepage: full-width hero, category tiles, and CrazyGames-style rails.
import { loadAllGames, pickFeatured } from '/js/arcade.js';
import { mountHero, gameCard } from '/js/cards.js';
import { mountHeader, mountFooter, rail, skeletonRails } from '/js/shell.js';
import { favList } from '/js/favs.js';

const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v != null && v !== false) n.setAttribute(k, v); } n.append(...kids); return n; };
const pretty = (s) => String(s).replace(/-/g, ' ');
mountHeader('home'); mountFooter();

const heroEl = document.getElementById('kz-hero');
pickFeatured(5).then((l) => mountHero(heroEl, l)).catch(() => { heroEl.hidden = true; });

(async () => {
  const root = document.getElementById('kz-rails');
  const skel = skeletonRails(3); root.append(skel);
  const all = await loadAllGames().catch(() => []);
  if (!all.length) { root.append(el('p', { text: 'The game list could not be loaded. Check your connection and try again.' })); return; }
  const cards = (list) => list.map(gameCard);
  // Category tiles from the most common genres.
  const tally = new Map(); for (const g of all) for (const x of g.genres || []) tally.set(x, (tally.get(x) || 0) + 1);
  const top = [...tally].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([x]) => x);
  const cats = el('nav', { class: 'kz-cats', 'aria-label': 'Categories' });
  for (const x of top) cats.append(el('a', { href: '/games/?genre=' + encodeURIComponent(x), text: pretty(x) }));
  skel.remove(); root.append(cats);
  const favHost = el('div'); root.append(favHost);
  const drawFavs = () => { const l = favList().map((id) => all.find((g) => g.id === id)).filter(Boolean); favHost.replaceChildren(); if (l.length) favHost.append(rail('My favorites', l.map(gameCard))); };
  drawFavs(); document.addEventListener('kz-favs', drawFavs);

  const originals = all.filter((g) => g.kind === 'original');
  const web = all.filter((g) => g.kind === 'web');
  const classic = all.filter((g) => g.kind === 'classic');
  if (web.length) root.append(rail('Trending now', cards(web.slice(0, 14)), '/games/?kind=web'));
  if (originals.length) root.append(rail('KritZaar Originals', cards(originals), '/games/?kind=original'));
  if (classic.length) root.append(rail('Classic PC games', cards(classic), '/games/?kind=classic'));
  for (const x of top.slice(0, 5)) {
    const list = all.filter((g) => (g.genres || []).includes(x)).slice(0, 14);
    if (list.length >= 4) root.append(rail(pretty(x).replace(/^./, (c) => c.toUpperCase()) + ' games', cards(list), '/games/?genre=' + encodeURIComponent(x)));
  }
  root.append(el('div', { class: 'kz-cta' }, el('a', { class: 'kz-btn kz-btn--primary', href: '/games/', text: 'Browse all ' + all.length + ' games' })));
})();
