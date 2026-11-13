// EmulatorJS adapter (NES via FCEUmm, Game Boy / Color / Advance via mGBA).
// Everything is self-hosted under /emulator/vendor/emulatorjs/. Its own databases are switched off:
// KritZaar's storage layer keeps the game, the save states and the battery saves, so backups include them.
const DATA = '/emulator/vendor/emulatorjs/data/';
const EXT = { nes: '.nes', gb: '.gb', gbc: '.gbc', gba: '.gba' };
const HIDDEN = ['saveState', 'loadState', 'saveSavFiles', 'loadSavFiles', 'quickSave', 'quickLoad', 'cacheManager', 'netplay', 'screenRecord', 'exitEmulation', 'contextMenu'];

function loadLoader() {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = DATA + 'loader.js';
    s.onerror = () => reject(Object.assign(new Error('The emulator files could not be loaded.'), { code: 'NETWORK' }));
    document.head.append(s);
    // loader.js is async and does not signal completion; poll for the emulator object it creates.
    const t0 = Date.now();
    const poll = setInterval(() => {
      if (window.EJS_emulator) { clearInterval(poll); resolve(); }
      else if (Date.now() - t0 > 45000) { clearInterval(poll); reject(Object.assign(new Error('The emulator took too long to start.'), { code: 'EMULATOR_CRASH' })); }
    }, 100);
  });
}

export async function start(ctx) {
  const { root, blob, platform, core, id, onExit, batteryBytes, onBattery } = ctx;
  root.replaceChildren();
  const holder = document.createElement('div');
  holder.id = 'kzp-ejs';
  holder.style.cssText = 'width:100%;height:100%';
  root.append(holder);
  const buttons = {}; HIDDEN.forEach((k) => { buttons[k] = false; });
  Object.assign(window, {
    EJS_player: '#kzp-ejs', EJS_core: core, EJS_pathtodata: DATA, EJS_gameName: id,
    EJS_gameUrl: new File([blob], 'game' + (EXT[platform] || '.rom'), { type: 'application/octet-stream' }),
    EJS_startOnLoaded: true, EJS_threads: false, EJS_disableDatabases: true, EJS_color: '#7c5cff',
    EJS_Buttons: buttons, EJS_language: 'en-US', EJS_noAutoFocus: false,
  });
  const started = new Promise((resolve) => { window.EJS_onGameStart = () => resolve(); });
  await loadLoader();
  await Promise.race([started, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('The game did not start.'), { code: 'EMULATOR_CRASH' })), 60000))]);
  const gm = () => window.EJS_emulator && window.EJS_emulator.gameManager;
  try { // restore the game's own battery save, if there is one
    if (batteryBytes && gm()) { gm().FS.writeFile(gm().getSaveFilePath(), batteryBytes); gm().loadSaveFiles(); }
  } catch (e) { console.warn('battery restore skipped', e); }

  let lastBattery = '';
  const flushBattery = () => {
    try {
      const data = gm() && gm().getSaveFile(true);
      if (!data || !data.length) return;
      const key = data.length + ':' + data[0] + ':' + data[data.length - 1] + ':' + data[data.length >> 1];
      if (key === lastBattery) return;
      lastBattery = key; onBattery && onBattery(new Uint8Array(data));
    } catch { /* core has no battery save */ }
  };
  const timer = setInterval(flushBattery, 20000);
  return {
    kind: 'emulatorjs',
    pause() { window.EJS_emulator.pause(true); },
    resume() { window.EJS_emulator.play(true); },
    async saveState() { flushBattery(); return new Uint8Array(gm().getState()); },
    async loadState(bytes) { gm().loadState(bytes); },
    async stop() {
      clearInterval(timer); flushBattery();
      try { window.EJS_emulator.pause(true); } catch { /* already stopped */ }
      root.replaceChildren();
    },
  };
}
