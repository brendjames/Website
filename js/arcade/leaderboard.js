// leaderboard.js — global top-10 client for the arcade.
// Talks to the Cloudflare Worker API (see /leaderboard-worker). Until the API
// base below is filled in, the board stays inert and the arcade behaves exactly
// as before (on-device best scores only) — nothing breaks.
window.Leaderboard = (function () {
  'use strict';

  // ============================================================
  //  CONFIG — after deploying the Worker, put its base URL here
  //  (no trailing slash), e.g. 'https://api.brendonjameskirk.com'
  //  or the workers.dev URL wrangler prints on deploy.
  const API = '';
  // ============================================================

  const NAMES = {
    snake: 'Snake', breakout: 'Breakout', duck: 'Duck Hop',
    asteroids: 'Asteroids', '2048': '2048',
  };
  const enabled = () => !!API;

  let curGame = 'snake';
  const cache = {};          // game -> [{name, score}]
  let lastInitials = '';
  try { lastInitials = (localStorage.getItem('arcade.initials') || '').toUpperCase(); } catch (e) {}

  // ---- DOM ----
  const el = (id) => document.getElementById(id);
  const lb = el('lb'), lbTitle = el('lbTitle'), lbList = el('lbList'),
        lbState = el('lbState'), lbEntry = el('lbEntry'), lbInitials = el('lbInitials'),
        lbSubmit = el('lbSubmit'), lbErr = el('lbErr'), lbClose = el('lbClose'),
        lbCongrats = el('lbCongrats');
  let lastFocus = null;

  // ---- API ----
  async function fetchTop(game) {
    const r = await fetch(API + '/api/leaderboard?game=' + encodeURIComponent(game), {
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    cache[game] = Array.isArray(data.scores) ? data.scores : [];
    return cache[game];
  }
  async function submitScore(game, name, score) {
    const r = await fetch(API + '/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ game: game, name: name, score: score }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || ('http ' + r.status));
    cache[game] = Array.isArray(data.scores) ? data.scores : [];
    return cache[game];
  }

  function cleanInitials(v) {
    return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  }
  function qualifies(game, score) {
    if (!enabled() || !(score > 0)) return false;
    const list = cache[game];
    if (!list) return true;                 // unknown board yet — let the server decide
    if (list.length < 10) return true;
    return score > list[list.length - 1].score;
  }

  // ---- rendering ----
  function renderList(game, highlightIdx) {
    const list = cache[game] || [];
    lbList.innerHTML = '';
    if (!list.length) {
      const li = document.createElement('li');
      li.className = 'lb-empty';
      li.textContent = 'No scores yet — be the first to make the board.';
      lbList.appendChild(li);
      return;
    }
    list.slice(0, 10).forEach((row, i) => {
      const li = document.createElement('li');
      if (i === highlightIdx) li.className = 'you';
      const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = (i + 1);
      const who = document.createElement('span'); who.className = 'who'; who.textContent = row.name;
      const pts = document.createElement('span'); pts.className = 'pts'; pts.textContent = Number(row.score).toLocaleString('en-US');
      li.append(rank, who, pts);
      lbList.appendChild(li);
    });
  }

  // ---- overlay open/close ----
  function open() {
    lastFocus = document.activeElement;
    lb.classList.add('show');
    lb.setAttribute('aria-hidden', 'false');
  }
  function close() {
    lb.classList.remove('show');
    lb.setAttribute('aria-hidden', 'true');
    lbEntry.hidden = true;
    lbErr.textContent = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // ---- public: view the board for a game ----
  async function show(game) {
    curGame = game || curGame;
    lbEntry.hidden = true;
    lbErr.textContent = '';
    lbTitle.textContent = (NAMES[curGame] || curGame) + ' · Top 10';
    open();
    if (!enabled()) {
      lbList.innerHTML = '';
      lbState.className = 'lb-state';
      lbState.textContent = 'The global leaderboard isn’t switched on yet. Your best scores are saved on this device.';
      return;
    }
    lbState.className = 'lb-state';
    lbState.textContent = 'Loading…';
    try {
      await fetchTop(curGame);
      renderList(curGame);
      lbState.textContent = '';
    } catch (e) {
      lbState.className = 'lb-state err';
      lbState.textContent = 'Couldn’t reach the leaderboard. Check your connection and try again.';
    }
  }

  // ---- public: called by the shell when a game selection loads (prefetch) ----
  function setGame(game) {
    curGame = game || curGame;
    if (enabled()) fetchTop(curGame).catch(() => {});
  }

  // ---- public: called by the shell at game over ----
  async function gameOver(game, score) {
    curGame = game || curGame;
    if (!enabled() || !(score > 0)) return;
    // make sure we have a current board to judge against
    if (!cache[curGame]) { try { await fetchTop(curGame); } catch (e) {} }
    if (!qualifies(curGame, score)) return;

    pendingScore = score;
    lbTitle.textContent = (NAMES[curGame] || curGame) + ' · Top 10';
    renderList(curGame);
    lbState.className = 'lb-state';
    lbState.textContent = '';
    lbCongrats.innerHTML = 'You scored <b>' + Number(score).toLocaleString('en-US') + '</b> — that makes the board! Enter your initials:';
    lbEntry.hidden = false;
    lbErr.textContent = '';
    lbInitials.value = lastInitials;
    open();
    setTimeout(() => { lbInitials.focus(); lbInitials.select(); }, 60);
  }

  let pendingScore = 0;

  async function doSubmit(e) {
    if (e) e.preventDefault();
    const name = cleanInitials(lbInitials.value);
    if (name.length < 1) { lbErr.textContent = 'Enter 1–3 letters or numbers.'; return; }
    lbSubmit.disabled = true;
    lbErr.textContent = '';
    try {
      lastInitials = name;
      try { localStorage.setItem('arcade.initials', name); } catch (er) {}
      await submitScore(curGame, name, pendingScore);
      lbEntry.hidden = true;
      // highlight the freshly-added row (first matching name+score from the top)
      const idx = (cache[curGame] || []).findIndex((r) => r.name === name && r.score === pendingScore);
      renderList(curGame, idx);
      lbState.className = 'lb-state';
      lbState.textContent = 'Saved. Nice one.';
    } catch (err) {
      lbErr.textContent = 'Couldn’t save that score. Try again in a moment.';
    } finally {
      lbSubmit.disabled = false;
    }
  }

  // ---- wiring ----
  if (lb) {
    lbClose.addEventListener('click', close);
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    lbEntry.addEventListener('submit', doSubmit);
    // keep typing isolated from the game/shell key handlers behind the overlay
    lbInitials.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') doSubmit(e);
      else if (e.key === 'Escape') close();
    });
    lbInitials.addEventListener('input', () => { lbInitials.value = cleanInitials(lbInitials.value); });
    window.addEventListener('keydown', (e) => {
      if (lb.classList.contains('show') && e.key === 'Escape') close();
    });
  }

  return { enabled, setGame, gameOver, show };
})();
