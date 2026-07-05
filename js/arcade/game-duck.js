// game-duck.js — Duck Hop. The duck from the homepage hero, now with a job:
// tap or press space to flap between glass towers over a Durban dusk sea.
// Yes, that's the duck.
window.GAMES = window.GAMES || {};
window.GAMES.duck = (function () {
  const G = 1150, FLAP = -345;
  let S, raf = 0, last = 0;
  let state, duck, towers, score, spawnT, flapT, splash;

  function horizon() { return S.h * 0.84; }

  function reset() {
    duck = { x: S.w * 0.32, y: S.h * 0.44, vy: 0, r: 15 };
    towers = []; splash = [];
    score = 0; S.setScore(0);
    spawnT = 0; flapT = 0;
  }
  function begin() { reset(); state = 'play'; flap(); }
  function flap() {
    duck.vy = FLAP; flapT = performance.now();
  }

  function update(dt) {
    const sp = 185 + Math.min(90, score * 2);
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = 265 / sp + 1.05;
      const gap = Math.max(142, 178 - score * 1.1);
      const m = 60;
      const gy = m + Math.random() * (horizon() - gap - m * 2);
      towers.push({ x: S.w + 40, w: 68, top: gy, bot: gy + gap, counted: false });
    }
    for (let i = towers.length - 1; i >= 0; i--) {
      const tw = towers[i];
      tw.x -= sp * dt;
      if (!tw.counted && tw.x + tw.w < duck.x - duck.r) {
        tw.counted = true; score++; S.setScore(score);
      }
      if (tw.x + tw.w < -60) towers.splice(i, 1);
    }

    duck.vy += G * dt;
    duck.y += duck.vy * dt;
    if (duck.y < duck.r + 54) { duck.y = duck.r + 54; duck.vy = Math.max(0, duck.vy); }

    // collisions
    for (const tw of towers) {
      if (duck.x + duck.r > tw.x && duck.x - duck.r < tw.x + tw.w) {
        if (duck.y - duck.r < tw.top || duck.y + duck.r > tw.bot) { die(); return; }
      }
    }
    if (duck.y + duck.r >= horizon()) { die(); return; }
  }
  function die() {
    state = 'dead';
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * 3.14159;
      splash.push({ x: duck.x, y: Math.min(duck.y, horizon() - 4), vx: Math.cos(a) * (40 + Math.random() * 120) * (Math.random() < 0.5 ? -1 : 1), vy: -60 - Math.random() * 180, life: 1 });
    }
  }

  function drawDuck(ctx, x, y, rot, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    // body
    ctx.fillStyle = '#f0b23c';
    ctx.beginPath(); ctx.ellipse(0, 0, 17, 13, 0, 0, 6.283); ctx.fill();
    // belly
    ctx.fillStyle = '#f7d489';
    ctx.beginPath(); ctx.ellipse(-2, 5, 11, 7, 0, 0, 6.283); ctx.fill();
    // wing (flaps just after a hop)
    const k = Math.max(0, 1 - (t - flapT) / 240);
    ctx.fillStyle = '#c98a26';
    ctx.save();
    ctx.translate(-3, -2);
    ctx.rotate(-0.5 * k + 0.15);
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, 6.283); ctx.fill();
    ctx.restore();
    // head
    ctx.fillStyle = '#f0b23c';
    ctx.beginPath(); ctx.arc(11, -9, 8.5, 0, 6.283); ctx.fill();
    // beak
    ctx.fillStyle = '#f07830';
    ctx.beginPath();
    ctx.moveTo(18, -10); ctx.lineTo(27, -7.5); ctx.lineTo(18, -5);
    ctx.closePath(); ctx.fill();
    // eye
    ctx.fillStyle = '#131313';
    ctx.beginPath(); ctx.arc(13.5, -10.5, 1.9, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(14.2, -11.2, 0.7, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  function overlay(title, sub) {
    const ctx = S.ctx;
    ctx.fillStyle = 'rgba(5,8,13,0.45)';
    ctx.fillRect(0, 0, S.w, S.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4ede2';
    ctx.font = '600 44px "Space Grotesk", sans-serif';
    ctx.fillText(title, S.w / 2, S.h / 2 - 54);
    ctx.fillStyle = 'rgba(244,237,226,0.75)';
    ctx.font = '13px "IBM Plex Mono", monospace';
    ctx.fillText(sub, S.w / 2, S.h / 2 - 16);
  }

  function draw(t) {
    const ctx = S.ctx, hz = horizon();
    // dusk sky
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#1c0f2e');
    sky.addColorStop(0.62, '#4a1a30');
    sky.addColorStop(1, '#b3541e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, S.w, hz);
    // sun
    ctx.fillStyle = 'rgba(255,180,90,0.9)';
    ctx.shadowColor = 'rgba(255,160,70,0.9)'; ctx.shadowBlur = 50;
    ctx.beginPath(); ctx.arc(S.w * 0.74, hz - 44, 42, 0, 6.283); ctx.fill();
    ctx.shadowBlur = 0;
    // sea
    const sea = ctx.createLinearGradient(0, hz, 0, S.h);
    sea.addColorStop(0, '#2a1420'); sea.addColorStop(1, '#0a0710');
    ctx.fillStyle = sea;
    ctx.fillRect(0, hz, S.w, S.h - hz);
    ctx.strokeStyle = 'rgba(255,170,90,0.35)';
    ctx.beginPath(); ctx.moveTo(0, hz); ctx.lineTo(S.w, hz); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const y = hz + 12 + i * 14;
      const off = Math.sin(t / 900 + i) * 30;
      ctx.strokeStyle = 'rgba(255,170,90,' + (0.12 - i * 0.02) + ')';
      ctx.beginPath(); ctx.moveTo(S.w * 0.5 + off - 90 + i * 12, y); ctx.lineTo(S.w * 0.5 + off + 90 - i * 12, y); ctx.stroke();
    }

    // glass towers
    for (const tw of towers) {
      for (const seg of [[0, tw.top], [tw.bot, hz]]) {
        const y0 = seg[0], y1 = seg[1];
        ctx.fillStyle = 'rgba(13,19,29,0.66)';
        ctx.fillRect(tw.x, y0, tw.w, y1 - y0);
        ctx.strokeStyle = 'rgba(150,190,230,0.45)';
        ctx.strokeRect(tw.x + 0.5, y0 + 0.5, tw.w - 1, y1 - y0 - 1);
        ctx.fillStyle = 'rgba(84,200,255,0.10)';
        ctx.fillRect(tw.x + 4, y0 + 4, 10, Math.max(0, y1 - y0 - 8));
      }
      // gap lips
      ctx.fillStyle = 'rgba(84,200,255,0.55)';
      ctx.fillRect(tw.x - 3, tw.top - 4, tw.w + 6, 4);
      ctx.fillRect(tw.x - 3, tw.bot, tw.w + 6, 4);
    }

    // duck
    let y = duck.y, rot = Math.max(-0.45, Math.min(0.9, duck.vy / 640));
    if (state === 'ready') { y = S.h * 0.62 + Math.sin(t / 420) * 10; rot = Math.sin(t / 420 + 1) * 0.08; }
    drawDuck(ctx, duck.x, y, rot, t);

    // splash
    for (let i = splash.length - 1; i >= 0; i--) {
      const p = splash[i];
      p.x += p.vx * 0.016; p.y += p.vy * 0.016; p.vy += 18; p.life -= 0.02;
      if (p.life <= 0) { splash.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = '#ffd9a0';
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    if (state === 'ready') overlay('DUCK HOP', "SPACE or tap to flap · yes, that's the duck");
    if (state === 'dead') overlay('SPLASH · ' + score, 'SPACE or tap to try again');
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - last) / 1000); last = t;
    if (state === 'play') update(dt);
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function act() {
    if (state === 'play') flap();
    else begin();
  }

  function bind() {
    const sig = { signal: S.signal };
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') { if (!e.repeat) act(); }
    }, sig);
    window.addEventListener('pointerdown', (e) => {
      if (e.target !== S.canvas) return;
      act();
    }, sig);
  }

  return {
    id: 'duck', name: 'Duck Hop',
    hint: 'SPACE / tap to flap · mind the glass',
    start(shell) {
      S = shell; reset(); state = 'ready'; bind();
      last = performance.now(); draw(last);
      raf = requestAnimationFrame(loop);
    },
    stop() { cancelAnimationFrame(raf); },
    resize() { reset(); state = 'ready'; },
  };
})();
