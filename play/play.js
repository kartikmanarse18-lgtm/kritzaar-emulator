// KritZaar web-game page: embeds a third-party game from an allow-listed host (data/site-config.json embedHosts).
// KritZaar does not host these games. Text is set with textContent.
//
// New in round 5
//  - "Load in the background": Playgama shows an ad and then downloads the game, which can be slow. Before the first Play the
//    person is asked whether to start loading right away. The game loads invisibly under the poster, a status line and a floating
//    pill show progress, and the page says so (tab title, toast, vibration) when it is ready. Settings: data/emulator-config.json -> webGames.
//  - Controller chip, a working fullscreen on every browser (with an exit button), and Reload.
import { loadWebGames, webCardData, pickMore } from '/js/cards.js';
import { cardGrid, hue } from '/js/cards.js';
import { mountHeader, mountFooter, shareButton } from '/js/shell.js';
import { getConfig, getPref, setPref } from '/js/emulator-config.js';
import { watchGamepads, mountChip, toast } from '/js/gamepad-hud.js';
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
  if (CFG.controls.gamepadEnabled) {
    const watch = watchGamepads({ announce: CFG.player.gamepadToast });
    $('kzw-actions').prepend(mountChip($('kzw-actions'), watch));
  }

  const stage = $('kzw-stage');
  stage.classList.toggle('is-portrait', !g.landscape && g.portrait);

  // ---- poster ---------------------------------------------------------------------------
  const play = el('button', { type: 'button', class: 'kzw-playbtn', text: '▶ Play' });
  const sub = el('p', { class: 'kzw-sub', role: 'status', 'aria-live': 'polite', hidden: '' });
  const cancel = el('button', { type: 'button', class: 'kzw-linkbtn', text: 'Cancel', hidden: '' });
  const poster = el('div', { class: 'kzw-poster' }, el('img', { src: g.image, alt: '', class: 'kzw-bg' }),
    el('div', { class: 'kzw-poster-in' }, el('img', { src: g.icon || g.image, alt: '' }), el('h2', { text: g.title }), play, sub, cancel));
  poster.style.setProperty('--h', String(hue(g.id)));
  poster.querySelectorAll('img').forEach((i) => i.addEventListener('error', () => i.remove()));
  stage.append(poster);

  // ---- the game frame ---------------------------------------------------------------------
  let frame = null, phase = 'idle', loaded = false, t0 = 0, ticker = 0, stageVisible = true;
  const makeFrame = () => el('iframe', { src: g.url, title: g.title, allow: 'fullscreen; gamepad; autoplay; accelerometer; gyroscope; clipboard-write; encrypted-media; web-share',
    allowfullscreen: '', referrerpolicy: 'strict-origin-when-cross-origin', sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock allow-orientation-lock allow-presentation' });
  const secs = () => Math.max(0, Math.round((Date.now() - t0) / 1000));

  function showLive() {
    phase = 'live';
    clearInterval(ticker);
    $('kzw-full').hidden = false; $('kzw-reload').hidden = false; $('kzw-help').hidden = false;
    if (!stage.querySelector('.kzw-fsx')) {
      const x = el('button', { type: 'button', class: 'kzw-fsx', 'aria-label': 'Exit fullscreen', text: '✕' });
      x.addEventListener('click', () => setFullscreen(false));
      stage.append(x);
    }
    document.title = baseTitle;
    updatePill();
  }

  function playNow() {
    frame = makeFrame();
    stage.replaceChildren(frame);
    showLive();
    frame.focus();
  }

  function reveal() { // the background game is already (partly) loaded: swap the poster for it
    poster.remove();
    frame.classList.remove('is-bg');
    showLive();
    frame.focus();
    if (!stageVisible) stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function startBackground() {
    phase = 'bg'; loaded = false; t0 = Date.now();
    frame = makeFrame(); frame.classList.add('is-bg'); // laid out at full size but invisible, under the poster
    frame.addEventListener('load', onLoaded, { once: true });
    stage.prepend(frame);
    play.textContent = 'Open now';
    sub.hidden = false; cancel.hidden = false;
    tick();
    ticker = setInterval(tick, 1000);
    updatePill();
  }

  function stopBackground() {
    clearInterval(ticker);
    if (frame) frame.remove();
    frame = null; phase = 'idle'; loaded = false;
    play.textContent = '▶ Play';
    sub.hidden = true; cancel.hidden = true;
    document.title = baseTitle;
    updatePill();
  }

  function tick() {
    if (phase !== 'bg') return;
    if (loaded) { sub.textContent = '✓ Ready. Press Play to start.'; return; }
    const slow = secs() >= CFG.webGames.slowLoadHintSec;
    sub.textContent = '⏳ Loading in the background… ' + secs() + 's' + (slow ? '. Taking longer than usual: a long ad or a slow connection. You can open it now to see what it is doing.' : '. You can keep reading or look at other games.');
    updatePill();
  }

  function onLoaded() {
    if (phase !== 'bg') return;
    loaded = true;
    play.textContent = '▶ Play';
    tick();
    if (CFG.webGames.readyTitle) document.title = '▶ Ready: ' + g.title;
    if (CFG.webGames.readyVibrate && navigator.vibrate) { try { navigator.vibrate(60); } catch { /* optional */ } }
    if (!stageVisible) toast('🎮 ' + g.title + ' is ready');
    updatePill();
  }

  // Floating pill: only while loading in the background and the game is scrolled out of view.
  const pill = $('kzw-pill');
  function updatePill() {
    const on = CFG.webGames.readyPill && phase === 'bg' && !stageVisible;
    pill.hidden = !on;
    // Short on purpose: the title is the page you are on, and a long pill cuts off the timer on phones.
    if (on) { pill.textContent = loaded ? '✅ Game ready. Tap to play' : '⏳ Loading in background… ' + secs() + 's'; pill.classList.toggle('is-ready', loaded); }
  }
  pill.addEventListener('click', () => { if (phase === 'bg') reveal(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { stageVisible = e.isIntersecting; updatePill(); }, { threshold: 0.25 }).observe(stage);

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
    if (phase === 'bg') return reveal();            // "Open now" / "Play" while the background load runs
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
