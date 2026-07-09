// game-asteroids.js — vector asteroids with a neon glow. Arrows/WASD to
// rotate and thrust, space to fire. Rocks split twice, ships respawn with a
// brief shield. Best played with a keyboard.
window.GAMES = window.GAMES || {};
window.GAMES.asteroids = (function () {
  const SIZES = [
    { r: 44, sp: 55, score: 20 },
    { r: 26, sp: 95, score: 50 },
    { r: 14, sp: 145, score: 100 },
  ];
  let S, raf = 0, last = 0;
  let state, ship, rocks, bullets, parts, keys, lives, level, score, fireCd;
  let touch = { active: false, x: 0, y: 0 }, touchMode = false;

  function makeRock(x, y, size) {
    const def = SIZES[size];
    const a = Math.random() * 6.283;
    const verts = [];
    const n = 10;
    for (let i = 0; i < n; i++) verts.push(0.72 + Math.random() * 0.5);
    return {
      x, y, size,
      vx: Math.cos(a) * (def.sp + level * 9) * (0.7 + Math.random() * 0.6),
      vy: Math.sin(a) * (def.sp + level * 9) * (0.7 + Math.random() * 0.6),
      rot: Math.random() * 6.283, spin: (Math.random() - 0.5) * 1.6,
      verts,
    };
  }
  function spawnWave(n) {
    for (let i = 0; i < n; i++) {
      let x, y;
      do {
        x = Math.random() * S.w; y = Math.random() * S.h;
      } while (Math.hypot(x - ship.x, y - ship.y) < 200);
      rocks.push(makeRock(x, y, 0));
    }
  }
  function resetShip() {
    ship = { x: S.w / 2, y: S.h / 2, a: -Math.PI / 2, vx: 0, vy: 0, inv: 2.4, thrust: false };
  }
  function reset() {
    score = 0; S.setScore(0);
    lives = 3; level = 1;
    rocks = []; bullets = []; parts = []; fireCd = 0;
    resetShip();
    spawnWave(4);
  }
  function begin() { reset(); state = 'play'; S.playing(true); }

  function boom(x, y, n, col) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = 40 + Math.random() * 220;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.9, col });
    }
  }
  function wrap(o, m) {
    if (o.x < -m) o.x += S.w + m * 2; if (o.x > S.w + m) o.x -= S.w + m * 2;
    if (o.y < -m) o.y += S.h + m * 2; if (o.y > S.h + m) o.y -= S.h + m * 2;
  }

  function update(dt) {
    // ship
    if (keys.left) ship.a -= 4.4 * dt;
    if (keys.right) ship.a += 4.4 * dt;
    let thrustOn = !!keys.up;
    // touch: the ship steers toward a held finger and thrusts when it's far
    if (touchMode && touch.active) {
      const ta = Math.atan2(touch.y - ship.y, touch.x - ship.x);
      const da = Math.atan2(Math.sin(ta - ship.a), Math.cos(ta - ship.a));
      const maxTurn = 5.5 * dt;
      ship.a += Math.max(-maxTurn, Math.min(maxTurn, da));
      if (Math.hypot(touch.x - ship.x, touch.y - ship.y) > 90) thrustOn = true;
    }
    ship.thrust = thrustOn;
    if (ship.thrust) {
      ship.vx += Math.cos(ship.a) * 460 * dt;
      ship.vy += Math.sin(ship.a) * 460 * dt;
    }
    const damp = Math.exp(-0.55 * dt);
    ship.vx *= damp; ship.vy *= damp;
    const sp = Math.hypot(ship.vx, ship.vy);
    if (sp > 500) { ship.vx *= 500 / sp; ship.vy *= 500 / sp; }
    ship.x += ship.vx * dt; ship.y += ship.vy * dt;
    wrap(ship, 20);
    if (ship.inv > 0) ship.inv -= dt;

    // fire
    fireCd -= dt;
    if ((keys.fire || (touchMode && touch.active)) && fireCd <= 0 && bullets.length < 6) {
      fireCd = 0.20;
      bullets.push({
        x: ship.x + Math.cos(ship.a) * 14, y: ship.y + Math.sin(ship.a) * 14,
        vx: Math.cos(ship.a) * 620 + ship.vx * 0.5,
        vy: Math.sin(ship.a) * 620 + ship.vy * 0.5,
        life: 0.95,
      });
    }
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      wrap(b, 4);
      if (b.life <= 0) bullets.splice(i, 1);
    }

    // rocks
    for (const r of rocks) {
      r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.spin * dt;
      wrap(r, SIZES[r.size].r);
    }

    // bullets vs rocks
    for (let ri = rocks.length - 1; ri >= 0; ri--) {
      const r = rocks[ri];
      const rr2 = SIZES[r.size].r;
      for (let bi = bullets.length - 1; bi >= 0; bi--) {
        const b = bullets[bi];
        if (Math.hypot(b.x - r.x, b.y - r.y) < rr2) {
          bullets.splice(bi, 1);
          rocks.splice(ri, 1);
          score += SIZES[r.size].score; S.setScore(score);
          boom(r.x, r.y, 10, '#9ad7ff');
          if (r.size < 2) {
            rocks.push(makeRock(r.x, r.y, r.size + 1));
            rocks.push(makeRock(r.x, r.y, r.size + 1));
          }
          break;
        }
      }
    }

    // rocks vs ship
    if (ship.inv <= 0) {
      for (const r of rocks) {
        if (Math.hypot(ship.x - r.x, ship.y - r.y) < SIZES[r.size].r + 10) {
          boom(ship.x, ship.y, 26, '#ffd9a0');
          lives--;
          if (lives <= 0) { state = 'dead'; S.playing(false); }
          else resetShip();
          break;
        }
      }
    }

    if (rocks.length === 0) {
      level++;
      spawnWave(3 + level);
      resetShip();
    }

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.4;
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

    // sparse static stars
    ctx.fillStyle = 'rgba(190,220,255,0.25)';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 727) % 1013) / 1013 * S.w;
      const sy = ((i * 379) % 809) / 809 * S.h;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    ctx.lineWidth = 1.6;
    ctx.shadowColor = '#54c8ff'; ctx.shadowBlur = 10;

    // rocks
    ctx.strokeStyle = 'rgba(190,225,255,0.85)';
    for (const r of rocks) {
      const rr2 = SIZES[r.size].r;
      ctx.beginPath();
      for (let i = 0; i <= r.verts.length; i++) {
        const k = i % r.verts.length;
        const a = r.rot + (k / r.verts.length) * 6.283;
        const rad = rr2 * r.verts[k];
        const px = r.x + Math.cos(a) * rad, py2 = r.y + Math.sin(a) * rad;
        i === 0 ? ctx.moveTo(px, py2) : ctx.lineTo(px, py2);
      }
      ctx.stroke();
    }

    // bullets
    ctx.fillStyle = '#c8f55a';
    ctx.shadowColor = '#c8f55a';
    for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 2.4, 0, 6.283); ctx.fill(); }
    ctx.shadowColor = '#54c8ff';

    // ship (blinks while shielded)
    const blink = ship.inv > 0 && ((t / 110) | 0) % 2 === 0;
    if (!blink && state !== 'dead') {
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.a);
      ctx.strokeStyle = '#e6f4ff';
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-11, -9); ctx.lineTo(-6, 0); ctx.lineTo(-11, 9);
      ctx.closePath(); ctx.stroke();
      if (ship.thrust) {
        ctx.strokeStyle = '#ffb45a';
        ctx.shadowColor = '#ffb45a';
        ctx.beginPath();
        ctx.moveTo(-7, -4); ctx.lineTo(-15 - Math.random() * 8, 0); ctx.lineTo(-7, 4);
        ctx.stroke();
        ctx.shadowColor = '#54c8ff';
      }
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    // debris
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    // lives + level
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(154,176,196,0.7)';
    ctx.font = '12px "IBM Plex Mono", monospace';
    ctx.fillText('L' + level + '  ·  ' + '▲'.repeat(Math.max(0, lives)), S.w / 2, 46);

    if (state === 'ready') overlay('ASTEROIDS', 'arrows / WASD to fly · SPACE to fire · SPACE to start');
    if (state === 'dead') overlay('SHIP LOST · ' + score, 'SPACE or tap to go again');
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - last) / 1000); last = t;
    if (state === 'play') update(dt);
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function bind() {
    const sig = { signal: S.signal };
    window.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'a') keys.left = true;
      if (k === 'ArrowRight' || k === 'd') keys.right = true;
      if (k === 'ArrowUp' || k === 'w') keys.up = true;
      if (k === ' ') { if (state !== 'play') begin(); else keys.fire = true; }
      if (k === 'Enter' && state !== 'play') begin();
    }, sig);
    window.addEventListener('keyup', (e) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'a') keys.left = false;
      if (k === 'ArrowRight' || k === 'd') keys.right = false;
      if (k === 'ArrowUp' || k === 'w') keys.up = false;
      if (k === ' ') keys.fire = false;
    }, sig);
    window.addEventListener('pointerdown', (e) => {
      if (e.target !== S.canvas) return;
      if (e.pointerType === 'touch') touchMode = true;
      touch.active = true; touch.x = e.clientX; touch.y = e.clientY;
      if (state !== 'play') begin();
    }, sig);
    window.addEventListener('pointermove', (e) => {
      if (touch.active) { touch.x = e.clientX; touch.y = e.clientY; }
    }, sig);
    window.addEventListener('pointerup', () => { touch.active = false; }, sig);
    window.addEventListener('pointercancel', () => { touch.active = false; }, sig);
  }

  return {
    id: 'asteroids', name: 'Asteroids',
    hint: 'Arrows / WASD + SPACE · touch: hold to fly & auto-fire',
    howto: {
      goal: 'Blast the rocks — big ones split into smaller ones. Clear the field to level up. You have 3 ships, each respawning with a brief shield.',
      controls: [
        ['← → / A D', 'rotate'],
        ['↑ / W', 'thrust'],
        ['SPACE', 'fire'],
        ['HOLD (touch)', 'fly toward your finger · auto-fire'],
      ],
    },
    start(shell) {
      S = shell; keys = {}; touch.active = false; reset(); state = 'ready'; bind();
      last = performance.now(); draw(last);
      raf = requestAnimationFrame(loop);
    },
    stop() { cancelAnimationFrame(raf); },
    resize() { reset(); state = 'ready'; S.playing(false); },
  };
})();
