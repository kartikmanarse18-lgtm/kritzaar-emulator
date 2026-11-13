// KritZaar Originals runtime. Small, dependency-free helpers shared by our own games.
// Everything in /originals/ is written by KritZaar (see LICENSE.txt). No third-party game code or assets.
export function createKit(root, { width, height }) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height; canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;touch-action:none;outline:none;background:#000;display:block';
  root.replaceChildren(canvas);
  const g = canvas.getContext('2d');
  const held = new Set(), pressed = new Set();
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'action', Enter: 'action', KeyZ: 'action', KeyX: 'action', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5', Digit6: '6', KeyR: 'restart', KeyN: 'next' };
  const kd = (e) => { const a = KEYMAP[e.code]; if (!a) return; e.preventDefault(); if (!held.has(a)) pressed.add(a); held.add(a); };
  const ku = (e) => { const a = KEYMAP[e.code]; if (a) { e.preventDefault(); held.delete(a); } };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);

  const pointer = { x: width / 2, y: height / 2, down: false, tapped: false, inside: false };
  const toLogical = (e) => {
    const r = canvas.getBoundingClientRect(), s = Math.min(r.width / width, r.height / height);
    const ox = (r.width - width * s) / 2, oy = (r.height - height * s) / 2;
    pointer.x = (e.clientX - r.left - ox) / s; pointer.y = (e.clientY - r.top - oy) / s;
  };
  canvas.addEventListener('pointerdown', (e) => { toLogical(e); pointer.down = true; pointer.tapped = true; pointer.inside = true; canvas.focus(); try { canvas.setPointerCapture(e.pointerId); } catch { /* ok */ } });
  canvas.addEventListener('pointermove', (e) => { toLogical(e); pointer.inside = true; });
  canvas.addEventListener('pointerup', () => { pointer.down = false; });
  canvas.addEventListener('pointercancel', () => { pointer.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  let audio = null, muted = false;
  function beep(freq = 440, dur = 0.08, type = 'square', vol = 0.05, slide = 0) {
    if (muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const o = audio.createOscillator(), v = audio.createGain(), t = audio.currentTime;
      o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
      v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(v).connect(audio.destination); o.start(t); o.stop(t + dur);
    } catch { /* audio is optional */ }
  }

  function text(str, x, y, { size = 12, align = 'left', color = '#fff', weight = 'bold' } = {}) {
    g.font = `${weight} ${size}px ui-monospace, Menlo, Consolas, monospace`;
    g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(str, x, y);
  }

  // Seeded random so puzzles and levels can be replayed from a small save.
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  let paused = false, raf = 0, last = 0, running = true, game = null;
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    if (!paused && game) { game.update(dt); game.draw(g); }
    pressed.clear(); pointer.tapped = false;
  }
  return {
    canvas, g, width, height, held, pressed, pointer, beep, text, rng,
    onAutosave: null, autosave(obj) { if (this.onAutosave) this.onAutosave(obj); },
    isHeld: (a) => held.has(a), wasPressed: (a) => pressed.has(a),
    setMuted(m) { muted = !!m; },
    run(instance) { cancelAnimationFrame(raf); game = instance; last = performance.now(); raf = requestAnimationFrame(frame); canvas.focus(); },
    pause() { paused = true; }, resume() { paused = false; last = performance.now(); canvas.focus(); },
    get paused() { return paused; },
    destroy() { running = false; cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); try { audio && audio.close(); } catch { /* ok */ } root.replaceChildren(); },
  };
}
