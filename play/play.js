// KritZaar web-game page: embeds a third-party game from an allow-listed host (data/site-config.json embedHosts).
// KritZaar does not host these games. Text is set with textContent.
import { loadWebGames, webCardData, pickMore } from '/js/cards.js';
import { cardGrid, hue } from '/js/cards.js';
import { mountHeader, mountFooter, shareButton } from '/js/shell.js';
mountHeader('web'); mountFooter();

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'text') n.textContent = v; else if (v != null && v !== false) n.setAttribute(k, v); } n.append(...kids); return n; };
const id = (new URLSearchParams(location.search).get('g') || '').toLowerCase();

(async () => {
  const games = await loadWebGames();
  const g = /^pg-[a-z0-9-]{1,100}$/.test(id) ? games.find((x) => x.id === id) : null;
  if (!g) { $('kzw-error').hidden = false; return; }
  $('kzw-layout').hidden = false;
  $('kzw-full').before(shareButton(g.title));
  document.title = g.title + ' | KritZaar';
  $('kzw-title').textContent = g.title;
  $('kzw-desc').textContent = g.description;
  $('kzw-how').textContent = g.howTo || 'Use your mouse or touch screen.';
  $('kzw-info').hidden = false;
  (g.genres || []).slice(0, 5).forEach((t) => $('kzw-tags').append(el('li', {}, el('a', { href: '/games/?genre=' + encodeURIComponent(t), text: String(t).replace(/-/g, ' ') }))));
  $('kzw-crumb').append(el('a', { href: '/', text: 'Home' }), ' / ', el('a', { href: '/games/?kind=web', text: 'Web games' }), ' / ', el('span', { text: g.title }));

  const stage = $('kzw-stage');
    stage.classList.toggle('is-portrait', !g.landscape && g.portrait);
  const play = el('button', { type: 'button', class: 'kzw-playbtn', text: '▶ Play' });
  const poster = el('div', { class: 'kzw-poster' }, el('img', { src: g.image, alt: '', class: 'kzw-bg' }), el('div', { class: 'kzw-poster-in' }, el('img', { src: g.icon || g.image, alt: '' }), el('h2', { text: g.title }), play));
  poster.style.setProperty('--h', String(hue(g.id)));
  poster.querySelectorAll('img').forEach((i) => i.addEventListener('error', () => i.remove()));
  stage.append(poster);
  play.addEventListener('click', () => {
    stage.replaceChildren(el('iframe', { src: g.url, title: g.title, allow: 'fullscreen; gamepad; autoplay; accelerometer; gyroscope; clipboard-write; encrypted-media; web-share',
      allowfullscreen: '', referrerpolicy: 'strict-origin-when-cross-origin', sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock allow-orientation-lock allow-presentation' }));
    $('kzw-full').hidden = false;
    const f = stage.querySelector('iframe'); f.focus();
  });
  $('kzw-full').addEventListener('click', () => {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (stage.requestFullscreen) stage.requestFullscreen().catch(() => stage.classList.toggle('kzp-soft-fs')); else stage.classList.toggle('kzp-soft-fs'); // iPhone Safari
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') stage.classList.remove('kzp-soft-fs'); });

  const more = pickMore(games, 8, g.id, g.genres);
  if (more.length) { $('kzw-grid').append(cardGrid(more.map(webCardData))); $('kzw-more').hidden = false; }
})();
