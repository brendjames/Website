// script.js — GSAP-choreographed day/night toggle.
// Sun rises from behind the horizon for light; moon sinks from the top for dark.
// The page-wide colour swap is a CSS transition, fired mid-timeline.
(function () {
  'use strict';

  if (typeof gsap === 'undefined') return; // GSAP failed to load — page still readable

  const root     = document.documentElement;
  const btn      = document.getElementById('toggle');
  const label    = document.getElementById('modeLabel');
  const meta      = document.querySelector('meta[name="theme-color"]');
  const sun      = document.querySelector('.sun');
  const moon     = document.querySelector('.moon');
  const rays     = document.querySelector('.rays');
  const skyDay   = document.querySelector('.sky-day');
  const skyNight = document.querySelector('.sky-night');
  const stars    = document.querySelector('.stars');

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PARK = 300;   // yPercent that parks a body fully off-stage (resize-proof)

  let theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

  // Snap every element to the correct resting state for a theme (no animation).
  function paintInstant(t) {
    const dark = t === 'dark';
    gsap.set(sun,  { yPercent: dark ?  PARK : 0, opacity: dark ? 0 : 1, scale: dark ? 0.6 : 1 });
    gsap.set(moon, { yPercent: dark ? 0 : -PARK, opacity: dark ? 1 : 0, scale: dark ? 1 : 0.6 });
    gsap.set(skyNight, { opacity: dark ? 1 : 0 });
    gsap.set(skyDay,   { opacity: dark ? 0 : 1 });
    gsap.set(stars,    { opacity: dark ? 1 : 0 });
  }

  // Commit the theme: flips the data-attribute (CSS transitions the colours) + a11y/meta/persistence.
  function applyTheme(t) {
    theme = t;
    root.setAttribute('data-theme', t);
    btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
    btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    label.textContent = t === 'dark' ? 'Dark mode' : 'Light mode';
    if (meta) meta.setAttribute('content', t === 'dark' ? '#161310' : '#FAF9F6');
    try { localStorage.setItem('landing-theme', t); } catch (e) {}
  }

  // --- Transition to dark: sun sets behind the hill, moon sinks in from the top ---
  function toDark() {
    const d = reduce ? 0.001 : 1;
    gsap.timeline({ defaults: { overwrite: 'auto' } })
      .to(skyDay,   { opacity: 0, duration: 0.9 * d, ease: 'power1.inOut' }, 0)
      .to(skyNight, { opacity: 1, duration: 0.9 * d, ease: 'power1.inOut' }, 0)
      .to(sun,      { yPercent: PARK, opacity: 0, scale: 0.6, duration: 0.75 * d, ease: 'power2.in' }, 0)
      .fromTo(moon,
        { yPercent: -PARK, opacity: 0, scale: 0.6 },
        { yPercent: 0, opacity: 1, scale: 1, duration: 1.0 * d, ease: 'power3.out' }, 0.1 * d)
      .to(stars,    { opacity: 1, duration: 0.9 * d, ease: 'power1.out' }, 0.2 * d)
      .add(() => applyTheme('dark'), reduce ? 0 : 0.18);
  }

  // --- Transition to light: moon rises out the top, sun climbs from behind the hill ---
  function toLight() {
    const d = reduce ? 0.001 : 1;
    gsap.timeline({ defaults: { overwrite: 'auto' } })
      .to(skyNight, { opacity: 0, duration: 0.9 * d, ease: 'power1.inOut' }, 0)
      .to(skyDay,   { opacity: 1, duration: 0.9 * d, ease: 'power1.inOut' }, 0)
      .to(moon,     { yPercent: -PARK, opacity: 0, scale: 0.6, duration: 0.75 * d, ease: 'power2.in' }, 0)
      .fromTo(sun,
        { yPercent: PARK, opacity: 0, scale: 0.6 },
        { yPercent: 0, opacity: 1, scale: 1, duration: 1.0 * d, ease: 'back.out(1.4)' }, 0.1 * d)
      .to(stars,    { opacity: 0, duration: 0.7 * d, ease: 'power1.out' }, 0)
      .add(() => applyTheme('light'), reduce ? 0 : 0.18);
  }

  paintInstant(theme);
  applyTheme(theme);   // sync label / aria / meta to the initial theme

  btn.addEventListener('click', () => (theme === 'dark' ? toLight() : toDark()));

  // slow, endless sun-ray rotation (skipped for reduced motion)
  if (!reduce) {
    gsap.to(rays, { rotation: 360, duration: 60, ease: 'none', repeat: -1, transformOrigin: '50% 50%' });
  }
})();
