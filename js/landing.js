// landing.js — the homepage's floating nav, and the go-between for the golden-hour
// sky behind the hero (js/sky.js). It hands the sky its canvas, then keeps it posted
// on size, pointer, theme, visibility and reduced motion. Where the browser allows,
// the sky runs in a worker (OffscreenCanvas), so compiling its shader and drawing it
// never hold up the page. Without WebGL the CSS sky stays.
(function () {
  'use strict';

  const root = document.documentElement;

  // ----- Nav floats over the sky at the top, turns solid once you scroll -----
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('solid', window.scrollY > 24);
    document.addEventListener('scroll', onScroll, { passive: true });
    // first check just after the first frame: reading scrollY any earlier forces layout
    requestAnimationFrame(() => setTimeout(onScroll));
  }

  const canvas = document.getElementById('sky');
  const hero = canvas && canvas.closest('.hero');
  const ground = hero && hero.querySelector('.ground');
  if (!canvas || !hero || !ground) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isDark = () => root.getAttribute('data-theme') === 'dark';
  const pageBg = () => {
    const m = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g);
    return m && m.length >= 3 ? [m[0] / 255, m[1] / 255, m[2] / 255] : null;
  };
  // the sky fades in over the CSS one once it has drawn, and back out if the GPU drops it
  const fromSky = (m) => canvas.classList.toggle('ready', m.ready);

  // ----- Start the sky: in a worker where we can, on the page where we can't -----
  let send = null;
  const tell = (m) => { if (send) send(m); };
  const launchSky = () => {
    const start = { night: isDark(), reduced: reduced.matches, hidden: document.hidden };
    if (canvas.transferControlToOffscreen && window.Worker) {
      const worker = new Worker('js/sky.js');
      worker.onmessage = (e) => fromSky(e.data);
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage(Object.assign({ canvas: offscreen }, start), [offscreen]);
      send = (m) => worker.postMessage(m);
    } else {
      let queue = [];
      send = (m) => { if (queue) queue.push(m); };
      const script = document.createElement('script');
      script.src = 'js/sky.js';
      script.onload = async () => {
        const update = await window.startSky(canvas, start, fromSky);
        if (update) { queue.forEach(update); send = update; }
        queue = null;
      };
      document.head.appendChild(script);
    }
  };

  // ----- Keep it posted -----
  // size, once the browser has laid the hero out and after every resize. The sky
  // starts on the first of these: handing over the canvas any earlier forces a
  // style pass on the whole page.
  new ResizeObserver(() => {
    if (!send) launchSky();
    send({
      width: hero.clientWidth,
      height: hero.clientHeight,
      dpr: window.devicePixelRatio || 1,
      ground: ground.offsetHeight / Math.max(1, hero.clientHeight),
      bg: pageBg(),
    });
  }).observe(hero);

  // the pointer, at most once a frame
  let pointer = null;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = hero.getBoundingClientRect();
    if (!pointer) requestAnimationFrame(() => { if (pointer) tell(pointer); pointer = null; });
    pointer = {
      mx: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      my: Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)),
      hover: e.clientY >= r.top && e.clientY <= r.bottom ? 1 : 0,
    };
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { pointer = null; tell({ hover: 0 }); });

  // the nav toggle (or the system setting) flips data-theme: sunset / sunrise
  new MutationObserver(() => tell({ night: isDark(), bg: pageBg() }))
    .observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  new IntersectionObserver((entries) => tell({ onScreen: entries[0].isIntersecting })).observe(hero);
  document.addEventListener('visibilitychange', () => tell({ hidden: document.hidden }));
  if (reduced.addEventListener) reduced.addEventListener('change', () => tell({ reduced: reduced.matches }));
})();
