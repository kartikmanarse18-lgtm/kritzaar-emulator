// Starling Drift: an original collect-and-dodge game by KritZaar. Steer with arrows/WASD or drag.
const W = 480, H = 270;
export default {
  width: W, height: H,
  create(kit, saved) {
    const save = { best: 0, seeds: 0, ...(saved || {}) };
    let p, items, clouds, t = 0, spawnT = 0, cloudT = 0, state = 'title', rnd, trail;
    const reset = () => { rnd = kit.rng(Date.now() & 0xffff); p = { x: 90, y: H / 2, vx: 0, vy: 0, lives: 3, score: 0, combo: 0, inv: 0, speed: 1 }; items = []; clouds = []; trail = []; t = 0; spawnT = 0; cloudT = 1.5; };
    reset();
    const hurt = () => {
      if (p.inv > 0) return;
      p.lives--; p.inv = 1.4; p.combo = 0; kit.beep(170, 0.25, 'sawtooth', 0.06, -80);
      if (p.lives <= 0) { state = 'over'; if (p.score > save.best) save.best = p.score; save.seeds += Math.floor(p.score / 10); kit.autosave(save); }
    };
    return {
      getSave: () => save,
      update(dt) {
        if (state !== 'play') { if (kit.wasPressed('action') || kit.pointer.tapped || kit.wasPressed('restart')) { reset(); state = 'play'; kit.beep(600, 0.08, 'triangle'); } return; }
        t += dt; p.speed = 1 + Math.min(1.4, t / 70); p.inv = Math.max(0, p.inv - dt);
        let ax = 0, ay = 0;
        if (kit.isHeld('left')) ax -= 1; if (kit.isHeld('right')) ax += 1; if (kit.isHeld('up')) ay -= 1; if (kit.isHeld('down')) ay += 1;
        if (kit.pointer.down) { const dx = kit.pointer.x - p.x, dy = kit.pointer.y - p.y, d = Math.hypot(dx, dy) || 1; if (d > 6) { ax = dx / d; ay = dy / d; } }
        p.vx += ax * 900 * dt; p.vy += ay * 900 * dt; p.vx *= Math.pow(0.04, dt); p.vy *= Math.pow(0.04, dt);
        p.x = Math.max(12, Math.min(W - 12, p.x + p.vx * dt)); p.y = Math.max(12, Math.min(H - 12, p.y + p.vy * dt));
        trail.push({ x: p.x, y: p.y, a: 1 }); trail.forEach((q) => { q.a -= dt * 2.4; q.x -= 90 * p.speed * dt; }); trail = trail.filter((q) => q.a > 0);
        spawnT -= dt; if (spawnT <= 0) { items.push({ x: W + 12, y: 24 + rnd() * (H - 48), ph: rnd() * 6 }); spawnT = 0.55 / p.speed + rnd() * 0.5; }
        cloudT -= dt; if (cloudT <= 0) { clouds.push({ x: W + 40, y: 30 + rnd() * (H - 60), r: 16 + rnd() * 14, ph: rnd() * 6, amp: 20 + rnd() * 40 }); cloudT = 1.5 / p.speed + rnd() * 1.2; }
        items.forEach((o) => { o.x -= 110 * p.speed * dt; }); clouds.forEach((c) => { c.x -= 85 * p.speed * dt; c.yy = c.y + Math.sin(t * 1.4 + c.ph) * c.amp; });
        items = items.filter((o) => { if (Math.hypot(o.x - p.x, o.y + Math.sin(t * 3 + o.ph) * 4 - p.y) < 14) { p.combo++; p.score += 10 * Math.min(5, 1 + Math.floor(p.combo / 4)); kit.beep(700 + Math.min(p.combo, 12) * 40, 0.06, 'sine', 0.05); return false; } return o.x > -12; });
        clouds = clouds.filter((c) => { if (Math.hypot(c.x - p.x, (c.yy ?? c.y) - p.y) < c.r + 6) hurt(); return c.x > -60; });
      },
      draw(g) {
        const d = Math.min(1, t / 120);
        const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, `rgb(${70 - d * 40},${150 - d * 70},${210 - d * 70})`); sky.addColorStop(1, `rgb(${200 - d * 100},${225 - d * 110},${240 - d * 90})`);
        g.fillStyle = sky; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 6; i++) { const x = ((i * 130 - t * 22 * (1 + i % 3)) % (W + 120) + W + 120) % (W + 120) - 60; g.fillRect(x, 30 + i * 38, 70, 8); }
        items.forEach((o) => { const y = o.y + Math.sin(t * 3 + o.ph) * 4; g.fillStyle = '#ffe27a'; g.beginPath(); g.ellipse(o.x, y, 5, 8, 0.6, 0, 7); g.fill(); g.fillStyle = '#b8892b'; g.fillRect(o.x - 1, y - 1, 2, 2); });
        clouds.forEach((c) => { const y = c.yy ?? c.y; g.fillStyle = '#3b4560'; for (let k = -1; k <= 1; k++) { g.beginPath(); g.arc(c.x + k * c.r * 0.7, y + Math.abs(k) * 4, c.r * (k ? 0.75 : 1), 0, 7); g.fill(); } g.fillStyle = '#ffe27a'; g.fillRect(c.x - 1, y + c.r - 2, 2, 8); });
        trail.forEach((q) => { g.fillStyle = `rgba(255,255,255,${q.a * 0.5})`; g.fillRect(q.x - 2, q.y - 1, 4, 3); });
        if (!(p.inv > 0 && Math.floor(p.inv * 12) % 2)) { g.save(); g.translate(p.x, p.y); g.rotate(Math.max(-0.5, Math.min(0.5, p.vy / 400))); g.fillStyle = '#2d2a3e'; g.beginPath(); g.moveTo(12, 0); g.lineTo(-9, -8 - Math.sin(t * 22) * 4); g.lineTo(-4, 0); g.lineTo(-9, 8 + Math.sin(t * 22) * 4); g.fill(); g.fillStyle = '#ffe27a'; g.fillRect(6, -2, 2, 2); g.restore(); }
        kit.text(String(p.score), 12, 16, { size: 16, color: '#14213d' }); kit.text('♥'.repeat(p.lives), 12, 34, { size: 12, color: '#c1121f' });
        kit.text(`best ${save.best}`, W - 12, 16, { size: 11, align: 'right', color: '#14213d' });
        if (p.combo > 3) kit.text(`combo ${p.combo}`, W - 12, 32, { size: 10, align: 'right', color: '#7a4b00' });
        if (state !== 'play') {
          g.fillStyle = 'rgba(10,18,40,0.6)'; g.fillRect(0, 70, W, 100);
          kit.text(state === 'title' ? 'STARLING DRIFT' : 'Blown off course', W / 2, 98, { size: 22, align: 'center', color: '#ffe27a' });
          kit.text(state === 'title' ? 'Steer with arrow keys, WASD, or drag. Gather seeds, dodge storm clouds.' : `Score ${p.score}`, W / 2, 128, { size: 11, align: 'center' });
          kit.text('Tap, click or press Space to fly', W / 2, 150, { size: 10, align: 'center', color: '#cdd6f4' });
        }
      },
    };
  },
};
