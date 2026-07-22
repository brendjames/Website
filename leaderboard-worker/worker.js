// worker.js — global arcade leaderboard API (Cloudflare Worker + D1).
// Endpoints:
//   GET  /api/leaderboard?game=<id>   -> { game, scores: [{name, score}, ...] }  (top 10)
//   POST /api/leaderboard  {game,name,score} -> same shape (top 10 after insert)
//
// It is honour-system: scores are submitted by the client and cannot be fully
// verified server-side. We validate shape, clamp to sane caps, sanitise the
// name, block a few slurs, restrict writes to the site's own origins, and prune
// each game to its top 50 rows.

const GAME_CAPS = {
  snake: 100000,
  breakout: 500000,
  duck: 100000,
  asteroids: 1000000,
  '2048': 5000000,
};
const GAMES = new Set(Object.keys(GAME_CAPS));

// Origins allowed to POST (and receive CORS headers). Add/adjust for your setup.
const ALLOW_ORIGINS = new Set([
  'https://brendonjameskirk.com',
  'https://www.brendonjameskirk.com',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
]);

const NAME_RE = /^[A-Z0-9]{1,3}$/;
// keep tiny; extend as you like. Names are 1–3 chars so exact-match is enough.
const BLOCKED = new Set(['ASS', 'FUK', 'FUC', 'FAG', 'NIG', 'CUM', 'SEX', 'TIT', 'JEW', 'KKK']);

function corsHeaders(origin) {
  const h = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
  if (origin && ALLOW_ORIGINS.has(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}
function topQuery(env, game) {
  return env.DB.prepare(
    'SELECT name, score FROM scores WHERE game = ?1 ORDER BY score DESC, created_at ASC LIMIT 10'
  ).bind(game).all();
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (url.pathname !== '/api/leaderboard') {
      return json({ error: 'not_found' }, 404, origin);
    }

    // ---- read top 10 ----
    if (request.method === 'GET') {
      const game = (url.searchParams.get('game') || '').toLowerCase();
      if (!GAMES.has(game)) return json({ error: 'bad_game' }, 400, origin);
      try {
        const { results } = await topQuery(env, game);
        return json({ game, scores: results || [] }, 200, origin);
      } catch (e) {
        return json({ error: 'db_error' }, 500, origin);
      }
    }

    // ---- submit a score ----
    if (request.method === 'POST') {
      if (origin && !ALLOW_ORIGINS.has(origin)) return json({ error: 'forbidden' }, 403, origin);

      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'bad_json' }, 400, origin); }

      const game = String(body.game || '').toLowerCase();
      const name = String(body.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
      const score = Math.floor(Number(body.score));

      if (!GAMES.has(game)) return json({ error: 'bad_game' }, 400, origin);
      if (!NAME_RE.test(name) || BLOCKED.has(name)) return json({ error: 'bad_name' }, 400, origin);
      if (!Number.isFinite(score) || score <= 0 || score > GAME_CAPS[game]) {
        return json({ error: 'bad_score' }, 400, origin);
      }

      try {
        await env.DB.prepare(
          'INSERT INTO scores (game, name, score, created_at) VALUES (?1, ?2, ?3, ?4)'
        ).bind(game, name, score, Date.now()).run();

        // keep each game's table small: drop everything below its top 50
        await env.DB.prepare(
          'DELETE FROM scores WHERE game = ?1 AND id NOT IN (' +
          '  SELECT id FROM scores WHERE game = ?1 ORDER BY score DESC, created_at ASC LIMIT 50)'
        ).bind(game).run();

        const { results } = await topQuery(env, game);
        return json({ game, scores: results || [] }, 200, origin);
      } catch (e) {
        return json({ error: 'db_error' }, 500, origin);
      }
    }

    return json({ error: 'method_not_allowed' }, 405, origin);
  },
};
