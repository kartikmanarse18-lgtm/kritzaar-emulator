/* KritZaar touch controls v2.
   Talks to the player only through window.KZPlayer.sendKey(code, pressed), where
   code is a DOM KeyboardEvent.code name such as "ControlLeft" or "ArrowUp".
   Styles live in /css/emulator-shared.css (classes prefixed kz-tc).

   Layouts: dpad-2btn, dpad-4btn, fps (stick + fire/use/run/strafe + weapons), mouse-pad.
   Extras: a key drawer (Esc, Enter, Y, N, 1-6, F-keys...), size / opacity / haptics /
   left-handed options saved on this device. */

import { KEY_CHOICES } from '/js/gamepad.js';

const K = Object.freeze({
  LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', DOWN: 'ArrowDown',
  CTRL: 'ControlLeft', ALT: 'AltLeft', SHIFT: 'ShiftLeft', SPACE: 'Space', ENTER: 'Enter', ESC: 'Escape', TAB: 'Tab'
});

export const LAYOUT_INFO = Object.freeze({
  'dpad-2btn': 'D-pad + 2 buttons',
  'dpad-4btn': 'D-pad + 4 buttons',
  'fps': 'Shooter: stick, fire, use, run, weapons',
  'mouse-pad': 'Mouse pad'
});
const DEFAULT_LAYOUT = 'dpad-2btn';

const LAYOUTS = {
  'dpad-2btn': {
    pad: 'dpad',
    buttons: [['Ctrl', K.CTRL], ['Alt', K.ALT]],
    util: [['Esc', K.ESC], ['Enter', K.ENTER]]
  },
  'dpad-4btn': {
    pad: 'dpad',
    buttons: [['Ctrl', K.CTRL], ['Alt', K.ALT], ['Space', K.SPACE], ['Shift', K.SHIFT]],
    util: [['Esc', K.ESC], ['Enter', K.ENTER]]
  },
  // First-person shooters (Wolfenstein 3D style): move with the stick, fire with Ctrl,
  // open doors with Space, hold Shift to run, hold Alt to strafe, 1-4 pick a weapon.
  'fps': {
    pad: 'stick',
    buttons: [['Fire', K.CTRL, 'kz-tc-fire'], ['Use', K.SPACE, 'kz-tc-use'], ['Run', K.SHIFT, 'kz-tc-run'], ['Strafe', K.ALT, 'kz-tc-strafe']],
    weapons: [['1', 'Digit1'], ['2', 'Digit2'], ['3', 'Digit3'], ['4', 'Digit4']],
    util: [['Esc', K.ESC], ['Enter', K.ENTER], ['Map', K.TAB]]
  },
  // Only sendKey is allowed, so the pad moves with arrow keys and the two buttons
  // stand in for mouse buttons (Enter and Space).
  'mouse-pad': {
    pad: 'trackpad',
    buttons: [['Click', K.ENTER], ['Click 2', K.SPACE]],
    util: [['Esc', K.ESC]]
  }
};

/* Keys offered in the drawer, for menus, "Y/N" prompts, cheats and number-key weapons. */
const DRAWER_KEYS = [
  ['Esc', K.ESC], ['Enter', K.ENTER], ['Space', K.SPACE], ['Tab', K.TAB],
  ['Y', 'KeyY'], ['N', 'KeyN'], ['Ctrl', K.CTRL], ['Alt', K.ALT], ['Shift', K.SHIFT],
  ['1', 'Digit1'], ['2', 'Digit2'], ['3', 'Digit3'], ['4', 'Digit4'], ['5', 'Digit5'], ['6', 'Digit6'],
  ['F1', 'F1'], ['F2', 'F2'], ['F3', 'F3'], ['F4', 'F4'], ['F5', 'F5'], ['F6', 'F6'], ['F7', 'F7'], ['F8', 'F8'], ['F9', 'F9'], ['F10', 'F10']
];

const TAP_MS = 250;      // a touch shorter than this on the pad is a tap
const TAP_SLOP_PX = 10;  // and it must not move further than this
const DIR_THRESHOLD = 0.38; // about sin(22.5deg): splits the circle into 8 directions

/* ---------- Preferences (this device only) ---------- */

