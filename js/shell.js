// Shared header + footer for every public page. Text is set with textContent.
import { icon, iconLabel } from '/js/icons.js';
const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v != null && v !== false) n.setAttribute(k, v); } n.append(...kids); return n; };
const NAV = [['home', '/', 'Home'], ['games', '/games/', 'All games'], ['original', '/games/?kind=original', 'Originals'], ['web', '/games/?kind=web', 'Web games'], ['classic', '/games/?kind=classic', 'Classic PC'], ['library', '/library/', 'My Games']];

export function mountHeader(active = '') {
  document.body.classList.add('kz-site');
  const q = new URLSearchParams(location.search).get('q') || '';
  const input = el('input', { type: 'search', name: 'q', placeholder: 'Search games', 'aria-label': 'Search games', autocomplete: 'off', value: q });
  const form = el('form', { class: 'kz-search', action: '/games/', role: 'search' }, input);
  form.insertAdjacentHTML('afterbegin', '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>');
  const box = el('ul', { class: 'kz-sugg', role: 'listbox', hidden: '' });
  form.append(box);
  let all = null, sel = -1;
  const load = () => all || (all = import('/js/arcade.js').then((m) => m.loadAllGames()).catch(() => []));
  const draw = async () => {
    const w = input.value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    box.replaceChildren(); sel = -1;
    if (!w.length) { box.hidden = true; return; }
    const list = (await load()).filter((g) => w.every((x) => (g.title + ' ' + (g.genres || []).join(' ')).toLowerCase().includes(x))).slice(0, 7);
    for (const g of list) {
      const img = el('img', { src: g.assets ? '/assets/games/' + encodeURIComponent(g.id) + '/icon.webp' : g.cover, alt: '', width: '40', height: '40' });
      img.addEventListener('error', () => img.remove());
      box.append(el('li', { role: 'option' }, el('a', { href: g.href }, img, el('span', { class: 'kz-sugg-t', text: g.title }), el('small', { text: g.badge }))));
    }
    if (!list.length) box.append(el('li', { class: 'kz-sugg-none', text: 'No games found. Press Enter to search anyway.' }));
    box.hidden = false;
  };
  let t = 0;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 100); });
  input.addEventListener('focus', () => { load(); if (input.value) draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { box.hidden = true; return; }
    const items = [...box.querySelectorAll('a')];
    if (e.key === 'Enter' && sel >= 0 && items[sel]) { e.preventDefault(); location.href = items[sel].href; return; }
    if (!items.length || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((a, i) => a.classList.toggle('on', i === sel));
  });
  document.addEventListener('click', (e) => { if (!form.contains(e.target)) box.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); } });
  const nav = el('nav', { class: 'kz-nav', 'aria-label': 'Main' });
  for (const [k, href, label] of NAV) { const a = el('a', { href, text: label, class: k === 'home' || k === 'library' ? 'kz-nav-keep' : '' }); if (k === active) a.setAttribute('aria-current', 'page'); nav.append(a); }
  const logo = el('a', { class: 'kz-logo', href: '/', 'aria-label': 'KritZaar home' }, el('img', { src: '/icons/icon-192.png', alt: '', width: '32', height: '32' }), el('span', { text: 'KritZaar' }));
  const hd = el('header', { class: 'kz-hd' }, el('div', { class: 'kz-hd-in' }, logo, form, nav));
  document.body.prepend(hd);
  // Mobile bottom bar: always-reachable Home, Games, Search, My Games.
  const bn = el('nav', { class: 'kz-bnav', 'aria-label': 'Quick navigation' });
  const item = (href, iconName, label, key) => { const a = el('a', { href }, el('span', { class: 'kz-bnav-i', 'aria-hidden': 'true' }, icon(iconName, 22)), el('span', { text: label })); if (key === active) a.setAttribute('aria-current', 'page'); return a; };
  const searchBtn = el('a', { href: '#search', role: 'button' }, el('span', { class: 'kz-bnav-i', 'aria-hidden': 'true' }, icon('search', 22)), el('span', { text: 'Search' }));
  searchBtn.addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); input.focus(); });
  bn.append(item('/', 'home', 'Home', 'home'), item('/games/', 'gamepad', 'Games', 'games'), searchBtn, item('/library/', 'folder', 'My Games', 'library'));
  document.body.append(bn);
  const top = el('button', { type: 'button', class: 'kz-top', 'aria-label': 'Back to top', hidden: '' }, icon('arrow-up', 22));
  top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.append(top);
  addEventListener('scroll', () => { top.hidden = scrollY < 700; }, { passive: true });
}

export function mountFooter() {
  const links = [['/legal/how-it-works.html', 'How it works'], ['/legal/terms.html', 'Terms'], ['/legal/privacy.html', 'Privacy'], ['/legal/dmca.html', 'Copyright / DMCA']];
  const ft = el('footer', { class: 'kz-ft' }, el('div', { class: 'kz-ft-in' },
    el('div', {}, el('b', { text: 'KritZaar' }), el('p', { text: 'Free games in your browser. Your saves stay on your device.' })),
    el('div', { class: 'kz-ft-links' }, ...links.map(([h, t]) => el('a', { href: h, text: t })))));
  document.body.append(ft);
}

/** Horizontal rail with arrow buttons. `cards` are elements made by gameCard(). */
export function rail(title, cards, moreHref) {
  const ul = el('ul', { class: 'kz-rail' }); for (const c of cards) ul.append(el('li', {}, c));
  const mk = (cls, ch, dir) => { const b = el('button', { type: 'button', class: 'kz-rail-btn ' + cls, 'aria-label': dir < 0 ? 'Scroll left' : 'Scroll right' }, icon(dir < 0 ? 'chevron-left' : 'chevron-right', 20)); b.addEventListener('click', () => ul.scrollBy({ left: dir * ul.clientWidth * .8, behavior: 'smooth' })); return b; };
  const head = el('div', { class: 'kz-sec-h' }, el('h2', { text: title }));
  if (moreHref) head.append(el('a', { href: moreHref }, 'See all ', icon('arrow-right', 16)));
  return el('section', { class: 'kz-sec' }, head, el('div', { class: 'kz-rail-wrap' }, mk('l', '‹', -1), ul, mk('r', '›', 1)));
}

/** Share button: native share sheet when available, otherwise copies the link. */
export function shareButton(title, cls = 'kz-btn') {
  const b = el('button', { type: 'button', class: cls }); iconLabel(b, 'share', 'Share');
  b.addEventListener('click', async () => {
    try { if (navigator.share) { await navigator.share({ title: title + ' on KritZaar', url: location.href }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(location.href); iconLabel(b, 'check', 'Link copied'); } catch { b.textContent = 'Copy the address bar link'; }
    setTimeout(() => { iconLabel(b, 'share', 'Share'); }, 2200);
  });
  return b;
}

/** Skeleton placeholder rows shown while the game list loads. */
export function skeletonRails(n = 3) {
  const wrap = el('div', { class: 'kz-skel-wrap', 'aria-hidden': 'true' });
  for (let r = 0; r < n; r++) { const row = el('div', { class: 'kz-skel-row' }); for (let i = 0; i < 6; i++) row.append(el('div', { class: 'kz-skel' })); wrap.append(el('div', { class: 'kz-skel-h' }), row); }
  return wrap;
}
