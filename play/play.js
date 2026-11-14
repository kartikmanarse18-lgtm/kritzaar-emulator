// KritZaar web-game page: embeds a third-party game from an allow-listed host (data/site-config.json embedHosts).
// KritZaar does not host these games. Text is set with textContent.
//
// New in round 5
//  - Preload, in view: after Play is pressed, Playgama shows an ad and then downloads the game, which can be slow. The person
//    is asked whether to keep browsing while it loads. The ad and game load in the visible game area (never hidden or covered,
//    as Playgama's partner terms treat hidden ads as invalid traffic). A status bar and a floating pill show progress, and the page
//    says so (tab title, toast, vibration) when it is ready. Settings: data/emulator-config.json -> webGames.
//  - Controller chip, a working fullscreen on every browser (with an exit button), and Reload.
//  - Controller badge INSIDE the game area (shooters are played fullscreen, where the toolbar chip is not visible).
import { loadWebGames, webCardData, pickMore } from '/js/cards.js';
import { cardGrid, hue } from '/js/cards.js';
import { mountHeader, mountFooter, shareButton } from '/js/shell.js';
import { getConfig, getPref, setPref } from '/js/emulator-config.js';
import { watchGamepads, mountChip, toast, padName } from '/js/gamepad-hud.js';
import { icon, setIcon, iconLabel } from '/js/icons.js';
mountHeader('web'); mountFooter();

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'text') n.textContent = v; else if (v != null && v !== false) n.setAttribute(k, v); } n.append(...kids); return n; };
const id = (new URLSearchParams(location.search).get('g') || '').toLowerCase();
const PREF_KEY = 'web-preload'; // remembered answer: "bg" or "now"