const PREF_KEY = 'kz-controls';
const PREF_DEFAULTS = { mode: 'auto', size: 1, opacity: 0.9, haptics: true, leftHanded: false, layouts: {}, custom: {} };

export function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    return { ...PREF_DEFAULTS, ...p, layouts: { ...(p && p.layouts) }, custom: { ...(p && p.custom) } };
  } catch { return { ...PREF_DEFAULTS, layouts: {}, custom: {} }; }
}
export function savePrefs(prefs) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* optional preference */ }
}
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n) || lo));

/** Mount on-screen controls inside containerEl. Returns { show, hide, destroy }.
    opts.prefs overrides stored preferences; opts.force shows them even on a mouse device. */
export function mountTouchControls(containerEl, layout = DEFAULT_LAYOUT, opts = {}) {
  const prefs = opts.prefs || loadPrefs();
  const layoutName = LAYOUTS[layout] ? layout : DEFAULT_LAYOUT;
  const spec = LAYOUTS[layoutName];
  const keys = createKeyHolder();
  const pads = [];
  const buzz = () => { if (prefs.haptics) navigator.vibrate?.(8); };

  if (getComputedStyle(containerEl).position === 'static') containerEl.style.position = 'relative';

  const root = el('div', 'kz-tc');
  root.dataset.layout = layoutName;
  root.dataset.hand = prefs.leftHanded ? 'left' : 'right';
  root.style.setProperty('--kz-tc-scale', String(clamp(prefs.size, 0.7, 1.5)));
  root.style.setProperty('--kz-tc-alpha', String(clamp(prefs.opacity, 0.3, 1)));
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'On-screen game controls');

  const pad = spec.pad === 'dpad' ? buildDpad(keys, pads, buzz)
    : spec.pad === 'stick' ? buildStick(keys, pads, buzz)
    : buildTrackpad(keys, pads, buzz);

  const items = new Map(); // id -> { el, kind: 'pad' | 'key', baseKey, baseLabel, extra }
  const reg = (id, node, kind, baseKey, baseLabel) => { node.dataset.id = id; items.set(id, { el: node, kind, baseKey, baseLabel }); return node; };
  reg('pad', pad, 'pad');

  const actions = el('div', 'kz-tc-actions');
  spec.buttons.forEach(([label, code, extra], i) => {
    actions.append(reg('a' + i, keyButton(keys, label, code, 'kz-tc-btn kz-tc-action' + (extra ? ' ' + extra : ''), buzz), 'key', code, label));
  });
  root.append(pad, actions);

  if (spec.weapons) {
    const w = el('div', 'kz-tc-weapons');
    spec.weapons.forEach(([label, code], i) => w.append(reg('w' + i, keyButton(keys, label, code, 'kz-tc-btn kz-tc-pill kz-tc-weapon', buzz), 'key', code, label)));
    root.append(w);
  }

  const util = el('div', 'kz-tc-util');
  spec.util.forEach(([label, code], i) => util.append(reg('u' + i, keyButton(keys, label, code, 'kz-tc-btn kz-tc-pill', buzz), 'key', code, label)));

  // Key drawer: every other key a DOS game might ask for.
  const drawer = el('div', 'kz-tc-drawer');
  drawer.hidden = true;
  drawer.setAttribute('role', 'group');
  drawer.setAttribute('aria-label', 'More keys');
  for (const [label, code] of DRAWER_KEYS) drawer.append(keyButton(keys, label, code, 'kz-tc-btn kz-tc-pill kz-tc-dkey', buzz));
  const more = el('button', 'kz-tc-btn kz-tc-pill kz-tc-more');
  more.type = 'button';
  more.textContent = 'Keys';
  more.setAttribute('aria-expanded', 'false');
  more.setAttribute('aria-label', 'Show more keys');
  more.addEventListener('click', () => {
    drawer.hidden = !drawer.hidden;
    more.setAttribute('aria-expanded', String(!drawer.hidden));
  });
  reg('more', more, 'more');
  util.append(more);
  root.append(util, drawer);
  containerEl.append(root);

  /* ---------- Custom layout: move, resize, re-key, hide and add buttons ---------- */
  const ckey = `${opts.gameId || 'default'}:${layoutName}`;
  let custom = (prefs.custom && prefs.custom[ckey]) || { items: {} };
  custom = { items: { ...(custom.items || {}) } };
  let editing = false, selected = null, bar = null, extraN = 0;
  const keyLabel = (code) => (KEY_CHOICES.find((k) => k[0] === code) || [code, code])[1];

  function styleItem(id) {
    const it = items.get(id), c = custom.items[id];
    if (!it || !c || c.x === undefined) return;
    const e = it.el;
    Object.assign(e.style, { position: 'absolute', left: c.x + '%', top: c.y + '%', right: 'auto', bottom: 'auto', margin: '0',
      transform: `scale(${c.s || 1})`, transformOrigin: 'top left', display: c.hidden && !editing ? 'none' : '', opacity: c.hidden && editing ? '0.35' : '' });
    if (it.kind === 'key') {
      e.kzKey = c.key || it.baseKey;
      e.textContent = c.key ? keyLabel(c.key) : it.baseLabel;
      e.setAttribute('aria-label', `${e.textContent} key`);
    }
  }
  function makeExtra(id, key) {
    const label = keyLabel(key);
    const b = keyButton(keys, label, key, 'kz-tc-btn kz-tc-action kz-tc-extra', buzz);
    reg(id, b, 'key', key, label); items.get(id).extra = true;
    root.append(b);
    return b;
  }
  // Positions are stored as percentages of the control area. The preset layout is measured once
  // (before anything is flattened) so a control that was never moved keeps its place.
  function activateCustom() {
    const R = root.getBoundingClientRect();
    if (!R.width || !R.height) return false;
    if (!root.dataset.custom) {
      for (const [id, it] of items) {
        const c = (custom.items[id] = custom.items[id] || {});
        if (c.x !== undefined) continue;
        const r = it.el.getBoundingClientRect();
        c.x = ((r.left - R.left) / R.width) * 100; c.y = ((r.top - R.top) / R.height) * 100; c.s = c.s || 1;
      }
      root.dataset.custom = '1';
    }
    items.forEach((_, id) => styleItem(id));
    return true;
  }
  function saveCustom() {
    const fresh = loadPrefs();
    fresh.custom = { ...fresh.custom, [ckey]: { items: custom.items } };
    savePrefs(fresh);
  }
  function resetCustom() {
    for (const [id, it] of [...items]) {
      if (it.extra) { it.el.remove(); items.delete(id); continue; }
      it.el.removeAttribute('style');
      if (it.kind === 'key') { it.el.kzKey = it.baseKey; it.el.textContent = it.baseLabel; it.el.setAttribute('aria-label', `${it.baseLabel} key`); }
    }
    delete root.dataset.custom;
    custom = { items: {} };
    try { const fresh = loadPrefs(); delete fresh.custom[ckey]; savePrefs(fresh); } catch { /* optional */ }
  }
  for (const [id, c] of Object.entries(custom.items)) if (c.extra) { makeExtra(id, c.key || 'Space'); extraN = Math.max(extraN, Number(id.slice(1)) || 0); }
  const hasCustom = Object.keys(custom.items).length > 0;

  function select(id) {
    selected = id;
    items.forEach((it, k) => it.el.classList.toggle('kz-tc-sel', k === id));
    renderBar();
  }
  function renderBar() {
    if (!bar) return;
    bar.replaceChildren();
    const btn = (text, fn, cls = '') => { const b = el('button', 'kz-tc-btn kz-tc-pill ' + cls); b.type = 'button'; b.textContent = text; b.addEventListener('click', fn); return b; };
    const note = el('span', 'kz-tc-edit-note');
    note.textContent = selected ? 'Drag to move' : 'Tap a control, then drag it';
    bar.append(note,
      btn('+ Button', () => { const id = 'x' + (++extraN); custom.items[id] = { x: 44, y: 30, s: 1, key: 'Space', extra: true }; makeExtra(id, 'Space'); styleItem(id); select(id); }),
      btn('Reset', () => { resetCustom(); activateCustom(); select(null); }),
      btn('Done', finishEdit, 'kz-tc-done'));
    if (selected && items.has(selected)) {
      const it = items.get(selected), c = custom.items[selected];
      const row = el('div', 'kz-tc-edit-row');
      if (it.kind === 'key') {
        const sel = el('select', 'kz-tc-edit-sel'); sel.setAttribute('aria-label', 'Key sent by this button');
        for (const [code, label] of KEY_CHOICES) if (code) { const o = el('option', ''); o.value = code; o.textContent = label; sel.append(o); }
        sel.value = c.key || it.baseKey;
        sel.addEventListener('change', () => { c.key = sel.value; styleItem(selected); });
        row.append(sel);
      }
      const size = el('input', 'kz-tc-edit-size'); size.type = 'range'; size.min = '0.5'; size.max = '2.2'; size.step = '0.05'; size.value = String(c.s || 1);
      size.setAttribute('aria-label', 'Size');
      size.addEventListener('input', () => { c.s = Number(size.value); styleItem(selected); });
      row.append(size);
      if (it.extra) row.append(btn('Delete', () => { it.el.remove(); items.delete(selected); delete custom.items[selected]; select(null); }));
      else row.append(btn(c.hidden ? 'Show' : 'Hide', () => { c.hidden = !c.hidden; styleItem(selected); renderBar(); }));
      bar.append(row);
    }
  }
  const onEditDown = (e) => {
    if (!editing || (bar && bar.contains(e.target))) return;
    e.preventDefault(); e.stopPropagation();
    const node = e.target.closest('[data-id]');
    if (!node || !items.has(node.dataset.id)) { select(null); return; }
    const id = node.dataset.id, c = custom.items[id], R = root.getBoundingClientRect();
    select(id);
    const sx = e.clientX, sy = e.clientY, ox = c.x, oy = c.y;
    node.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const r = node.getBoundingClientRect();
      c.x = Math.max(0, Math.min(100 - (r.width / R.width) * 100, ox + ((ev.clientX - sx) / R.width) * 100));
      c.y = Math.max(0, Math.min(100 - (r.height / R.height) * 100, oy + ((ev.clientY - sy) / R.height) * 100));
      styleItem(id);
    };
    const done = () => { node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', done); node.removeEventListener('pointercancel', done); };
    node.addEventListener('pointermove', move); node.addEventListener('pointerup', done); node.addEventListener('pointercancel', done);
  };
  const onEditClick = (e) => { if (editing && !(bar && bar.contains(e.target))) { e.preventDefault(); e.stopPropagation(); } };
  root.addEventListener('pointerdown', onEditDown, true);
  root.addEventListener('click', onEditClick, true);

  function startEdit() {
    if (editing) return;
    setVisible(true);
    if (!activateCustom()) return;
    editing = true; releaseEverything();
    drawer.hidden = true; more.setAttribute('aria-expanded', 'false');
    root.classList.add('kz-tc-editing');
    bar = el('div', 'kz-tc-edit'); bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Edit on-screen controls');
    root.append(bar);
    items.forEach((_, id) => styleItem(id));
    select(null);
  }
  function finishEdit() {
    if (!editing) return;
    editing = false; selected = null;
    root.classList.remove('kz-tc-editing');
    items.forEach((it) => it.el.classList.remove('kz-tc-sel'));
    if (bar) { bar.remove(); bar = null; }
    items.forEach((_, id) => styleItem(id));
    saveCustom();
    if (opts.onEditEnd) opts.onEditEnd();
  }

  /* Visibility: shown on touch-first devices (or when forced), hidden once a physical key
     or gamepad is used, shown again on the next touch. */
  let visible = true;
  function setVisible(next) {
    if (next === visible) return;
    visible = next;
    root.hidden = !next;
    if (!next) releaseEverything(); else if (hasCustom && !root.dataset.custom) requestAnimationFrame(activateCustom);
  }
  function releaseEverything() {
    pads.forEach((p) => p.cancel());
    keys.releaseAll();
    root.querySelectorAll('.is-down').forEach((n) => n.classList.remove('is-down'));
  }

  const onKeyDown = (e) => {
    // Ignore synthetic events and keys pressed on the controls themselves
    if (opts.manual || editing || !e.isTrusted || root.contains(e.target)) return;
    if (!opts.force) setVisible(false);
  };
  const onPointerDown = (e) => { if (!opts.manual && e.pointerType === 'touch') setVisible(true); };
  const onGamepad = () => { if (!opts.manual && !opts.force && !editing) setVisible(false); };
  const onVisibility = () => { if (document.hidden) releaseEverything(); };

  // manual: the player opens and closes the controls (show/hide); nothing else toggles them.
  setVisible(opts.manual ? !!opts.open : (!!opts.force || window.matchMedia('(pointer: coarse)').matches));
  if (hasCustom) requestAnimationFrame(() => { if (!root.hidden) activateCustom(); });
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('kz:gamepad-active', onGamepad);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', releaseEverything);
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    show: () => setVisible(true),
    hide: () => setVisible(false),
    edit: startEdit,
    isEditing: () => editing,
    destroy() {
      releaseEverything();
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('kz:gamepad-active', onGamepad);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', releaseEverything);
      root.remove();
    }
  };
}

