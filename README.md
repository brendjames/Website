# brendonjameskirk.com

Personal brand website for **Brendon James Kirk** — technology enthusiast in Vienna, Austria.
A visually stimulating, futuristic experience built with **only platform-native technologies** — no frameworks.

## How to Run

Open `index.html` directly in any modern browser, or serve the folder with VS Code **Live Server** (right-click `index.html` → "Open with Live Server").

## Project Structure

```
index.html              Landing — hero, typewriter, bento grid, interactive Cells shader background
blog.html               Blog index — 8 article cards with glow-on-hover
blog/                   8 individual post pages
journey.html            CV — animated vertical timeline (Intersection Observer)
projects.html           Project showcase cards
contact.html            Contact form (mailto + honeypot + inline success)
lab.html                Shader Lab — 14 fullscreen interactive WebGL2 wallpapers
arcade.html             The Arcade — 5 hand-built HTML5 canvas games
css/site.css            Shared design system styles
js/site.js              Nav toggle, glow tracking, reveals, typewriter, form
js/bg-cells.js          Standalone WebGL2 Voronoi "Cells" background (every page)
js/lab/                 Shader Lab engine (gl-engine.js) + the 14 wallpaper modules
js/arcade/              The Arcade's five game modules (shared shell in arcade.html)
assets/                 Hero image + 8 post images
sitemap.xml, robots.txt Search-engine hints
memory.md               Build planning document
```

## Tech Stack

- **HTML5** — semantic elements throughout (`article`, `header`, `time`, `nav`, `main`, `footer`)
- **CSS3** — variables, Grid, Flexbox, keyframes; no Bootstrap, no Tailwind
- **Vanilla JavaScript ES6+** — no jQuery, no React
- **WebGL2** — interactive homepage shader, graceful gradient fallback
- **Google Fonts** — Space Grotesk (headings) + JetBrains Mono (body/meta)

## Features

- **Hero** — typewriter name animation, masked hero image, fade-in motto
- **Interactive shader wallpaper** — Voronoi cells light up around the cursor, brighten with cursor speed, and pulse on click (chosen from a five-shader exploration)
- **Blog grid** — cursor-tracked radial glow borders via `--mouse-x` / `--mouse-y`
- **Timeline** — Intersection Observer slide-ins, Durban → Cape Town → Vienna
- **Projects** — glassmorphism bento cards with status badges
- **Contact** — HTML5 validation, hidden honeypot, inline success message
- **Shader Lab** — a fourteen-shader fullscreen playground at `lab.html`: ripples, plasma, magnet, cells, aurora, mercury, an LED wall, ember fire, a synthwave sunset, digital rain, a reaction-diffusion culture, a pulsing circuit board, a kaleidoscope, and a Milkdrop-style music visualiser that morphs through random presets as it feeds on the microphone — all cursor-reactive WebGL2. Fullscreen + wallpaper download, auto-cycle screensaver mode with an idle-drifting cursor, microphone reactivity, a hue dial, and `#deep-links` per shader
- **The Arcade** — five hand-built HTML5 canvas games at `arcade.html`: Snake, Breakout, Duck Hop (starring the hero duck), Asteroids and 2048 — keyboard, mouse and touch controls, per-game high scores in localStorage, `#deep-links`, fullscreen
- **Accessibility** — ARIA roles, alt text, keyboard navigation, visible focus rings, `prefers-reduced-motion` respected
- **SEO & sharing** — canonical URLs, Open Graph + Twitter cards on every page, `sitemap.xml` + `robots.txt`

## Design Rationale

Dark "cool chrome" palette (slate `#05080d`, cyan `#54c8ff`, cyber-lime highlight) keeps body text above a 4.5:1 contrast ratio while letting the shader background glow. Glassmorphism (`backdrop-filter: blur(16px)`) layers the UI over the living wallpaper. Space Grotesk gives headings a geometric, futuristic voice; JetBrains Mono keeps body and metadata technical and honest.

## Contact

`brendonkirk86@gmail.com` · [github.com/brendjames](https://github.com/brendjames)
