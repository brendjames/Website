# memory.md — brendonjameskirk.com build plan

Live planning document. Checked off as completed.

## Design system
- Dark futuristic "cool chrome": slate `#05080d` base, cyan accent `#54c8ff`, cyber-lime highlight `#c8f55a`
- Fonts: Space Grotesk (headings) + JetBrains Mono (body/meta) via Google Fonts
- Glassmorphism: `backdrop-filter: blur(16px)` cards + nav
- Homepage background: interactive WebGL2 Voronoi "Cells" shader (mouse glide + click pulse),
  chosen by Brendon from the shader wallpaper exploration. Graceful fallback to gradient.
- Bento grid layouts, glow-on-hover cards (`--mouse-x/--mouse-y`), Intersection Observer reveals

## File structure
```
index.html              Landing: hero (bj.webp), typewriter, motto, bento grid, Cells shader bg
blog.html               Blog index: 8 glow cards
blog/
  perspective-ai.html
  perspective-america.html
  perspective-durban2vienna.html
  travel-capetown.html
  travel-durban.html
  travel-kruger.html
  travel-wildcoast.html
  travel-wilderness.html
journey.html            CV timeline (Intersection Observer slide-ins)
projects.html           2 project cards (Kruger published / Agents Collection in progress)
contact.html            Form, mailto fallback, honeypot, inline success
css/site.css            Shared styles
js/site.js              Nav toggle, glow tracking, reveals, typewriter
js/bg-cells.js          Standalone WebGL2 Cells background (homepage)
assets/bj.webp          Hero
assets/img/posts/*.webp 8 post images
README.md               Generated last
```

## Tasks
- [x] memory.md
- [x] Copy assets (bj.webp + 8 post images)
- [x] css/site.css
- [x] js/site.js
- [x] js/bg-cells.js (Cells shader, standalone)
- [x] index.html
- [x] blog.html
- [x] 8 blog post pages
- [x] journey.html
- [x] projects.html
- [x] contact.html
- [x] README.md