/* ---------- Key state ---------- */

/* Several fingers (or a finger plus the keyboard) can hold the same key.
   The key goes down on the first holder and up when the last one lets go. */
function createKeyHolder() {
  const held = new Map(); // code -> Set of source ids
  const send = (code, pressed) => window.KZPlayer?.sendKey(code, pressed);
  return {
    press(code, source) {
      let sources = held.get(code);
      if (!sources) { sources = new Set(); held.set(code, sources); }
      const first = sources.size === 0;
      sources.add(source);
      if (first) send(code, true);
    },
    release(code, source) {
      const sources = held.get(code);
      if (!sources || !sources.delete(source)) return;
      if (sources.size === 0) { held.delete(code); send(code, false); }
    },
    releaseAll() {
      for (const code of held.keys()) send(code, false);
      held.clear();
    }
  };
}

/* ---------- Building blocks ---------- */

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

/** A round or pill button that holds one key while pressed. The key can be changed later (b.kzKey). */
function keyButton(keys, label, code, className, buzz) {
  const b = el('button', className);
  b.type = 'button';
  b.textContent = label;
  b.kzKey = code;
  b.setAttribute('aria-label', `${label} key`);

  const used = new Map(); // source -> key held, so a key change never leaves a key stuck down
  const down = (source) => { if (used.has(source)) return; used.set(source, b.kzKey); keys.press(b.kzKey, source); b.classList.add('is-down'); };
  const up = (source) => { if (!used.has(source)) return; const c = used.get(source); used.delete(source); keys.release(c, source); b.classList.remove('is-down'); };

  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    down(`p${e.pointerId}`);
    buzz();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    b.addEventListener(type, (e) => up(`p${e.pointerId}`));
  }
  addKeyboardSupport(b, down, up);
  return b;
}

