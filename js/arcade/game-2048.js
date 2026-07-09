// game-2048.js — 2048 in the site palette: tiles climb from slate through
// cyan into cyber-lime, gold, and magenta at the top. Arrows/WASD or swipe;
// R deals a fresh board.
window.GAMES = window.GAMES || {};
window.GAMES['2048'] = (function () {
  const COLORS = {
    2: '#16283c', 4: '#1d3c56', 8: '#255e83', 16: '#2f86b4', 32: '#54c8ff',
    64: '#7fd8c0', 128: '#a5e88a', 256: '#c8f55a', 512: '#e8d05a',
    1024: '#f5a94a', 2048: '#e05aa9',
  };
  let S, raf = 0;
  let grid, pops, score, state, won, pDown = null;

  function reset() {
    grid = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    pops = {}; score = 0; won = false;
    S.setScore(0);
    addTile(); addTile();
    state = 'play';
  }
  function addTile() {
    const empty = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!grid[y][x]) empty.push([x, y]);
    if (!empty.length) return;
    const [x, y] = empty[(Math.random() * empty.length) | 0];
    grid[y][x] = Math.random() < 0.9 ? 2 : 4;
    pops[y * 4 + x] = performance.now();
  }
  function slide(line) {
    const a = line.filter(v => v);
    const mergedAt = [];
    for (let i = 0; i < a.length - 1; i++) {
      if (a[i] === a[i + 1]) {
        a[i] *= 2; score += a[i];
        if (a[i] === 2048) won = true;
        a.splice(i + 1, 1);
        mergedAt.push(i);
      }
    }
    while (a.length < 4) a.push(0);
    return { a, mergedAt };
  }
  function move(dx, dy) {
    if (state !== 'play') return;
    let changed = false;
    const now = performance.now();
    for (let i = 0; i < 4; i++) {
      // read the line in slide direction
      const line = [];
      for (let j = 0; j < 4; j++) {
        const x = dx ? (dx > 0 ? 3 - j : j) : i;
        const y = dy ? (dy > 0 ? 3 - j : j) : i;
        line.push(grid[y][x]);
      }
      const { a, mergedAt } = slide(line);
      for (let j = 0; j < 4; j++) {
        const x = dx ? (dx > 0 ? 3 - j : j) : i;
        const y = dy ? (dy > 0 ? 3 - j : j) : i;
        if (grid[y][x] !== a[j]) changed = true;
        grid[y][x] = a[j];
        if (mergedAt.includes(j)) pops[y * 4 + x] = now;
      }
    }
    if (changed) {
      addTile();
      S.setScore(score);
      if (isStuck()) state = 'dead';
    }
  }
  function isStuck() {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      if (!grid[y][x]) return false;
      if (x < 3 && grid[y][x] === grid[y][x + 1]) return false;
      if (y < 3 && grid[y][x] === grid[y + 1][x]) return false;
    }
    return true;
  }

  function draw(t) {
    const ctx = S.ctx;
    ctx.fillStyle = '#05080d';
    ctx.fillRect(0, 0, S.w, S.h);

    const size = Math.min(S.w - 36, S.h - 220, 440);
    const gap = 10;
    const cs = (size - gap * 5) / 4;
    const bx = (S.w - size) / 2, by = (S.h - size) / 2 - 10;

    ctx.fillStyle = 'rgba(13,19,29,0.72)';
    ctx.strokeStyle = 'rgba(150,180,210,0.18)';
    ctx.beginPath(); ctx.roundRect(bx, by, size, size, 14); ctx.fill(); ctx.stroke();

    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const px = bx + gap + x * (cs + gap), py = by + gap + y * (cs + gap);
      ctx.fillStyle = 'rgba(150,180,210,0.06)';
      ctx.beginPath(); ctx.roundRect(px, py, cs, cs, 8); ctx.fill();
      const v = grid[y][x];
      if (!v) continue;
      // pop-in / merge scale
      const born = pops[y * 4 + x] || 0;
      const age = Math.min(1, (t - born) / 130);
      const sc = born ? (0.6 + 0.55 * age - 0.15 * Math.sin(age * Math.PI)) : 1;
      const cx = px + cs / 2, cy = py + cs / 2, half = (cs / 2) * Math.min(1.06, sc);
      ctx.fillStyle = COLORS[v] || '#f2f8ff';
      if (v >= 256) { ctx.shadowColor = COLORS[v] || '#fff'; ctx.shadowBlur = 18; }
      ctx.beginPath(); ctx.roundRect(cx - half, cy - half, half * 2, half * 2, 8); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = v >= 32 ? '#06121c' : '#cfe4f4';
      const digits = String(v).length;
      ctx.font = '600 ' + Math.round(cs * (digits <= 2 ? 0.42 : digits === 3 ? 0.34 : 0.27)) + 'px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(v), cx, cy + 1);
      ctx.textBaseline = 'alphabetic';
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(154,176,196,0.6)';
    ctx.font = '12px "IBM Plex Mono", monospace';
    ctx.fillText('arrows / WASD / swipe · R for a fresh board', S.w / 2, by + size + 34);
    if (won) {
      ctx.fillStyle = '#c8f55a';
      ctx.fillText('2048 — howzit! keep going', S.w / 2, by - 16);
    }

    if (state === 'dead') {
      ctx.fillStyle = 'rgba(5,8,13,0.62)';
      ctx.fillRect(0, 0, S.w, S.h);
      ctx.fillStyle = '#e2ecf6';
      ctx.font = '600 44px "Space Grotesk", sans-serif';
      ctx.fillText('NO MOVES · ' + score, S.w / 2, S.h / 2 - 14);
      ctx.fillStyle = 'rgba(154,176,196,0.8)';
      ctx.font = '13px "IBM Plex Mono", monospace';
      ctx.fillText('R, SPACE or tap for a new board', S.w / 2, S.h / 2 + 26);
    }
  }

  function loop(t) {
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function bind() {
    const sig = { signal: S.signal };
    window.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') move(0, -1);
      else if (k === 'ArrowDown' || k === 's' || k === 'S') move(0, 1);
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') move(-1, 0);
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') move(1, 0);
      else if (k === 'r' || k === 'R') reset();
      else if ((k === ' ' || k === 'Enter') && state === 'dead') reset();
    }, sig);
    window.addEventListener('pointerdown', (e) => {
      if (e.target !== S.canvas) return;
      pDown = [e.clientX, e.clientY];
    }, sig);
    window.addEventListener('pointerup', (e) => {
      if (!pDown) return;
      const dx = e.clientX - pDown[0], dy = e.clientY - pDown[1];
      pDown = null;
      if (Math.hypot(dx, dy) > 28) {
        if (Math.abs(dx) > Math.abs(dy)) move(Math.sign(dx), 0);
        else move(0, Math.sign(dy));
      } else if (state === 'dead') reset();
    }, sig);
  }

  return {
    id: '2048', name: '2048',
    hint: 'Arrows / swipe · merge to lime and beyond',
    howto: {
      goal: 'Slide the whole board — equal tiles merge and double. Climb the palette from slate through cyan to the lime 2048 tile, then keep going.',
      controls: [
        ['ARROWS / WASD', 'slide'],
        ['SWIPE', 'slide'],
        ['R', 'deal a fresh board'],
      ],
    },
    start(shell) {
      S = shell; reset(); bind();
      draw(performance.now());
      raf = requestAnimationFrame(loop);
    },
    stop() { cancelAnimationFrame(raf); },
    resize() {},
  };
})();
