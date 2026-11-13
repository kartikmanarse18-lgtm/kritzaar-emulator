// Tidepool: an original flood-fill puzzle by KritZaar. Flood the whole pool with one colour before you run out of moves.
const W = 360, H = 480, N = 12, CELL = 26, OX = (W - N * CELL) / 2, OY = 62, LIMIT = 21;
const COLORS = ['#e4572e', '#f3a712', '#7bc950', '#29a3a3', '#4361ee', '#b5179e'];
const names = ['coral', 'amber', 'moss', 'teal', 'blue', 'plum'];
function symbol(g, i, cx, cy, r) {
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath();
  if (i === 0) g.arc(cx, cy, r, 0, 7);
  else if (i === 1) g.rect(cx - r, cy - r, r * 2, r * 2);
  else if (i === 2) { g.moveTo(cx, cy - r); g.lineTo(cx + r, cy + r); g.lineTo(cx - r, cy + r); }
  else if (i === 3) { g.moveTo(cx, cy - r - 1); g.lineTo(cx + r + 1, cy); g.lineTo(cx, cy + r + 1); g.lineTo(cx - r - 1, cy); }
  else if (i === 4) { g.rect(cx - r, cy - 1.5, r * 2, 3); g.rect(cx - 1.5, cy - r, 3, r * 2); }
  else { g.moveTo(cx - r, cy - r); g.lineTo(cx + r, cy + r); g.lineTo(cx + r, cy + r - 3); g.lineTo(cx - r + 3, cy - r); g.moveTo(cx + r, cy - r); g.lineTo(cx - r, cy + r); g.lineTo(cx - r + 3, cy + r); g.lineTo(cx + r, cy - r + 3); }
  g.fill();
}
const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
export default {
  width: W, height: H,
  create(kit, saved) {
    const save = { wins: 0, best: 0, streak: 0, lastDaily: 0, game: null, ...(saved || {}) };
    let board, seed, mode, moves, state = 'play', flash = 0;
    function build(sd, md, replay) {
      seed = sd; mode = md; const r = kit.rng(seed); moves = []; state = 'play';
      board = Array.from({ length: N * N }, () => Math.floor(r() * 6));
      (replay || []).forEach((c) => play(c, true));
    }
    function flood(c) {
      const from = board[0]; if (from === c) return false;
      const seen = new Uint8Array(N * N), st = [0];
      while (st.length) { const i = st.pop(); if (seen[i] || board[i] !== from) continue; seen[i] = 1; const x = i % N, y = (i / N) | 0; if (x) st.push(i - 1); if (x < N - 1) st.push(i + 1); if (y) st.push(i - N); if (y < N - 1) st.push(i + N); }
      for (let i = 0; i < seen.length; i++) if (seen[i]) board[i] = c;
      return true;
    }
    function play(c, quiet) {
      if (state !== 'play' || !flood(c)) return;
      moves.push(c); if (!quiet) kit.beep(300 + c * 70, 0.06, 'triangle', 0.05);
      if (board.every((v) => v === board[0])) {
        state = 'won'; flash = 1;
        if (!quiet) { save.wins++; save.best = save.best ? Math.min(save.best, moves.length) : moves.length; if (mode === 'daily' && save.lastDaily !== seed) { save.streak = save.lastDaily === prevDay(seed) ? save.streak + 1 : 1; save.lastDaily = seed; } save.game = null; kit.beep(660, 0.25, 'sine', 0.06, 440); kit.autosave(save); }
      } else if (moves.length >= LIMIT) { state = 'lost'; if (!quiet) { save.game = null; kit.beep(150, 0.3, 'sawtooth', 0.05, -60); kit.autosave(save); } }
      else if (!quiet) { save.game = { seed, mode, moves }; kit.autosave(save); }
    }
    function prevDay(d) { const dt = new Date(Math.floor(d / 10000), Math.floor(d / 100) % 100 - 1, d % 100); dt.setDate(dt.getDate() - 1); return dt.getFullYear() * 10000 + (dt.getMonth() + 1) * 100 + dt.getDate(); }
    const fresh = (md) => build(md === 'daily' ? today() : (Date.now() % 1e9) + 1, md);
    if (save.game && save.game.moves && save.game.moves.length < LIMIT) build(save.game.seed, save.game.mode, save.game.moves); else fresh('daily');
    const btn = (i) => ({ x: 14 + i * 56, y: 392, w: 50, h: 50 });
    const link = (id) => (id === 'daily' ? { x: 14, y: 452, w: 150, h: 22 } : { x: 196, y: 452, w: 150, h: 22 });
    const hit = (r, p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    return {
      getSave: () => ({ ...save, game: state === 'play' && moves.length ? { seed, mode, moves } : null }),
      update(dt) {
        flash = Math.max(0, flash - dt);
        for (let i = 0; i < 6; i++) if (kit.wasPressed(String(i + 1))) play(i);
        if (kit.wasPressed('restart')) fresh('random');
        if (kit.pointer.tapped) {
          for (let i = 0; i < 6; i++) if (hit(btn(i), kit.pointer)) play(i);
          if (hit(link('daily'), kit.pointer)) fresh('daily'); else if (hit(link('random'), kit.pointer)) fresh('random');
        }
        if (state !== 'play' && (kit.wasPressed('action') || kit.wasPressed('next'))) fresh('random');
      },
      draw(g) {
        g.fillStyle = '#10243a'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#16314d'; g.fillRect(0, 0, W, 50);
        kit.text('TIDEPOOL', 14, 18, { size: 16, color: '#8fe3d6' });
        kit.text(mode === 'daily' ? 'daily pool' : 'random pool', 14, 38, { size: 10, color: '#9bb7d1' });
        kit.text(`moves ${moves.length}/${LIMIT}`, W - 14, 18, { size: 14, align: 'right' });
        kit.text(`wins ${save.wins}  best ${save.best || '-'}  streak ${save.streak}`, W - 14, 38, { size: 10, align: 'right', color: '#9bb7d1' });
        for (let i = 0; i < board.length; i++) {
          const x = OX + (i % N) * CELL, y = OY + ((i / N) | 0) * CELL;
          g.fillStyle = COLORS[board[i]]; g.fillRect(x, y, CELL - 1, CELL - 1); symbol(g, board[i], x + CELL / 2 - 0.5, y + CELL / 2 - 0.5, 4);
        }
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(OX - 1, OY - 1, CELL - 1 + 2, CELL - 1 + 2);
        kit.text('Pick a colour. Your pool grows from the top-left corner.', W / 2, 376, { size: 10, align: 'center', color: '#9bb7d1' });
        for (let i = 0; i < 6; i++) {
          const b = btn(i); g.fillStyle = COLORS[i]; g.fillRect(b.x, b.y, b.w, b.h); symbol(g, i, b.x + b.w / 2, b.y + b.h / 2, 9);
          kit.text(String(i + 1), b.x + 6, b.y + 8, { size: 9, color: '#000' });
          if (board[0] === i) { g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2); }
        }
        [['daily', "today's pool"], ['random', 'new random pool']].forEach(([id, label]) => { const r = link(id); g.fillStyle = '#1f4468'; g.fillRect(r.x, r.y, r.w, r.h); kit.text(label, r.x + r.w / 2, r.y + r.h / 2, { size: 10, align: 'center' }); });
        if (state !== 'play') {
          g.fillStyle = 'rgba(8,16,28,0.78)'; g.fillRect(0, 150, W, 90);
          const won = state === 'won';
          kit.text(won ? 'The pool is calm' : 'Out of moves', W / 2, 180, { size: 20, align: 'center', color: won ? '#8fe3d6' : '#ff9d7a' });
          kit.text(won ? `Solved in ${moves.length} moves. ${'★'.repeat(Math.max(1, 1 + Math.min(2, Math.floor((LIMIT - moves.length) / 4))))}` : 'Try a new pool', W / 2, 206, { size: 12, align: 'center' });
          kit.text('Press N or tap a pool button for another', W / 2, 226, { size: 10, align: 'center', color: '#9bb7d1' });
        }
      },
    };
  },
};
