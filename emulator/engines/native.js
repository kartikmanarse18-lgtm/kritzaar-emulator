// Native adapter: runs KritZaar's own games from /originals/games/. No emulator, no third-party code.
import { createKit } from '/originals/kit.js';

const enc = (o) => new TextEncoder().encode(JSON.stringify(o));
const dec = (b) => { try { return b ? JSON.parse(new TextDecoder().decode(b)) : null; } catch { return null; } };

export async function start(ctx) {
  const { root, entry, batteryBytes, onBattery } = ctx;
  if (!entry || typeof entry.module !== 'string' || !/^\/originals\/games\/[a-z0-9-]+\.js$/.test(entry.module)) {
    throw Object.assign(new Error('This original game is not set up correctly.'), { code: 'ENGINE_FAILED' });
  }
  const def = (await import(entry.module)).default;
  const kit = createKit(root, { width: def.width, height: def.height });
  kit.canvas.setAttribute('aria-label', entry.title + ' (game canvas)');
  let timer = 0;
  kit.onAutosave = (obj) => { clearTimeout(timer); timer = setTimeout(() => onBattery && onBattery(enc(obj)), 400); };
  let inst = def.create(kit, dec(batteryBytes));
  kit.run(inst);
  return {
    kind: 'native', kit,
    pause() { kit.pause(); },
    resume() { kit.resume(); },
    async saveState() { return enc(inst.getSave()); },
    async loadState(bytes) { inst = def.create(kit, dec(bytes)); kit.run(inst); },
    async stop() { clearTimeout(timer); try { onBattery && onBattery(enc(inst.getSave())); } catch { /* best effort */ } kit.destroy(); },
  };
}
