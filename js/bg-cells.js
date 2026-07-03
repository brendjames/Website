// bg-cells.js — standalone interactive "Cells" Voronoi background.
// Fullscreen WebGL2 canvas behind the page; cells light up near the cursor,
// edges brighten with cursor speed, clicks send a pulse across the lattice.
// Falls back silently (CSS gradient stays) if WebGL2 is unavailable.
(function () {
  'use strict';
  const host = document.getElementById('bg-cells');
  if (!host) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  host.appendChild(canvas);

  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false });
  if (!gl) { canvas.remove(); return; }

  const VERT = `#version 300 es
in vec2 p; out vec2 v_uv;
void main(){ v_uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

  const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 frag;
uniform vec2 u_res; uniform float u_time;
uniform vec2 u_mouse; uniform float u_speed;
uniform vec2 u_clickPos; uniform float u_click; uniform float u_clickTime;
uniform float u_dim;
float hash1(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
vec2 hash2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453123); }
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = v_uv; p.x*=asp;
  float scale = 7.0;
  vec2 g = p*scale;
  vec2 ip = floor(g), fp = fract(g);
  float f1 = 10.0, f2 = 10.0;
  vec2 cId = ip;
  for(int y=-1;y<=1;y++){
    for(int x=-1;x<=1;x++){
      vec2 o = vec2(float(x), float(y));
      vec2 id = ip + o;
      vec2 rnd = hash2(id);
      vec2 cp = o + (0.5 + 0.42*sin(u_time*0.5 + 6.2831*rnd)) - fp;
      float d = dot(cp, cp);
      if(d < f1){ f2 = f1; f1 = d; cId = id; }
      else if(d < f2){ f2 = d; }
    }
  }
  f1 = sqrt(f1); f2 = sqrt(f2);
  float edge = smoothstep(0.0, 0.055, f2 - f1);
  vec2 cw = (cId + 0.5) / scale;
  vec2 mp = u_mouse; mp.x*=asp;
  float nearCursor = exp(-length(cw-mp)*6.0);
  vec2 clp = u_clickPos; clp.x*=asp;
  float ringR = u_clickTime*0.85;
  float act = u_click * exp(-pow(length(cw-clp) - ringR, 2.0)*11.0);
  float light = nearCursor + act;
  float rnd = hash1(cId);
  vec3 base = mix(vec3(0.05,0.08,0.13), vec3(0.14,0.42,0.58), clamp(light,0.0,1.0));
  base *= 0.82 + 0.40*rnd;
  base += (1.0 - f1) * 0.04;
  vec3 edgeCol = vec3(0.30,0.70,0.95) * (0.35 + u_speed*1.4 + light*1.6);
  vec3 col = mix(edgeCol, base, edge);
  col *= u_dim; // keep it quiet behind content
  frag = vec4(col, 1.0);
}`;

  function sh(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const prog = gl.createProgram();
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); return; }
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'p');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const n of ['u_res', 'u_time', 'u_mouse', 'u_speed', 'u_clickPos', 'u_click', 'u_clickTime', 'u_dim']) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  let W = 0, H = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    W = Math.max(2, Math.round(host.clientWidth * dpr));
    H = Math.max(2, Math.round(host.clientHeight * dpr));
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
  }
  window.addEventListener('resize', resize);
  resize();

  // input
  let mx = 0.5, my = 0.5, lx = 0.5, ly = 0.5, speed = 0;
  let clickE = 0, clickT = -10, cx = 0.5, cy = 0.5;
  window.addEventListener('pointermove', (e) => {
    mx = e.clientX / window.innerWidth;
    my = 1 - e.clientY / window.innerHeight;
  }, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    // ignore clicks on interactive elements so links still feel normal
    if (e.target.closest('a, button, input, textarea, label, select')) return;
    cx = e.clientX / window.innerWidth;
    cy = 1 - e.clientY / window.innerHeight;
    clickE = 1; clickT = now;
  });

  let now = 0;
  const start = performance.now();
  let raf = null;

  function frame(t) {
    now = (t - start) / 1000;
    const v = Math.hypot(mx - lx, my - ly);
    speed += (Math.min(1.5, v * 28) - speed) * 0.2;
    lx = mx; ly = my;
    clickE *= 0.96; if (clickE < 0.001) clickE = 0;

    gl.uniform2f(U.u_res, W, H);
    gl.uniform1f(U.u_time, reduced ? 0 : now);
    gl.uniform2f(U.u_mouse, mx, my);
    gl.uniform1f(U.u_speed, speed);
    gl.uniform2f(U.u_clickPos, cx, cy);
    gl.uniform1f(U.u_click, clickE);
    gl.uniform1f(U.u_clickTime, now - clickT);
    gl.uniform1f(U.u_dim, 0.62);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  }
  // pause when tab hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
    else if (!raf) raf = requestAnimationFrame(frame);
  });
  raf = requestAnimationFrame(frame);
})();
