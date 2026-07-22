# Arcade leaderboard — Cloudflare Worker

A tiny API (Cloudflare Worker + D1 SQLite) that stores a global top-10 per game
for the arcade. It lives on **your own** Cloudflare account and domain, so the
site makes no third-party request to anyone else.

## What you need
- A free Cloudflare account.
- Node installed, then Wrangler: `npm install -g wrangler`

## Deploy (one time)

From this `leaderboard-worker/` folder:

```bash
wrangler login

# 1) create the database, then copy the printed database_id into wrangler.toml
wrangler d1 create bjk-arcade

# 2) create the table (run both: local is for `wrangler dev`, remote is production)
wrangler d1 execute bjk-arcade --file schema.sql --local
wrangler d1 execute bjk-arcade --file schema.sql --remote

# 3) ship it
wrangler deploy
```

`wrangler deploy` prints a URL like
`https://bjk-arcade-leaderboard.<you>.workers.dev`.

### (Optional) use your own domain
If `brendonjameskirk.com` is on this Cloudflare account, uncomment the `[[routes]]`
block in `wrangler.toml` (it maps `api.brendonjameskirk.com/*`), then
`wrangler deploy` again. Cleanest for privacy — the API is first-party.

## Wire the site to it
1. Put the deployed base URL (no trailing slash) into
   `js/arcade/leaderboard.js` → the `API` constant.
   e.g. `const API = 'https://api.brendonjameskirk.com';`
2. If you used the workers.dev URL (not your own domain), also add that origin is
   **not** needed — the site only *calls* the API; what matters is that your
   **site's** origin is listed in `worker.js` → `ALLOW_ORIGINS` (it already lists
   `brendonjameskirk.com`, `www.`, and localhost:5501 for testing).
3. Redeploy the site.

## Test locally
```bash
wrangler dev            # serves the API at http://localhost:8787
```
Then temporarily set `API = 'http://localhost:8787'` in `leaderboard.js`, add
that origin to `ALLOW_ORIGINS`, and play the arcade on `http://localhost:5501`.

## Notes / limits
- **Honour system.** Scores are client-submitted and can be faked; there is no
  server-side replay validation. Fine for a portfolio arcade. Per-game score
  caps in `worker.js` reject absurd values.
- **Names** are 1–3 characters `[A-Z0-9]`; a small slur blocklist is enforced.
- Each game's table is pruned to its **top 50** on every insert.
- Free-tier D1 and Workers limits are far beyond what this needs.
- To wipe a game's board:
  `wrangler d1 execute bjk-arcade --remote --command "DELETE FROM scores WHERE game='snake'"`
- Abuse control: if needed, add a Rate Limiting rule in the Cloudflare dashboard
  for the Worker route.
