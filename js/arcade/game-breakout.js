// game-breakout.js — glassmorphism breakout. Move the paddle with the
// pointer (or arrows), click or press space to launch. Bricks shade from
// cyan to cyber-lime; each level rebuilds faster.
window.GAMES = window.GAMES || {};
window.GAMES.breakout = (function () {
  const ROWCOL = ['#54c8ff', '#5ad2e8', '#6fdcc4', '#8fe59b', '#aeee74', '#c8f55a'];
  let S, raf = 0, last = 0;
  let state, pad, ball, bricks, parts, lives, level, score, speed, remaining;
  let targetX = 0, keys = {};

  function buildBricks() {
    bricks = [];
    const cols = Math.max(6, Math.min(12, Math.floor((S.w - 80) / 64)));
    const gap = 8, bh = 20, top = 92;
    const bw = (Math.min(S.w - 60, 900) - (cols - 1) * gap) / cols;
    const left = (S.w - (cols * bw + (cols - 1) * gap)) / 2;
    for (let r = 0; r < 6; r++) for (let c = 0; c < cols; c++)
      bricks.push({ x: left + c * (bw + gap), y: top + r * (bh + gap), w: bw, h: bh, row: r, alive: true });
    remaining = bricks.length;
  }
  function serve() {
    ball = { x: pad.x, y: S.h - 78, vx: 0, vy: 0, r: 6, stuck: true };
  }
  function launch() {
    if (!ball.stuck) return;
    ball.stuck = false;
    const a = (Math.random() * 0.5 - 0.25) - Math.PI / 2;
    ball.vx = Math.cos(a) * speed; ball.vy = Math.sin(a) * speed;
  }
  function reset() {
    lives = 3; level = 1; score = 0; speed = 340;
    S.setScore(0);
    pad = { x: S.w / 2, w: 110, h: 12 };
    targetX = S.w / 2;
    parts = [];
    buildBricks(); serve();
  }
  function begin() { reset(); state = 'play'; S.playing(true); }

  function spark(x, y, col) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * 6.283, sp = 60 + Math.random() * 160;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, col });
    }
  }

  function update(dt) {
    if (keys.left) targetX -= 520 * dt;
    if (keys.right) targetX += 520 * dt;
    targetX = Math.max(pad.w / 2 + 8, Math.min(S.w - pad.w / 2 - 8, targetX));
    pad.x += (targetX - pad.x) * Math.min(1, dt * 18);

    if (ball.stuck) { ball.x = pad.x; ball.y = S.h - 78; return; }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
    if (ball.x > S.w - ball.r) { ball.x = S.w - ball.r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < ball.r + 60) { ball.y = ball.r + 60; ball.vy = Math.abs(ball.vy); }

    // paddle
    const py = S.h - 64;
    if (ball.vy > 0 && ball.y + ball.r >= py && ball.y + ball.r <= py + 26 &&
        Math.abs(ball.x - pad.x) <= pad.w / 2 + ball.r) {
      const nx = Math.max(-1, Math.min(1, (ball.x - pad.x) / (pad.w / 2)));
      const ang = nx * 1.05;
      const sp = Math.min(660, Math.hypot(ball.vx, ball.vy) + 6);
      ball.vx = Math.sin(ang) * sp; ball.vy = -Math.cos(ang) * sp;
      ball.y = py - ball.r;
    }

    // bricks
    for (const b of bricks) {
      if (!b.alive) continue;
      const cx = Math.max(b.x, Math.min(ball.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(ball.y, b.y + b.h));
      const dx = ball.x - cx, dy = ball.y - cy;
      if (dx * dx + dy * dy <= ball.r * ball.r) {
        b.alive = false; remaining--;
        score += 10 + (5 - b.row) * 5; S.setScore(score);
        spark(ball.x, ball.y, ROWCOL[b.row]);
        const ox = (ball.r - Math.abs(dx)), oy2 = (ball.r - Math.abs(dy));
        if (Math.abs(dx) > Math.abs(dy)) ball.vx = Math.sign(dx || 1) * Math.abs(ball.vx);
        else ball.vy = Math.sign(dy || 1) * Math.abs(ball.vy);
        speed = Math.min(640, speed + 2);
        break;
      }
    }
    if (remaining === 0) {
      level++; speed = Math.min(640, speed * 1.06 + 10);
      pad.w = Math.max(72, pad.w - 8);
      buildBricks(); serve();
    }

    // floor
    if (ball.y - ball.r > S.h) {
      lives--;
      if (lives <= 0) { state = 'dead'; S.playing(false); }
      else serve();
    }

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt * 2.2;
      if (p.life <= 0) parts.splice(i, 1);
    }
  }

  function overlay(title, sub) {
    const ctx = S.ctx;
    ctx.fillStyle = 'rgba(5,8,13,0.62)';
    ctx.fillRect(0, 0, S.w, S.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e2ecf6';
    ctx.font = '600 44px "Space Grotesk", sans-serif';
    ctx.fillText(title, S.w / 2, S.h / 2 - 14);
    ctx.fillStyle = 'rgba(154,176,196,0.8)';
    ctx.font = '13px "IBM Plex Mono", monospace';
    ctx.fillText(sub, S.w / 2, S.h / 2 + 26);
  }

  function draw(t) {
    const ctx = S.ctx;
    ctx.fillStyle = '#05080d';
    ctx.fillRect(0, 0, S.w, S.h);

    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = 'rgba(13,19,29,0.55)';
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 5); ctx.fill();
      ctx.strokeStyle = ROWCOL[b.row];
      ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.roundRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 5); ctx.stroke();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = ROWCOL[b.row];
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 5); ctx.fill();
      ctx.globalAlpha = 1;
    }

    const py = S.h - 64;
    const grd = ctx.createLinearGradient(0, py, 0, py + pad.h);
    grd.addColorStop(0, '#6fd2ff'); grd.addColorStop(1, '#2d9fd8');
    ctx.fillStyle = grd;
    ctx.shadowColor = '#54c8ff'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.roundRect(pad.x - pad.w / 2, py, pad.w, pad.h, 7); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#f2f8ff';
    ctx.shadowColor = '#bfe9ff'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, 6.283); ctx.fill();
    ctx.shadowBlur = 0;

    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(154,176,196,0.7)';
    ctx.font = '12px "IBM Plex Mono", monospace';
    ctx.fillText('L' + level + '  ·  ' + '●'.repeat(Math.max(0, lives)), S.w / 2, 46);

    if (state === 'ready') overlay('BREAKOUT', 'move with pointer or arrows · click / SPACE to launch');
    if (state === 'dead') overlay('GAME OVER · ' + score, 'click or SPACE to go again');
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - last) / 1000); last = t;
    if (state === 'play') update(dt);
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function bind() {
    const sig = { signal: S.signal };
    window.addEventListener('pointermove', (e) => { targetX = e.clientX; }, sig);
    window.addEventListener('pointerdown', (e) => {
      if (e.target !== S.canvas) return;
      if (state !== 'play') begin();
      else launch();
    }, sig);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
      if (e.key === ' ' || e.key === 'Enter') { if (state !== 'play') begin(); else launch(); }
    }, sig);
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    }, sig);
  }

  return {
    id: 'breakout', name: 'Breakout',
    hint: 'Pointer or arrows · click to launch',
    start(shell) {
      S = shell; keys = {}; reset(); state = 'ready'; bind();
      last = performance.now(); draw(last);
      raf = requestAnimationFrame(loop);
    },
    stop() { cancelAnimationFrame(raf); },
    resize() { reset(); state = 'ready'; S.playing(false); },
  };
})();
