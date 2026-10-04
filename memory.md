# memory.md — bkirk.eu build plan

Live planning document. Checked off as completed.

## Design system (v2 — light editorial, July 2026)
- Warm paper `#FAF9F6` base, warm ink `#1C1917`, terracotta accent `#9A3412`, olive highlight `#3F6212`
- Fonts: Fraunces (display serif) + Inter (body) + JetBrains Mono (labels) via Google Fonts
- No background effects, no glassmorphism, no glow — flat white cards, 1px warm borders
- Homepage = complete one-page profile (about → experience → skills/certs → projects → writing → contact);
  doubles as a printable CV (`@media print` + Download CV button). journey.html redirects to /#experience.
- Numbered section headers, editorial writing list, Intersection Observer reveals (subtle)
- Audience: recruiters. Availability stated subtly ("right next challenge"), never as an explicit badge.
- (v1 was dark cool-chrome with a WebGL2 Cells shader — replaced at Brendon's request, preserved in git history)

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