(async () => {
  const [games, CFG] = await Promise.all([loadWebGames(), getConfig()]);
  const g = /^pg-[a-z0-9-]{1,100}$/.test(id) ? games.find((x) => x.id === id) : null;
  if (!g) { $('kzw-error').hidden = false; return; }
  $('kzw-layout').hidden = false;
  $('kzw-actions').prepend(shareButton(g.title));
  const baseTitle = g.title + ' | KritZaar';
  document.title = baseTitle;
  $('kzw-title').textContent = g.title;
  $('kzw-desc').textContent = g.description;
  $('kzw-how').textContent = g.howTo || 'Use your mouse or touch screen.';
  $('kzw-info').hidden = false;
  (g.genres || []).slice(0, 5).forEach((t) => $('kzw-tags').append(el('li', {}, el('a', { href: '/games/?genre=' + encodeURIComponent(t), text: String(t).replace(/-/g, ' ') }))));
  $('kzw-crumb').append(el('a', { href: '/', text: 'Home' }), ' / ', el('a', { href: '/games/?kind=web', text: 'Web games' }), ' / ', el('span', { text: g.title }));

  // Controller chip: says whether a controller is connected (the game itself reads it once it has focus).
  let padNow = null, badge = null, badgeTimer = 0, padWatch = null;
  if (CFG.controls.gamepadEnabled) {
    const watch = watchGamepads({ announce: CFG.player.gamepadToast });
    $('kzw-actions').prepend(mountChip($('kzw-actions'), watch));
    padWatch = watch;
  }

  // In-game controller badge: a small icon that stays inside the game area (so it is still there in fullscreen),
  // and opens up to show the controller name for a few seconds when one connects or fullscreen starts.
  function paintBadge(flash) {
    if (phase !== 'live') return;
    if (!badge || !badge.isConnected) {
      badge = el('div', { class: 'kzw-padbadge', role: 'status', 'aria-live': 'polite', hidden: '' }, el('i', { 'aria-hidden': 'true' }), el('span', { class: 'kzw-padbadge-t' }));
      badge.insertBefore(icon('gamepad', 18), badge.firstChild);
      stage.append(badge);
    }
    badge.hidden = !padNow;
    if (!padNow) return;
    badge.querySelector('.kzw-padbadge-t').textContent = padName(padNow.id);
    if (flash) { badge.classList.add('is-open'); clearTimeout(badgeTimer); badgeTimer = setTimeout(() => badge.classList.remove('is-open'), 3500); }
  }

  const stage = $('kzw-stage');
  stage.classList.toggle('is-portrait', !g.landscape && g.portrait);

  // ---- poster ---------------------------------------------------------------------------
  const play = el('button', { type: 'button', class: 'kzw-playbtn' });
  const setPlay = (t) => iconLabel(play, 'play', t);
  setPlay('Play');
  // Loading status sits in a bar under the game (not over it), so the ad and the game stay fully visible while they load.
  const sub = el('p', { class: 'kzw-sub', role: 'status', 'aria-live': 'polite' });
  const cancel = el('button', { type: 'button', class: 'kzw-linkbtn', text: 'Cancel' });
  const loadbar = el('div', { class: 'kzw-loadbar', hidden: '' }, sub, cancel);
  stage.closest('.kzw-stage-wrap').after(loadbar);
  const poster = el('div', { class: 'kzw-poster' }, el('img', { src: g.image, alt: '', class: 'kzw-bg' }),
    el('div', { class: 'kzw-poster-in' }, el('img', { src: g.icon || g.image, alt: '' }), el('h2', { text: g.title }), play));
  poster.style.setProperty('--h', String(hue(g.id)));
  poster.querySelectorAll('img').forEach((i) => i.addEventListener('error', () => i.remove()));
  stage.append(poster);

  // ---- the game frame ---------------------------------------------------------------------
  let frame = null, phase = 'idle', loaded = false, t0 = 0, ticker = 0, stageVisible = true;
  // Subscribed here, after the state it reads exists (onChange calls back straight away).
  if (padWatch) padWatch.onChange((p) => {
    padNow = p;
    paintBadge(true);
    // A page only receives controller input while it has focus, so hand focus to the game when a pad appears.
    if (p && phase === 'live' && frame && document.activeElement !== frame) { try { frame.focus(); } catch { /* optional */ } }
  });
  const makeFrame = () => el('iframe', { src: g.url, title: g.title, allow: 'fullscreen; gamepad; autoplay; accelerometer; gyroscope; clipboard-write; encrypted-media; web-share',
    allowfullscreen: '', referrerpolicy: 'strict-origin-when-cross-origin', sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock allow-orientation-lock allow-presentation' });
  const secs = () => Math.max(0, Math.round((Date.now() - t0) / 1000));

  function showControls() {
    $('kzw-full').hidden = false; $('kzw-reload').hidden = false; $('kzw-help').hidden = false;
    if (!stage.querySelector('.kzw-fsx')) {
      const x = el('button', { type: 'button', class: 'kzw-fsx', 'aria-label': 'Exit fullscreen' }, icon('x', 20));
      x.addEventListener('click', () => setFullscreen(false));
      stage.append(x);
    }
  }

  function showLive() {
    phase = 'live';
    clearInterval(ticker);
    loadbar.hidden = true;
    showControls();
    document.body.classList.add('kzw-playing'); // lighter page while a game runs: no blur, no animations (see play.css)
    document.title = baseTitle;
    updatePill();
    paintBadge(true);
  }

  function playNow() {
    frame = makeFrame();
    stage.replaceChildren(frame);
    showLive();
    frame.focus();
  }

  function reveal() { // the game is loaded: hand over to normal play (and bring it into view if needed)
    showLive();
    frame.focus();
    if (!stageVisible) stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Preload, in view: after Play is pressed the Playgama ad and the game load right here in the game area, fully visible
  // (never hidden or covered), so the ad can be seen and the person can still scroll away and be told when it is ready.
  function startBackground() {
    phase = 'bg'; loaded = false; t0 = Date.now();
    frame = makeFrame();
    frame.addEventListener('load', onLoaded, { once: true });
    poster.hidden = true;
    stage.prepend(frame);
    showControls();
    loadbar.hidden = false;
    tick();
    ticker = setInterval(tick, 1000);
    updatePill();
  }

  function stopBackground() {
    clearInterval(ticker);
    if (frame) frame.remove();
    frame = null; phase = 'idle'; loaded = false;
    const x = stage.querySelector('.kzw-fsx'); if (x) x.remove();
    $('kzw-full').hidden = true; $('kzw-reload').hidden = true; $('kzw-help').hidden = true;
    poster.hidden = false; loadbar.hidden = true;
    document.body.classList.remove('kzw-playing');
    document.title = baseTitle;
    updatePill();
  }

  function tick() {
    if (phase !== 'bg' || loaded) return;
    const slow = secs() >= CFG.webGames.slowLoadHintSec;
    sub.textContent = 'Loading… ' + secs() + 's' + (slow ? '. Taking longer than usual: a long ad or a slow connection.' : '. You can scroll and read while it loads. We will tell you when it is ready.');
    updatePill();
  }

  function onLoaded() {
    if (phase !== 'bg') return;
    loaded = true;
    if (stageVisible) { showLive(); return; }   // the person is watching it: just carry on
    if (CFG.webGames.readyTitle) document.title = 'Ready: ' + g.title;
    if (CFG.webGames.readyVibrate && navigator.vibrate) { try { navigator.vibrate(60); } catch { /* optional */ } }
    toast(g.title + ' is ready');
    sub.textContent = 'Ready.';
    updatePill();
  }

  // Floating pill: only while loading in the background and the game is scrolled out of view.
  const pill = $('kzw-pill');
  function updatePill() {
    const on = CFG.webGames.readyPill && phase === 'bg' && !stageVisible;
    pill.hidden = !on;
    // Short on purpose: the title is the page you are on, and a long pill cuts off the timer on phones.
    if (on) { pill.textContent = loaded ? 'Game ready. Tap to play' : 'Loading… ' + secs() + 's'; pill.classList.toggle('is-ready', loaded); }
  }
  pill.addEventListener('click', () => { if (phase === 'bg') reveal(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { stageVisible = e.isIntersecting; if (stageVisible && phase === 'bg' && loaded) showLive(); else updatePill(); }, { threshold: 0.25 }).observe(stage);

  // ---- the choice before the first Play -----------------------------------------------------
  const ask = $('kzw-ask');
  function askChoice() {
    return new Promise((resolve) => {
      $('kzw-remember-wrap').hidden = !CFG.webGames.allowRemember;
      $('kzw-remember').checked = false;
      let answer = null;
      const done = (a) => { answer = a; ask.close(); };
      $('kzw-ask-bg').onclick = () => done('bg');
      $('kzw-ask-now').onclick = () => done('now');
      ask.addEventListener('close', () => {
        if (answer && CFG.webGames.allowRemember && $('kzw-remember').checked) setPref(PREF_KEY, answer);
        resolve(answer); // null when the dialog was dismissed: nothing starts
      }, { once: true });
      ask.showModal();
      $('kzw-ask-bg').focus();
    });
  }

  play.addEventListener('click', async () => {
    if (phase === 'bg') return reveal();
    if (phase === 'live') return;
    const mode = CFG.webGames.preload;
    let choice = mode === 'always' ? 'bg' : mode === 'never' ? 'now' : null;
    if (!choice && CFG.webGames.allowRemember) { const saved = getPref(PREF_KEY); if (saved === 'bg' || saved === 'now') choice = saved; }
    if (!choice) choice = await askChoice();
    if (choice === 'bg') startBackground(); else if (choice === 'now') playNow();
  });
  cancel.addEventListener('click', stopBackground);
  ask.addEventListener('click', (e) => { if (e.target === ask) ask.close(); }); // tap outside = dismiss

  // ---- toolbar: reload + fullscreen ----------------------------------------------------------
  $('kzw-reload').addEventListener('click', () => { if (frame) { const s = frame.src; frame.src = 'about:blank'; setTimeout(() => { frame.src = s; }, 50); } });

  const isFs = () => document.fullscreenElement === stage || stage.classList.contains('kzp-soft-fs');
  function syncFs() {
    const on = isFs();
    $('kzw-full-l').textContent = on ? 'Exit fullscreen' : 'Fullscreen';
    $('kzw-full').setAttribute('aria-label', on ? 'Exit fullscreen' : 'Fullscreen');
    const fi = $('kzw-full').querySelector('svg.kz-i'); if (fi) setIcon(fi, on ? 'minimize' : 'maximize');
    if (on) paintBadge(true);
    document.body.classList.toggle('kzw-is-fs', on);
  }
  function setFullscreen(on) {
    if (!on) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      stage.classList.remove('kzp-soft-fs');
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch { /* optional */ }
      syncFs(); return;
    }
    const soft = () => { stage.classList.add('kzp-soft-fs'); syncFs(); }; // iPhone Safari has no element fullscreen
    if (stage.requestFullscreen) {
      stage.requestFullscreen({ navigationUI: 'hide' }).then(() => {
        // Landscape games fill a phone best; portrait games are left alone.
        try { if (CFG.player.landscapeLockOnPhones && g.landscape !== false && !stage.classList.contains('is-portrait') && matchMedia('(pointer: coarse)').matches && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch { /* optional */ }
        syncFs();
      }, soft);
    } else soft();
  }
  $('kzw-full').addEventListener('click', () => setFullscreen(!isFs()));
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) { try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch { /* optional */ } } syncFs(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stage.classList.contains('kzp-soft-fs')) setFullscreen(false); });

  const more = pickMore(games, 8, g.id, g.genres);
  if (more.length) { $('kzw-grid').append(cardGrid(more.map(webCardData))); $('kzw-more').hidden = false; }
})();
