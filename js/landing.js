// landing.js — the homepage's golden-hour horizon (WebGL) and its floating nav.
// Day: a low sun over the savanna, drifting clouds, birds, dust in the light.
// Night (dark theme): the sun sets, stars come out, the moon rises, fireflies.
// The theme toggle animates between the two. Without WebGL the CSS sky stays.
(function () {
  'use strict';

  const root = document.documentElement;

  // ----- Nav floats over the sky at the top, turns solid once you scroll -----
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('solid', window.scrollY > 24);
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  const canvas = document.getElementById('sky');
  const hero = canvas && canvas.closest('.hero');
  const ground = hero && hero.querySelector('.ground');
  if (!canvas || !hero || !ground) return;

  const gl = canvas.getContext('webgl', {
    alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power',
  });
  if (!gl) return;

  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';

  // Units: 1.0 = canvas height, origin bottom-left. u_ground is the height of the
  // ground band (hills + trees) as a fraction of the canvas, measured from .ground.
  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;
uniform float u_time;
uniform float u_night;
uniform vec2 u_mouse;
uniform float u_hover;
uniform float u_ground;
uniform vec3 u_bg;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
float sdSeg(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
// a ridge line inside the ground band
float ridge(float x, float base, float amp, float freq, float seed){
  return u_ground * (base + amp * fbm(vec2(x * freq + seed, seed)));
}

// acacia in tree space: trunk base at the origin, about one unit tall
float acacia(vec2 q){
  // trunk and the forked branches that hold the umbrella up
  float d = sdSeg(q, vec2(0.0), vec2(0.04, 0.50)) - 0.032;
  d = min(d, sdSeg(q, vec2(0.04, 0.40), vec2(-0.32, 0.82)) - 0.016);
  d = min(d, sdSeg(q, vec2(0.04, 0.46), vec2(0.36, 0.84)) - 0.016);
  d = min(d, sdSeg(q, vec2(0.03, 0.48), vec2(0.06, 0.86)) - 0.014);
  // flat-topped umbrella: gently domed top, flatter underside, clumpy leafy edges,
  // tapering to thin tips
  float x = q.x / 0.72;
  float clump = noise(vec2(q.x * 7.0, 1.7)) - 0.5;
  float leaf = noise(vec2(q.x * 30.0, 5.3)) - 0.5;
  float top = 0.95 - 0.09 * x * x + clump * 0.05 + leaf * 0.02;
  float bot = 0.81 + 0.04 * x * x - clump * 0.03 + leaf * 0.015;
  float c = max(max(bot - q.y, q.y - top), abs(q.x) - 0.72 - clump * 0.06);
  return min(d, c);
}
float tree(vec2 p, float x, float baseY, float s, float flip){
  vec2 q = (p - vec2(x, baseY)) / s;
  q.x *= flip;
  if (abs(q.x) > 1.1 || q.y < -0.3 || q.y > 1.1) return 0.0;
  float aa = 1.2 / (u_res.y * s);
  return smoothstep(aa, -aa, acacia(q));
}

// soft points drifting through the air: dust by day, fireflies by night
float motes(vec2 p, float scale, float seed, vec2 drift){
  vec2 q = p * scale + drift;
  vec2 i = floor(q);
  float h1 = hash(i + seed);
  if (h1 < 0.72) return 0.0;
  vec2 o = vec2(hash(i + seed + 1.3), hash(i + seed + 2.7)) - 0.5;
  o += 0.22 * vec2(sin(u_time * 0.6 + h1 * 31.0), cos(u_time * 0.5 + h1 * 17.0));
  float d = length(fract(q) - 0.5 - o * 0.5);
  return smoothstep(0.13, 0.0, d) * (0.55 + 0.45 * sin(u_time * (0.7 + h1 * 1.8) + h1 * 50.0));
}

void main(){
  float px = 1.0 / u_res.y;
  vec2 p = gl_FragCoord.xy * px;
  float A = u_res.x * px;
  float g = u_ground;
  float n = smoothstep(0.0, 1.0, u_night);
  float t = u_time;
  float par = u_mouse.x - 0.5;
  float wide = clamp((A - 0.8) / 0.8, 0.0, 1.0);    // 0 = portrait phone, 1 = landscape

  // ---- sky: golden hour -> dusk -> night ----
  float h = clamp((p.y - g) / (1.0 - g), 0.0, 1.0);
  vec3 day = mix(vec3(0.973, 0.718, 0.443), vec3(0.980, 0.835, 0.659), smoothstep(0.0, 0.2, h));
  day = mix(day, vec3(0.925, 0.886, 0.824), smoothstep(0.15, 0.5, h));
  day = mix(day, vec3(0.741, 0.835, 0.890), smoothstep(0.45, 1.0, h));
  vec3 dusk = mix(vec3(0.925, 0.478, 0.302), vec3(0.722, 0.420, 0.502), smoothstep(0.0, 0.35, h));
  dusk = mix(dusk, vec3(0.255, 0.212, 0.416), smoothstep(0.3, 1.0, h));
  vec3 nite = mix(vec3(0.290, 0.196, 0.306), vec3(0.157, 0.118, 0.231), smoothstep(0.0, 0.3, h));
  nite = mix(nite, vec3(0.071, 0.059, 0.133), smoothstep(0.25, 1.0, h));
  vec3 col = mix(day, nite, n);
  col = mix(col, dusk, 0.6 * sin(3.14159 * n));

  // ---- stars ----
  float starVis = smoothstep(0.35, 0.9, n) * smoothstep(0.02, 0.25, h);
  if (starVis > 0.0) {
    for (int L = 0; L < 2; L++) {
      float sc = L == 0 ? 70.0 : 140.0;
      vec2 sp = p * sc + float(L) * 17.0;
      vec2 si = floor(sp);
      float sh = hash(si);
      vec2 so = vec2(hash(si + 3.1), hash(si + 7.7)) - 0.5;
      float sd = length(fract(sp) - 0.5 - so * 0.6);
      float tw = 0.65 + 0.35 * sin(t * (1.0 + sh * 3.0) + sh * 40.0);
      float on = step(L == 0 ? 0.92 : 0.9, sh);
      col += vec3(1.0, 0.95, 0.86) * on * smoothstep(0.14, 0.0, sd) * tw * starVis * (L == 0 ? 0.9 : 0.5);
    }
  }

  // ---- moon (rises as the sun sets) ----
  // on phones the text fills the sky, so sun and moon sit low, half behind the far hills
  float moonUp = smoothstep(0.35, 1.0, n);
  float moonRest = mix(g * 0.74, g + 0.42 * (1.0 - g), wide);
  vec2 moonP = vec2(A * mix(0.74, 0.80, wide) - par * 0.02, mix(g - 0.2, moonRest, moonUp));
  float dm = length(p - moonP);
  col += vec3(0.95, 0.90, 0.80) * (0.25 * exp(-dm * 9.0) + 0.10 * exp(-dm * 3.0)) * moonUp;
  float crater = fbm((p - moonP) * 40.0 + 3.0);
  vec3 moonCol = vec3(0.96, 0.93, 0.86) - 0.12 * smoothstep(0.45, 0.7, crater);
  col = mix(col, moonCol, smoothstep(0.05 + px, 0.05 - px, dm) * moonUp);

  // ---- sun (sinks behind the hills at night) ----
  vec2 sunP = vec2(A * mix(0.70, 0.74, wide) + par * 0.04,
                   mix(g * 0.72, g + 0.1, wide) - 0.24 * smoothstep(0.0, 0.8, n) + (u_mouse.y - 0.5) * 0.02);
  float ds = length(p - sunP);
  vec3 sunCol = mix(vec3(1.0, 0.80, 0.50), vec3(1.0, 0.52, 0.26), smoothstep(0.0, 0.6, n));
  float sunUp = 1.0 - smoothstep(0.55, 0.9, n);
  col += sunCol * (0.26 * exp(-ds * 8.0) + 0.2 * exp(-ds * 2.4)) * sunUp;
  col += sunCol * exp(-abs(p.y - g * 0.9) * 9.0) * exp(-abs(p.x - sunP.x) * 0.9) * 0.22 * (1.0 - n * 0.7);
  float ang = atan(p.y - sunP.y, p.x - sunP.x);
  float rays = noise(vec2(ang * 9.0, t * 0.05)) * noise(vec2(ang * 23.0, -t * 0.03));
  col += sunCol * rays * exp(-ds * 2.6) * 0.16 * sunUp * step(g * 0.6, p.y);
  // a golden-hour sun: hot pale core, deep gold rim, reddening as it sets
  float disc = smoothstep(0.064 + px, 0.064 - px, ds);
  vec3 discCol = mix(vec3(1.0, 0.96, 0.82), vec3(1.0, 0.74, 0.40), smoothstep(0.0, 0.064, ds));
  discCol = mix(discCol, vec3(1.0, 0.55, 0.30), smoothstep(0.1, 0.7, n));
  col = mix(col, discCol, disc * (1.0 - smoothstep(0.7, 1.0, n)));

  // ---- clouds: thin streaks, lit warm near the sun ----
  vec2 cq = vec2(p.x * 1.15 + t * 0.008 + par * 0.02, p.y * 7.5);
  float cv = fbm(cq + vec2(0.0, fbm(cq * 0.6 + t * 0.01) * 1.4));
  float band = smoothstep(0.1, 0.28, h) * smoothstep(0.92, 0.6, h);
  float cloud = smoothstep(0.52, 0.8, cv) * band;
  vec3 cDay = mix(vec3(0.976, 0.784, 0.698), vec3(1.0, 0.910, 0.776), exp(-ds * 2.2));
  col = mix(col, mix(cDay, vec3(0.243, 0.212, 0.337), n), cloud * 0.5);

  // ---- a small flock crossing the evening sky ----
  float birdVis = 1.0 - smoothstep(0.0, 0.4, n);
  if (birdVis > 0.0) {
    float lead = mod(t * 0.018, A + 0.8) - 0.4;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      // high in a wide sky; on phones just above the hills, below the text
      vec2 bc = vec2(lead - 0.034 * fi,
                     mix(g * 0.9, g + 0.36 * (1.0 - g), wide) + 0.018 * sin(fi * 2.4) + 0.006 * sin(t * 0.3 + fi));
      float s = 0.011 - fi * 0.001;
      vec2 q = (p - bc) / s;
      q.x = abs(q.x);
      float flap = sin(t * 5.0 + fi * 1.7) * 0.35;
      float bd = sdSeg(q, vec2(0.0), vec2(0.55, 0.30 + flap * 0.5));
      bd = min(bd, sdSeg(q, vec2(0.55, 0.30 + flap * 0.5), vec2(1.1, 0.05 + flap)));
      float aa = px / s;
      col = mix(col, vec3(0.30, 0.22, 0.22), smoothstep(0.09 + aa, 0.09 - aa, bd) * 0.75 * birdVis);
    }
  }

  // ---- savanna: three ridges, nearer ones darker and moving more with the cursor ----
  float xf = p.x + par * 0.012, xm = p.x + par * 0.022, xn = p.x + par * 0.04;
  vec3 hz = mix(vec3(0.973, 0.718, 0.443), vec3(0.290, 0.196, 0.306), n);
  vec3 farC = mix(mix(vec3(0.80, 0.55, 0.47), hz, 0.35), vec3(0.16, 0.12, 0.20), n);
  vec3 midC = mix(vec3(0.52, 0.34, 0.30), vec3(0.10, 0.08, 0.13), n);
  vec3 nearC = mix(vec3(0.20, 0.13, 0.12), vec3(0.045, 0.035, 0.06), n);

  float farR = ridge(xf, 0.52, 0.22, 1.4, 1.3);
  col = mix(col, farC, smoothstep(farR + px, farR - px, p.y));
  float ft = tree(vec2(xf, p.y), A * 0.45, ridge(A * 0.45, 0.52, 0.22, 1.4, 1.3) - 0.004, g * 0.14, 1.0);
  col = mix(col, farC, ft);

  float midR = ridge(xm, 0.36, 0.16, 2.2, 4.7);
  col = mix(col, midC, smoothstep(midR + px, midR - px, p.y));
  float mt = tree(vec2(xm, p.y), A * 0.30, ridge(A * 0.30, 0.36, 0.16, 2.2, 4.7) - 0.006, g * 0.28, -1.0);
  mt = max(mt, tree(vec2(xm, p.y), A * 0.70, ridge(A * 0.70, 0.36, 0.16, 2.2, 4.7) - 0.006, g * 0.22, 1.0));
  col = mix(col, midC, mt);

  float nearR = ridge(xn, 0.20, 0.14, 3.0, 8.1);
  col = mix(col, nearC, smoothstep(nearR + px, nearR - px, p.y));
  float nt = tree(vec2(xn, p.y), A * 0.10, ridge(A * 0.10, 0.20, 0.14, 3.0, 8.1) - 0.01, g * 0.62, 1.0);
  nt = max(nt, tree(vec2(xn, p.y), A * 0.55, ridge(A * 0.55, 0.20, 0.14, 3.0, 8.1) - 0.01, g * 0.40, -1.0));
  nt = max(nt, tree(vec2(xn, p.y), A * 0.88, ridge(A * 0.88, 0.20, 0.14, 3.0, 8.1) - 0.01, g * 0.52, 1.0));
  col = mix(col, nearC, nt);

  // ---- dust in the low sun / fireflies over the grass ----
  float dust = motes(p, 18.0, 0.0, -vec2(t * 0.06, t * 0.11)) + 0.6 * motes(p, 34.0, 7.0, -vec2(t * 0.08, t * 0.15));
  col += vec3(1.0, 0.90, 0.72) * dust * (0.03 + 1.2 * exp(-ds * 3.0)) * 0.34 * (1.0 - n);  // only in the sunlight
  float ff = motes(p, 26.0, 19.0, -vec2(t * 0.03, t * 0.02));
  float ffZone = smoothstep(g + 0.16, g * 0.5, p.y) * smoothstep(g * 0.15, g * 0.4, p.y);
  col += vec3(1.0, 0.80, 0.38) * ff * ff * ffZone * 1.3 * n;

  // ---- a warm glow that follows the cursor ----
  float dc = length(p - vec2(u_mouse.x * A, u_mouse.y));
  col += mix(vec3(1.0, 0.86, 0.62), vec3(1.0, 0.75, 0.40), n) * exp(-dc * 7.0) * mix(0.05, 0.08, n) * u_hover;

  // ---- vignette, then mist that melts into the page below ----
  vec2 uv = gl_FragCoord.xy / u_res;
  col *= 1.0 - 0.10 * pow(length((uv - vec2(0.5, 0.6)) * vec2(1.0, 0.9)), 2.2);
  float mist = smoothstep(g * 0.30, 0.0, p.y);
  col = mix(col, u_bg, mist * mist);
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.012;   // dither: no banding in the gradients
  gl_FragColor = vec4(col, 1.0);
}`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); return; }
  gl.useProgram(prog);

  // one triangle that covers the screen
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const name of ['u_res', 'u_time', 'u_night', 'u_mouse', 'u_hover', 'u_ground', 'u_bg']) {
    U[name] = gl.getUniformLocation(prog, name);
  }

  // ----- State -----
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isDark = () => root.getAttribute('data-theme') === 'dark';
  let night = isDark() ? 1 : 0;
  let nightTarget = night;
  const mouse = [0.5, 0.5];
  const mouseTarget = [0.5, 0.5];
  let hover = 0;
  let hoverTarget = 0;
  let groundFrac = 0.27;
  let bg = [0.98, 0.976, 0.965];
  const readBg = () => {
    const m = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g);
    if (m && m.length >= 3) bg = [m[0] / 255, m[1] / 255, m[2] / 255];
  };
  readBg();

  // The scene is soft, so cap the pixel count: big or high-DPI screens render a
  // little under native resolution and nobody can tell.
  const resize = () => {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const k = Math.min(1, Math.sqrt(2.2e6 / Math.max(1, w * h * dpr * dpr)));
    canvas.width = Math.max(1, Math.round(w * dpr * k));
    canvas.height = Math.max(1, Math.round(h * dpr * k));
    gl.viewport(0, 0, canvas.width, canvas.height);
    groundFrac = ground.offsetHeight / Math.max(1, h);
  };

  // ----- Render loop (paused off-screen, in background tabs, and for reduced motion) -----
  const t0 = performance.now();
  let last = t0;
  let raf = 0;
  let onScreen = true;
  const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-dt * rate));

  const render = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const still = reduced.matches;
    night = still ? nightTarget : approach(night, nightTarget, 2.4, dt);
    mouse[0] = still ? 0.5 : approach(mouse[0], mouseTarget[0], 3, dt);
    mouse[1] = still ? 0.5 : approach(mouse[1], mouseTarget[1], 3, dt);
    hover = still ? 0 : approach(hover, hoverTarget, 4, dt);

    gl.uniform2f(U.u_res, canvas.width, canvas.height);
    gl.uniform1f(U.u_time, still ? 40 : (now - t0) / 1000);
    gl.uniform1f(U.u_night, night);
    gl.uniform2f(U.u_mouse, mouse[0], mouse[1]);
    gl.uniform1f(U.u_hover, hover);
    gl.uniform1f(U.u_ground, groundFrac);
    gl.uniform3f(U.u_bg, bg[0], bg[1], bg[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.classList.add('ready');
  };
  const frame = (now) => {
    raf = 0;
    render(now);
    if (!reduced.matches && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };

  // ----- Inputs -----
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = hero.getBoundingClientRect();
    mouseTarget[0] = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    mouseTarget[1] = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    hoverTarget = e.clientY >= r.top && e.clientY <= r.bottom ? 1 : 0;
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { hoverTarget = 0; });

  // the nav toggle (or the system setting) flips data-theme: sunset / sunrise
  new MutationObserver(() => {
    nightTarget = isDark() ? 1 : 0;
    readBg();
    kick();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  new ResizeObserver(() => { resize(); kick(); }).observe(hero);
  new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    if (onScreen) kick();
  }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  if (reduced.addEventListener) reduced.addEventListener('change', kick);

  // if the GPU drops the context, fall back to the CSS sky rather than a black box
  canvas.addEventListener('webglcontextlost', () => {
    cancelAnimationFrame(raf);
    raf = 0;
    canvas.classList.remove('ready');
  });

  resize();
  kick();
})();
