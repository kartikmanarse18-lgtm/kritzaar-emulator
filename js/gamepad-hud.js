// KritZaar controller status: one small module used by the player and the web-game page.
// It only reads the browser Gamepad API (no game data leaves the device) and shows
//  - a short toast when a controller connects or disconnects
//  - a chip that always says whether a controller is connected
// It works for every engine (DOS, Originals, NES/Game Boy, Flash, web games) because it never sends keys.
// Text is set with textContent.

const STYLE_ID = 'kz-hud-style';
const CSS = `
.kz-toast-host{position:fixed;left:0;right:0;bottom:calc(16px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:center;gap:8px;z-index:2147483000;pointer-events:none}
.kz-toast{max-width:min(92vw,420px);padding:10px 16px;border-radius:12px;background:#191a30;color:#f1f0fa;border:1px solid rgba(255,255,255,.22);box-shadow:0 8px 28px rgba(0,0,0,.55);font:600 .9rem/1.3 system-ui,sans-serif;animation:kz-toast-in .2s ease-out}
@keyframes kz-toast-in{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}
.kz-padchip{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:12px;background:rgba(255,255,255,.09);color:#f1f0fa;font:600 .85rem system-ui,sans-serif;white-space:nowrap}
.kz-padchip i{width:10px;height:10px;border-radius:50%;background:#777;flex:none}
.kz-padchip.on i{background:#3ddc84;box-shadow:0 0 0 3px rgba(61,220,132,.22)}
.kz-padchip .kz-padchip-name{overflow:hidden;text-overflow:ellipsis;max-width:16ch}
@media (prefers-reduced-motion:reduce){.kz-toast{animation:none}}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.append(s);
}

/** "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e ...)" becomes "Xbox 360 Controller". */
export function padName(id) {
  const n = String(id || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return (n || 'Controller').slice(0, 40);
}

let host;
export function toast(text, ms = 2600) {
  ensureStyle();
  if (!host) {
    host = document.createElement('div'); host.className = 'kz-toast-host';
    host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite');
    document.body.append(host);
  }
  const t = document.createElement('div'); t.className = 'kz-toast'; t.textContent = text;
  host.append(t);
  setTimeout(() => t.remove(), ms);
}

const first = () => {
  try { return (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).find((p) => p && p.connected) || null; } catch { return null; }
};

/** Watches for controllers. Returns { current(), onChange(cb), stop() }. */
export function watchGamepads({ announce = true } = {}) {
  const subs = new Set();
  let last = first();
  const emit = () => subs.forEach((cb) => { try { cb(last); } catch { /* subscriber error */ } });
  const update = (note) => {
    const now = first();
    const changed = (now && now.id) !== (last && last.id);
    last = now;
    if (changed) {
      if (announce && note) toast(now ? padName(now.id) + ' connected' : 'Controller disconnected');
      emit();
    }
  };
  const on = () => update(true), off = () => update(true), focus = () => update(false);
  window.addEventListener('gamepadconnected', on);
  window.addEventListener('gamepaddisconnected', off);
  window.addEventListener('focus', focus);
  // Chrome only reports a pad after its first button press; a slow poll catches the rest.
  const poll = setInterval(() => update(false), 1500);
  return {
    current: () => last,
    onChange(cb) { subs.add(cb); cb(last); return () => subs.delete(cb); },
    stop() { clearInterval(poll); window.removeEventListener('gamepadconnected', on); window.removeEventListener('gamepaddisconnected', off); window.removeEventListener('focus', focus); subs.clear(); },
  };
}

/** Adds a live "controller connected" chip to `container`. Returns the chip element. */
export function mountChip(container, watcher) {
  ensureStyle();
  const chip = document.createElement('span'); chip.className = 'kz-padchip';
  chip.setAttribute('role', 'status');
  const dot = document.createElement('i'); dot.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span'); name.className = 'kz-padchip-name';
  chip.append(dot, name);
  watcher.onChange((p) => {
    chip.classList.toggle('on', !!p);
    name.textContent = p ? padName(p.id) : 'No controller';
    chip.title = p ? 'Controller connected: ' + padName(p.id) : 'No controller found. Connect one by Bluetooth or USB, then press any button.';
  });
  container.append(chip);
  return chip;
}