/* Enter or Space on a focused control presses its key, for keyboard and
   switch users who reach the controls with Tab. */
function addKeyboardSupport(b, down, up) {
  const isActivation = (e) => e.key === 'Enter' || e.key === ' ';
  b.addEventListener('keydown', (e) => {
    if (!isActivation(e)) return;
    e.preventDefault();
    e.stopPropagation(); // keep the player's own key listener from seeing it twice
    if (!e.repeat) down('kb');
  });
  b.addEventListener('keyup', (e) => {
    if (!isActivation(e)) return;
    e.stopPropagation();
    up('kb');
  });
  b.addEventListener('blur', () => up('kb'));
}

/** Turn a drag vector into the set of arrow keys it points at (8-way). */
function directionKeys(dx, dy, deadZone) {
  const dist = Math.hypot(dx, dy);
  const out = new Set();
  if (dist < deadZone) return out;
  const cos = dx / dist;
  const sin = dy / dist; // screen y grows downward
  if (cos > DIR_THRESHOLD) out.add(K.RIGHT); else if (cos < -DIR_THRESHOLD) out.add(K.LEFT);
  if (sin > DIR_THRESHOLD) out.add(K.DOWN); else if (sin < -DIR_THRESHOLD) out.add(K.UP);
  return out;
}

