// Lantern Run: an original one-button night runner by KritZaar. Hold to jump higher.
const W = 480, H = 270, GROUND = 210;
export default {
  width: W, height: H,
  create(kit, saved) {
    const save = { best: 0, lanterns: 0, runs: 0, ...(saved || {}) };
    let s, state = 'title', t = 0, shake = 0;
    const stars = Array.from({ length: 40 }, (_, i) => ({ x: (i * 97) % W, y: (i * 53) % 150, r: 0.6 + (i % 3) * 0.5 }));
    const reset = () => { s = { x: 90, y: GROUND, vy: 0, air: 0, coyote: 0, speed: 190, dist: 0, lanterns: 0, obs: [], pick: [], next: 260, rnd: kit.rng(Date.now() & 0xffff), hold: 0 }; };
    reset();
    const spawn = () => {
      const r = s.rnd(), x = W + 40;
      if (r < 0.45) { const h = 22 + Math.floor(s.rnd() * 26); s.obs.push({ type: 'rock', x, w: 24 + Math.floor(s.rnd() * 18), h }); }
      else if (r < 0.75) s.obs.push({ type: 'pit', x, w: 64 + Math.floor(s.rnd() * 40) });
      else { s.obs.push({ type: 'rock', x, w: 20, h: 20 }); s.obs.push({ type: 'rock', x: x + 78, w: 20, h: 34 }); }
      for (let i = 0; i < 4; i++) if (s.rnd() < 0.7) s.pick.push({ x: x - 30 + i * 26, y: GROUND - 70 - Math.sin(i / 3 * Math.PI) * 38, got: false });
      s.next = 190 + s.rnd() * 160 + s.speed * 0.35;
    };
    const jumpPressed = () => kit.wasPressed('action') || kit.wasPressed('up') || kit.pointer.tapped;
    const jumpHeld = () => kit.isHeld('action') || kit.isHeld('up') || kit.pointer.down;
    const die = () => { state = 'over'; shake = 0.3; kit.beep(140, 0.35, 'sawtooth', 0.07, -90); save.runs++; if (Math.floor(s.dist) > save.best) save.best = Math.floor(s.dist); save.lanterns += s.lanterns; kit.autosave(save); };
    return {
      getSave: () => save,
      update(dt) {
        t += dt; shake = Math.max(0, shake - dt);
        if (state !== 'play') { if (jumpPressed() || kit.wasPressed('restart')) { reset(); state = 'play'; kit.beep(520, 0.08, 'triangle'); } return; }
        const p = s, dx = p.speed * dt;
        p.dist += dx / 10; p.speed = Math.min(420, p.speed + dt * 4.5);
        p.next -= dx; if (p.next <= 0) spawn();
        p.obs.forEach((o) => { o.x -= dx; }); p.pick.forEach((o) => { o.x -= dx; });
        p.obs = p.obs.filter((o) => o.x + (o.w || 0) > -20); p.pick = p.pick.filter((o) => o.x > -20 && !o.got);
        const over = p.obs.find((o) => o.type === 'pit' && p.x + 6 > o.x && p.x - 6 < o.x + o.w);
        const grounded = !over && p.y >= GROUND;
        p.coyote = grounded ? 0.09 : Math.max(0, p.coyote - dt);
        if (jumpPressed() && p.coyote > 0) { p.vy = -600; p.coyote = 0; p.hold = 0.18; kit.beep(380, 0.1, 'square', 0.04, 220); }
        if (p.hold > 0 && jumpHeld()) { p.vy -= 1500 * dt; p.hold -= dt; } else p.hold = 0;
        p.vy += 1750 * dt; p.y += p.vy * dt;
        if (!over && p.y > GROUND) { p.y = GROUND; p.vy = 0; }
        if (over && p.y > GROUND + 40) return die();
        if (p.y > H + 30) return die();
        for (const o of p.obs) if (o.type === 'rock' && p.x + 8 > o.x + 3 && p.x - 8 < o.x + o.w - 3 && p.y > GROUND - o.h + 4) return die();
        for (const c of p.pick) if (Math.hypot(c.x - p.x, c.y - (p.y - 14)) < 16) { c.got = true; p.lanterns++; kit.beep(880 + p.lanterns % 5 * 80, 0.07, 'sine', 0.05); }
      },
      draw(g) {
        const dawn = Math.min(1, s.dist / 2500), sx = shake ? (Math.random() - 0.5) * 8 : 0;
        const sky = g.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, `rgb(${12 + dawn * 70},${10 + dawn * 40},${40 + dawn * 50})`); sky.addColorStop(1, `rgb(${40 + dawn * 190},${30 + dawn * 90},${80 + dawn * 20})`);
        g.fillStyle = sky; g.fillRect(0, 0, W, H);
        g.save(); g.translate(sx, 0);
        g.fillStyle = '#fff'; stars.forEach((st) => { g.globalAlpha = (1 - dawn) * (0.5 + 0.5 * Math.sin(t * 2 + st.x)); g.fillRect(((st.x - s.dist * 2) % W + W) % W, st.y, st.r, st.r); }); g.globalAlpha = 1;
        g.fillStyle = `rgb(${20 + dawn * 60},${24 + dawn * 50},${46 + dawn * 40})`;
        g.beginPath(); g.moveTo(0, GROUND);
        for (let x = 0; x <= W; x += 20) g.lineTo(x, GROUND - 30 - Math.sin((x + s.dist * 4) / 60) * 18 - Math.sin((x + s.dist * 4) / 23) * 6);
        g.lineTo(W, GROUND); g.fill();
        g.fillStyle = '#1b1530'; g.fillRect(0, GROUND, W, H - GROUND);
        s.obs.forEach((o) => { if (o.type === 'pit') { g.fillStyle = '#05030a'; g.fillRect(o.x, GROUND, o.w, H - GROUND); } else { g.fillStyle = '#4b3f72'; g.fillRect(o.x, GROUND - o.h, o.w, o.h); g.fillStyle = '#6a5a9a'; g.fillRect(o.x, GROUND - o.h, o.w, 4); } });
        s.pick.forEach((c) => { const gl = g.createRadialGradient(c.x, c.y, 1, c.x, c.y, 14); gl.addColorStop(0, '#fff6b0'); gl.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = gl; g.fillRect(c.x - 14, c.y - 14, 28, 28); g.fillStyle = '#ffd24a'; g.fillRect(c.x - 3, c.y - 4, 6, 8); });
        const px = s.x, py = s.y;
        const gl = g.createRadialGradient(px, py - 14, 2, px, py - 14, 60); gl.addColorStop(0, 'rgba(255,220,120,0.35)'); gl.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gl; g.fillRect(px - 60, py - 74, 120, 120);
        g.fillStyle = '#f2ead7'; g.fillRect(px - 6, py - 22, 12, 20); g.fillRect(px - 4 + Math.sin(t * 18) * (s.y >= GROUND ? 3 : 0), py - 2, 3, 2 + (s.y >= GROUND ? 2 : 0));
        g.fillStyle = '#ffd24a'; g.fillRect(px + 6, py - 16, 5, 7); g.fillStyle = '#111'; g.fillRect(px + 1, py - 18, 2, 2);
        g.restore();
        kit.text(`${Math.floor(s.dist)} m`, 12, 16, { size: 14 }); kit.text(`lanterns ${s.lanterns}`, 12, 32, { size: 10, color: '#ffd24a' });
        kit.text(`best ${save.best} m`, W - 12, 16, { size: 11, align: 'right', color: '#cfc8ee' });
        if (state !== 'play') {
          g.fillStyle = 'rgba(8,6,20,0.62)'; g.fillRect(0, 70, W, 100);
          kit.text(state === 'title' ? 'LANTERN RUN' : 'The light went out', W / 2, 98, { size: 22, align: 'center', color: '#ffd24a' });
          kit.text(state === 'title' ? 'Tap, click or press Space to jump. Hold to jump higher.' : `${Math.floor(s.dist)} m  ·  ${s.lanterns} lanterns`, W / 2, 128, { size: 11, align: 'center' });
          kit.text(state === 'title' ? 'Collect lanterns. Leap pits and stones. Reach dawn.' : 'Tap, click or press Space to run again', W / 2, 150, { size: 10, align: 'center', color: '#cfc8ee' });
        }
      },
    };
  },
};
