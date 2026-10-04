# bkirk.eu

Personal website of **Brendon James Kirk**, IT support professional in Vienna, Austria.

The homepage is a one-page CV that prints cleanly to PDF. Around it sit a blog, a WebGL2 shader lab and a hand-built canvas arcade. Everything is plain HTML, CSS and JavaScript: no frameworks, no build step, and no requests to third-party servers.

## Run locally

Serve the folder with any static server, then open http://localhost:5501:

```bash
npx http-server -p 5501 -c-1 .
```

## Structure

```
index.html            Home: one-page CV (about, experience, skills, projects, writing, contact)
blog.html, blog/      Blog index + 8 posts
projects.html         Project showcase
contact.html          Email / GitHub / location (no form; the site has no backend)
legal.html            Imprint (§ 25 MedienG) and privacy policy (GDPR)
lab.html, js/lab/     Shader Lab: 15 interactive WebGL2 wallpapers
arcade.html, js/arcade/  The Arcade: 5 canvas games with local high scores
404.html              Not-found page (root-absolute paths so it works at any depth)
journey.html          Redirect to /#experience (old URL)
css/site.css          Shared design system: light editorial + dark theme, print-as-CV
css/fonts.css         Self-hosted fonts (assets/fonts)
js/site.js            Theme door/toggle, reveals, counters, print button
api/                  Arcade leaderboard (PHP + MySQL), not used on GitHub Pages
ops/                  Server config for the old domain's redirect
```

## Hosting: GitHub Pages

- **Pages source:** Settings → Pages → *Deploy from a branch* → `main`, `/ (root)`.
- **Custom domain:** the `CNAME` file holds `bkirk.eu`. Tick *Enforce HTTPS* once the certificate is issued.
- **What gets published:** `_config.yml` keeps `README.md`, `memory.md`, `api/` and `ops/` off the live site.
- **Security headers:** GitHub Pages can't send custom headers, so every page carries the same
  `Content-Security-Policy` `<meta>` tag. Copy it into any new page.
- **DNS at the registrar** (apex `bkirk.eu`):
  - `A` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
  - `AAAA` → `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
  - `CNAME www` → `<github-username>.github.io`
  - Verify the domain under GitHub *Settings → Pages* first to prevent takeovers, and don't add wildcard (`*`) records.

## Old domain

`brendonjameskirk.com` permanently redirects to the same path on `bkirk.eu`. The rule lives in
`ops/old-domain.htaccess`; upload it to the old cPanel host as `.htaccess`.

## Arcade leaderboard

`api/` contains a global top-10 leaderboard (PHP + MySQL, see `api/README.md`). GitHub Pages
can't run PHP, so on bkirk.eu the arcade detects the missing endpoint and keeps on-device high
scores only.