/* One finger steers a pad. relative=false measures from the pad's centre
   (d-pad, stick); relative=true measures from where the finger landed (trackpad). */
function trackDirection(pad, keys, { relative, onChange = () => {}, onMove = null, onTap = null, buzz = () => {} }) {
  let active = null;

  function apply(next) {
    const source = `pad${active.id}`;
    for (const code of active.dirs) if (!next.has(code)) keys.release(code, source);
    for (const code of next) if (!active.dirs.has(code)) keys.press(code, source);
    active.dirs = next;
    onChange(next);
  }

  function update(e) {
    const dx = e.clientX - active.ox;
    const dy = e.clientY - active.oy;
    if (Math.hypot(dx, dy) > TAP_SLOP_PX) active.moved = true;
    if (onMove) onMove(dx, dy, active.rect);
    apply(directionKeys(dx, dy, active.dead));
  }

  function end(e) {
    if (!active || e.pointerId !== active.id) return;
    const wasTap = relative && e.type === 'pointerup' && !active.moved &&
      performance.now() - active.startedAt < TAP_MS;
    apply(new Set());
    if (onMove) onMove(0, 0, active.rect);
    active = null;
    if (wasTap && onTap) onTap();
  }

  pad.addEventListener('pointerdown', (e) => {
    if (active) return;
    e.preventDefault();
    const rect = pad.getBoundingClientRect();
    active = {
      id: e.pointerId,
      rect,
      ox: relative ? e.clientX : rect.left + rect.width / 2,
      oy: relative ? e.clientY : rect.top + rect.height / 2,
      dead: relative ? 14 : rect.width * 0.12,
      startedAt: performance.now(),
      moved: false,
      dirs: new Set()
    };
    pad.setPointerCapture(e.pointerId);
    buzz();
    update(e);
  });
  pad.addEventListener('pointermove', (e) => { if (active && e.pointerId === active.id) update(e); });
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);

  return { cancel() { if (active) { apply(new Set()); if (onMove) onMove(0, 0, active.rect); active = null; } } };
}

