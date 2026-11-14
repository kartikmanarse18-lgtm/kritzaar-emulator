/* KritZaar physical gamepad support (DOS and native games).
   Reads the browser Gamepad API and sends keys through window.KZPlayer.sendKey(code, pressed).
   Every button can be remapped; mappings are saved per game on this device.
   EmulatorJS games (NES, Game Boy) have their own gamepad handling and do not use this module. */

export const GP_BUTTONS = [
  [0, 'A'], [1, 'B'], [2, 'X'], [3, 'Y'], [4, 'LB'], [5, 'RB'], [6, 'LT'], [7, 'RT'],
  [8, 'Back'], [9, 'Start'], [10, 'L3 (press left stick)'], [11, 'R3 (press right stick)'],
  [12, 'D-pad up'], [13, 'D-pad down'], [14, 'D-pad left'], [15, 'D-pad right']
];

export const KEY_CHOICES = [
  ['ControlLeft', 'Ctrl'], ['AltLeft', 'Alt'], ['ShiftLeft', 'Shift'], ['Space', 'Space'], ['Enter', 'Enter'], ['Escape', 'Esc'], ['Tab', 'Tab'],
  ['ArrowUp', 'Up arrow'], ['ArrowDown', 'Down arrow'], ['ArrowLeft', 'Left arrow'], ['ArrowRight', 'Right arrow'],
  ['KeyY', 'Y'], ['KeyN', 'N'], ['KeyZ', 'Z'], ['KeyX', 'X'], ['KeyC', 'C'], ['KeyP', 'P'], ['KeyM', 'M'],
  ['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3'], ['Digit4', '4'], ['Digit5', '5'], ['Digit6', '6'],
  ['F1', 'F1'], ['F2', 'F2'], ['F3', 'F3'], ['F4', 'F4'], ['F5', 'F5'], ['F6', 'F6'], ['F7', 'F7'], ['F8', 'F8'], ['F9', 'F9'], ['F10', 'F10'],
  ['', 'Nothing']
];

export const GP_MODES = {
  classic: 'Classic: left stick or D-pad moves',
  shooter: 'Dual stick: left stick walks and strafes, right stick turns'
};

export const DEFAULT_MAP = {
  0: 'ControlLeft', 1: 'Space', 2: 'ShiftLeft', 3: 'AltLeft', 4: 'Digit1', 5: 'Digit2', 6: 'AltLeft', 7: 'ControlLeft',
  8: 'Escape', 9: 'Enter', 10: 'ShiftLeft', 11: 'Tab',
  12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight'
};

const STICK_DEAD = 0.4;
const SHOOTER_TURN_DEAD = 0.3;
const key = (id) => 'kz-gp:' + (id || 'default');

export function loadGamepadConfig(gameId) {
  try {
    const raw = JSON.parse(localStorage.getItem(key(gameId)) || 'null') || {};
    return { mode: raw.mode === 'shooter' ? 'shooter' : 'classic', map: { ...DEFAULT_MAP, ...(raw.map || {}) } };
  } catch { return { mode: 'classic', map: { ...DEFAULT_MAP } }; }
}
export function saveGamepadConfig(gameId, cfg) {
  try { localStorage.setItem(key(gameId), JSON.stringify(cfg)); } catch { /* optional preference */ }
}

/** Start polling. Returns { stop, getConfig, setConfig, reset, connected, onChange(cb) }. */
export function startGamepad({ gameId, onPress } = {}) {
  if (!navigator.getGamepads) return null;
  let cfg = loadGamepadConfig(gameId);
  const down = new Set();     // codes this module is holding
  const heldBtn = new Set();  // buttons held last frame (for onPress)
  const listeners = new Set();
  let raf = 0, announced = false, pad = null;

  const send = (code, pressed) => window.KZPlayer && window.KZPlayer.sendKey(code, pressed);
  const notify = () => listeners.forEach((cb) => { try { cb(pad); } catch { /* listener error */ } });

  function pick() {
    const list = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    return list.find((p) => p.connected) || null;
  }

  function wanted(p) {
    const want = new Set();
    const b = (i) => p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5);
    p.buttons.forEach((_, i) => {
      if (b(i)) {
        if (!heldBtn.has(i)) { heldBtn.add(i); if (onPress) onPress(GP_BUTTONS.find((x) => x[0] === i)?.[1] || 'Button ' + i); }
        const code = cfg.map[i];
        if (code) want.add(code);
      } else heldBtn.delete(i);
    });
    const lx = p.axes[0] || 0, ly = p.axes[1] || 0, rx = p.axes[2] || 0;
    if (cfg.mode === 'shooter') {
      if (ly < -STICK_DEAD) want.add('ArrowUp'); else if (ly > STICK_DEAD) want.add('ArrowDown');
      if (Math.abs(lx) > STICK_DEAD) { want.add('AltLeft'); want.add(lx < 0 ? 'ArrowLeft' : 'ArrowRight'); } // Alt + arrow = strafe
      else if (rx < -SHOOTER_TURN_DEAD) want.add('ArrowLeft'); else if (rx > SHOOTER_TURN_DEAD) want.add('ArrowRight');
      if (Math.abs(lx) > STICK_DEAD && Math.abs(rx) > SHOOTER_TURN_DEAD) want.add(rx < 0 ? 'ArrowLeft' : 'ArrowRight');
    } else {
      const d = Math.hypot(lx, ly);
      if (d > STICK_DEAD) {
        const c = lx / d, s = ly / d;
        if (c > 0.38) want.add('ArrowRight'); else if (c < -0.38) want.add('ArrowLeft');
        if (s > 0.38) want.add('ArrowDown'); else if (s < -0.38) want.add('ArrowUp');
      }
    }
    return want;
  }

  function releaseAll() { down.forEach((c) => send(c, false)); down.clear(); heldBtn.clear(); }

  function frame() {
    raf = requestAnimationFrame(frame);
    const p = pick();
    if (!p) { if (pad) { pad = null; releaseAll(); notify(); } return; }
    if (!pad || pad.index !== p.index) { pad = p; notify(); }
    const want = wanted(p);
    for (const c of down) if (!want.has(c)) { send(c, false); down.delete(c); }
    for (const c of want) if (!down.has(c)) { send(c, true); down.add(c); }
    if (want.size && !announced) { announced = true; document.dispatchEvent(new CustomEvent('kz:gamepad-active')); }
    if (!want.size) announced = false;
  }

  const onDisconnect = () => {
    if (!pick()) {
      releaseAll();
      if (window.KZPlayer) window.KZPlayer.pause(); // never leave a game running with no controller
    }
  };
  window.addEventListener('gamepaddisconnected', onDisconnect);
  window.addEventListener('blur', releaseAll);
  raf = requestAnimationFrame(frame);

  return {
    stop() { cancelAnimationFrame(raf); window.removeEventListener('gamepaddisconnected', onDisconnect); window.removeEventListener('blur', releaseAll); releaseAll(); },
    getConfig: () => ({ mode: cfg.mode, map: { ...cfg.map } }),
    setConfig(next) { cfg = { mode: next.mode === 'shooter' ? 'shooter' : 'classic', map: { ...DEFAULT_MAP, ...next.map } }; releaseAll(); saveGamepadConfig(gameId, cfg); },
    reset() { cfg = { mode: 'classic', map: { ...DEFAULT_MAP } }; releaseAll(); saveGamepadConfig(gameId, cfg); },
    connected: () => (pad ? pad.id : null),
    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }
  };
}
