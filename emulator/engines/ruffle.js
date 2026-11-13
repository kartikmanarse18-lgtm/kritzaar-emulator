// Ruffle adapter (Flash / .swf). Self-hosted under /emulator/vendor/ruffle/. Flash content is run by
// Ruffle's own sandbox: no network access for the game, no script access to the page.
const BASE = '/emulator/vendor/ruffle/';

function loadScript() {
  if (window.RufflePlayer && window.RufflePlayer.newest) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.RufflePlayer = window.RufflePlayer || {};
    window.RufflePlayer.config = {
      publicPath: BASE, autoplay: 'on', unmuteOverlay: 'hidden', letterbox: 'on', splashScreen: false,
      warnOnUnsupportedContent: false, contextMenu: 'rightClickOnly', showSwfDownload: false,
      allowNetworking: 'none', allowScriptAccess: false, openUrlMode: 'deny', logLevel: 'warn',
    };
    const s = document.createElement('script');
    s.src = BASE + 'ruffle.js';
    s.onload = resolve;
    s.onerror = () => reject(Object.assign(new Error('The Flash player files could not be loaded.'), { code: 'NETWORK' }));
    document.head.append(s);
  });
}

export async function start(ctx) {
  const { root, blob, onExit } = ctx;
  await loadScript();
  root.replaceChildren();
  const ruffle = window.RufflePlayer.newest();
  const el = ruffle.createPlayer();
  el.style.cssText = 'width:100%;height:100%;display:block';
  root.append(el);
  const player = el.ruffle ? el.ruffle() : el;
  const data = new Uint8Array(await blob.arrayBuffer());
  await Promise.race([
    player.load({ data }),
    new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('The Flash game did not start.'), { code: 'EMULATOR_CRASH' })), 45000)),
  ]);
  el.tabIndex = 0; el.focus();
  return {
    kind: 'ruffle',
    pause() { player.suspend ? player.suspend() : el.pause && el.pause(); },
    resume() { player.resume ? player.resume() : el.play && el.play(); },
    saveState: null,   // Flash has no memory snapshots here; games keep their own saves in the browser
    loadState: null,
    async stop() { try { el.remove(); } catch { /* gone */ } },
  };
}