function buildDpad(keys, pads, buzz) {
  const pad = el('div', 'kz-tc-pad kz-tc-pad--dpad');
  pad.setAttribute('role', 'group');
  pad.setAttribute('aria-label', 'Directional pad');

  const arrows = new Map();
  for (const [code, name, num] of [[K.UP, 'Up', 38], [K.LEFT, 'Left', 37], [K.RIGHT, 'Right', 39], [K.DOWN, 'Down', 40]]) {
    const b = el('button', 'kz-tc-arrow');
    b.type = 'button';
    b.dataset.key = String(num);
    b.setAttribute('aria-label', `${name} arrow`);
    addKeyboardSupport(
      b,
      (source) => keys.press(code, source),
      (source) => keys.release(code, source)
    );
    arrows.set(code, b);
    pad.append(b);
  }

  pads.push(trackDirection(pad, keys, {
    relative: false, buzz,
    onChange: (dirs) => arrows.forEach((b, code) => b.classList.toggle('is-down', dirs.has(code)))
  }));
  return pad;
}

/* Analog-looking stick: the knob follows the finger, output is 8-way arrow keys. */
function buildStick(keys, pads, buzz) {
  const pad = el('div', 'kz-tc-pad kz-tc-pad--stick');
  pad.setAttribute('role', 'group');
  pad.setAttribute('aria-label', 'Move stick. Drag to walk and turn.');
  const knob = el('div', 'kz-tc-knob');
  knob.setAttribute('aria-hidden', 'true');
  pad.append(knob);
  pads.push(trackDirection(pad, keys, {
    relative: false, buzz,
    onMove(dx, dy, rect) {
      const max = rect.width * 0.34;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, max / d);
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    },
    onChange: (dirs) => pad.classList.toggle('is-down', dirs.size > 0)
  }));
  return pad;
}

function buildTrackpad(keys, pads, buzz) {
  const pad = el('div', 'kz-tc-pad kz-tc-pad--trackpad');
  pad.setAttribute('role', 'group');
  pad.setAttribute('aria-label', 'Move pad. Drag to move, tap to click.');

  const hint = el('span', 'kz-tc-hint');
  hint.textContent = 'Drag to move, tap to click';
  hint.setAttribute('aria-hidden', 'true');
  pad.append(hint);

  pads.push(trackDirection(pad, keys, {
    relative: true, buzz,
    onTap() {
      keys.press(K.ENTER, 'tap');
      setTimeout(() => keys.release(K.ENTER, 'tap'), 60);
    }
  }));
  return pad;
}
