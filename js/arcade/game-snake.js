// game-snake.js — neon snake. Arrows/WASD or swipe to steer, eat the
// cyber-lime, don't eat yourself. Speeds up as you grow.
window.GAMES = window.GAMES || {};
window.GAMES.snake = (function () {
  let S, raf = 0, last = 0, acc = 0;
  let cell, cols, rows, ox, oy;
  let state, snake, dir, queue, food, score;
  let pDown = null;

  function layout() {
    cell = Math.max(18, Math.min(28, Math.floor(Math.min(S.w, S.h) / 24)));
    cols = Math.max(10, Math.floor((S.w - 40) / cell));
    rows = Math.max(10, Math.floor((S.h - 40) / cell));
    ox = Math.round((S.w - cols * cell) / 2);
    oy = Math.round((S.h - rows * cell) / 2);
  }
  function reset() {
    snake = [];
    const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
    for (let i = 0; i < 4; i++) snake.push({ x: cx - i, y: cy });
    dir = { x: 1, y: 0 }; queue = []; acc = 0;
    score = 0; S.setScore(0);
    placeFood();
  }
  function placeFood() {
    do {
      food = { x: (Math.random() * cols) | 0, y: (Math.random() * rows) | 0 };
    } while (snake.some(s => s.x === food.x && s.y === food.y));
  }
  function push(nx, ny) {
    const lastD = queue.length ? queue[queue.length - 1] : dir;
    if ((nx === -lastD.x && ny === -lastD.y) || (nx === lastD.x && ny === lastD.y)) return;
    if (queue.length < 2) queue.push({ x: nx, y: ny });
  }
  function begin() { reset(); state = 'play'; S.playing(true); }
  function tickMs() { return Math.max(68, 132 - snake.length * 1.6); }

  function step() {
    if (queue.length) dir = queue.shift();
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows ||
        snake.some(s => s.x === head.x && s.y === head.y)) {
      state = 'dead';
      S.playing(false);
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10; S.setScore(score);
      placeFood();
    } else snake.pop();
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
    ctx.fillStyle = 'rgba(150,180,210,0.035)';
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++)
      if ((x + y) % 2 === 0) ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
    ctx.strokeStyle = 'rgba(150,180,210,0.18)';
    ctx.strokeRect(ox - 1.5, oy - 1.5, cols * cell + 3, rows * cell + 3);

    const pulse = 0.7 + 0.3 * Math.sin(t / 220);
    ctx.shadowColor = '#c8f55a'; ctx.shadowBlur = 18 * pulse;
    ctx.fillStyle = '#c8f55a';
    ctx.beginPath();
    ctx.roundRect(ox + food.x * cell + 4, oy + food.y * cell + 4, cell - 8, cell - 8, 5);
    ctx.fill();
    ctx.shadowBlur = 0;

    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      const k = 1 - i / Math.max(12, snake.length);
      if (i === 0) { ctx.fillStyle = '#bfe9ff'; ctx.shadowColor = '#54c8ff'; ctx.shadowBlur = 14; }
      else ctx.fillStyle = 'rgba(84,200,255,' + (0.3 + 0.55 * k).toFixed(3) + ')';
      ctx.beginPath();
      ctx.roundRect(ox + s.x * cell + 2, oy + s.y * cell + 2, cell - 4, cell - 4, 6);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (state === 'ready') overlay('SNAKE', 'SPACE or tap to start · arrows / WASD / swipe to steer');
    if (state === 'dead') overlay('GAME OVER · ' + score, 'SPACE or tap to go again');
  }

  function loop(t) {
    const dt = Math.min(60, t - last); last = t;
    if (state === 'play') {
      acc += dt;
      while (acc > tickMs() && state === 'play') { acc -= tickMs(); step(); }
    }
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function bind() {
    const sig = { signal: S.signal };
    window.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') push(0, -1);
      else if (k === 'ArrowDown' || k === 's' || k === 'S') push(0, 1);
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') push(-1, 0);
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') push(1, 0);
      else if (k === ' ' || k === 'Enter') { if (state !== 'play') begin(); }
    }, sig);
    let swiped = false;
    window.addEventListener('pointerdown', (e) => {
      if (e.target !== S.canvas) return;
      pDown = [e.clientX, e.clientY];
      swiped = false;
    }, sig);
    // steer continuously while dragging — no need to lift the finger
    window.addEventListener('pointermove', (e) => {
      if (!pDown) return;
      const dx = e.clientX - pDown[0], dy = e.clientY - pDown[1];
      if (Math.hypot(dx, dy) > 24) {
        if (Math.abs(dx) > Math.abs(dy)) push(Math.sign(dx), 0);
        else push(0, Math.sign(dy));
        pDown = [e.clientX, e.clientY];
        swiped = true;
      }
    }, sig);
    window.addEventListener('pointerup', () => {
      const wasDown = !!pDown;
      pDown = null;
      if (wasDown && !swiped && state !== 'play') begin();
    }, sig);
  }

  return {
    id: 'snake', name: 'Snake',
    hint: 'Arrows / WASD / swipe · eat the lime',
    howto: {
      goal: 'Eat the lime squares to grow. The snake speeds up as it gets longer — don’t hit the walls, and don’t bite yourself.',
      controls: [
        ['ARROWS / WASD', 'steer'],
        ['SWIPE', 'steer on touch'],
        ['SPACE / TAP', 'start · play again'],
      ],
    },
    start(shell) {
      S = shell; layout(); reset(); state = 'ready'; bind();
      last = performance.now(); draw(last);
      raf = requestAnimationFrame(loop);
    },
    stop() { cancelAnimationFrame(raf); },
    resize() { layout(); reset(); state = 'ready'; S.playing(false); },
  };
})();
