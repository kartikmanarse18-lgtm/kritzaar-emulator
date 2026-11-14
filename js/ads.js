// KritZaar direct-sponsor ad slots. Static images from this site's own domain, a plain link, labelled "Sponsored".
// No ad network, no third-party script. Creatives live in /data/ads.json (weighted and date-limited).
// Slot sizes stay reserved so the page does not jump. Text is set with textContent.
let adsPromise;
export function loadAds() {
  adsPromise = adsPromise || fetch('/data/ads.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((a) => a || { slots: {}, creatives: [] });
  return adsPromise;
}

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (v != null && v !== false) n.setAttribute(k, v); }
  n.append(...kids); return n;
};

const isPlaceholder = (c) => !c || /CONTACT_EMAIL_HERE/.test(c);
const safeContact = (c) => (typeof c === 'string' && /^(mailto:|https:\/\/|tel:)/.test(c) && !isPlaceholder(c) ? c : '');

function pick(ads, slot) {
  const now = Date.now();
  const list = (ads.creatives || []).filter((c) => c.slot === slot && /^https:\/\//.test(c.href || '') && (!c.from || Date.parse(c.from) <= now) && (!c.to || Date.parse(c.to) >= now + 86399000));
  if (!list.length) return null;
  let r = Math.random() * list.reduce((a, c) => a + (c.weight || 1), 0);
  for (const c of list) { r -= c.weight || 1; if (r <= 0) return c; }
  return list[0];
}

/** Fill `container` with one slot: the sponsor's banner, or a "your banner here" card that links to the contact. */
export async function mountSlot(container, slot, extraClass = '') {
  const ads = await loadAds();
  const size = (ads.slots && ads.slots[slot]) || { w: 728, h: 90 };
  const box = el('aside', { class: 'kz-ad kz-ad--' + slot + ' ' + extraClass, 'aria-label': 'Sponsored' });
  box.style.setProperty('--w', size.w + 'px'); box.style.setProperty('--h', size.h + 'px'); box.style.setProperty('--ratio', size.w + ' / ' + size.h);
  const c = pick(ads, slot);
  if (c) {
    const pic = el('picture');
    if (c.imageMobile) pic.append(el('source', { media: '(max-width:640px)', srcset: c.imageMobile }));
    pic.append(el('img', { src: c.image, alt: c.alt || c.sponsor || 'Sponsored', width: size.w, height: size.h, loading: 'lazy' }));
    box.append(el('a', { href: c.href, target: '_blank', rel: 'sponsored noopener noreferrer' }, pic), el('small', { class: 'kz-ad-tag', text: 'Sponsored' + (c.sponsor ? ' · ' + c.sponsor : '') }));
  } else {
    const contact = safeContact(ads.contact);
    // Nothing to show and nobody to call: collapse the slot instead of leaving an empty box on the page.
    if (!contact && ads.showPlaceholders === false) { container.replaceChildren(); container.classList.add('kz-ad-gone'); return; }
    const inner = [el('b', { text: 'Your banner here' }), el('span', { text: size.w + ' × ' + size.h })];
    box.style.setProperty('--ratio', size.w + ' / ' + size.h);
    box.classList.add('is-empty');
    box.append(contact ? el('a', { class: 'kz-ad-free', href: contact }, ...inner) : el('div', { class: 'kz-ad-free' }, ...inner));
  }
  container.replaceChildren(box);
}

/** "Advertise with us" card with the contact details from ads.json. */
export async function mountContact(container) {
  const ads = await loadAds();
  const contact = safeContact(ads.contact);
  if (!contact && ads.showPlaceholders === false) { container.replaceChildren(); return; }
  const card = el('section', { class: 'kz-ad-contact', 'aria-label': 'Advertise on KritZaar' },
    el('h3', { text: ads.contactLabel || 'Advertise on KritZaar' }),
    el('p', { class: 'kz-ad-note', text: ads.contactNote || 'Direct sponsor banners, clearly labelled.' }),
    el('p', { class: 'kz-ad-sizes', text: 'Banner sizes: 728×90 · 300×250 · 970×90' }));
  if (contact) card.append(el('a', { class: 'kz-ad-btn', href: contact, text: contact.startsWith('mailto:') ? 'Email: ' + contact.slice(7) : 'Contact us' }));
  else card.append(el('p', { class: 'kz-ad-notset', text: 'Sponsor slots open soon.' }));
  container.replaceChildren(card);
}
