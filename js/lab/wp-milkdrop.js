// wp-milkdrop.js — an homage to the original. No fixed presets: every 30
// seconds a fresh 20-gene genome is rolled — mirror folds, spin, zoom pulse,
// domain warp, plasma/turbulence/ring layers, flow direction, contrast and a
// fully random cosine palette — and the old universe crossfades into the new
// one. The cursor is a lens in the field; a click rings the whole picture.
window.WP = window.WP || {};
window.WP.milkdrop = (function () {
  const E = () => window.Engine;
  const G = 20;

  const FRAG = Engine.FRAG_HEADER + `
uniform float u_gA[20];
uniform float u_gB[20];
uniform float u_mixAB;

vec3 universe(in float g[20], vec2 p, float t){
  float dir = sign(g[1] - 0.5);
  float a = atan(p.y, p.x);
  float r = length(p);

  // maybe fold the world into a kaleidoscope (3..8 mirrors), maybe not
  float folds = floor(g[0]*7.0);
  if (folds > 0.5) {
    float n = folds + 2.0;
    float sector = 6.28318530718/n;
    a = mod(a + t*(0.05 + g[1]*0.25)*dir, sector);
    a = abs(a - sector*0.5);
  } else {
    a += t*(g[1] - 0.5)*0.45;
  }

  // zoom that breathes at its own pace
  float zoom = 0.8 + g[2]*2.4;
  zoom *= 1.0 + 0.18*g[3]*sin(t*(0.2 + g[3]*0.8));
  vec2 q = r*zoom*vec2(cos(a), sin(a));

  // drift + domain warp
  q += vec2(g[16] - 0.5, g[17] - 0.5)*t*0.6;
  q += (vec2(fbm(q*(0.4 + g[5]*2.6) + t*0.10),
             fbm(q*(0.4 + g[5]*2.6) - t*0.12 + 7.7)) - 0.5) * g[4]*2.4;

  // pattern: a random blend of plasma, turbulence, rings and soft noise
  float v = 0.0;
  v += g[7] * sin(q.x*(1.0 + g[6]*6.0) + t*0.5) * sin(q.y*(1.0 + g[6]*5.0) - t*0.4);
  v += g[9] * (fbm(q*(0.5 + g[8]*2.5)) * 2.0 - 1.0);
  v += g[11] * sin(length(q)*(2.0 + g[10]*14.0) - t*(0.4 + g[3]*0.8));
  v += g[18] * (vnoise(q*(2.0 + g[18]*4.0)) - 0.5);

  // a palette rolled from thin air
  vec3 pd = vec3(g[12], fract(g[12] + 0.28 + g[14]*0.25), fract(g[12] + 0.62 - g[14]*0.20));
  vec3 col = palette(v*(0.5 + g[13]*0.8) + t*0.02,
    vec3(0.48, 0.44, 0.46), vec3(0.42, 0.44, 0.40),
    vec3(0.7 + g[13]*0.7),  pd);

  // contrast + a slow pulse of its own
  col = pow(max(col, vec3(0.0)), vec3(0.8 + g[15]*1.2));
  col *= 0.86 + 0.14*sin(t*(0.2 + g[19]*0.9));
  return col;
}

void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = (v_uv-0.5); p.x*=asp;

  // the cursor is a lens the field bends around
  vec2 m = (u_mouse-0.5); m.x*=asp;
  vec2 dm = p - m;
  float md = length(dm);
  p += (dm/max(md, 1e-3)) * exp(-md*md*6.0) * (0.10 + u_speed*0.10);

  float t = u_time;
  vec3 col = universe(u_gA, p, t);
  if (u_mixAB > 0.002) col = mix(col, universe(u_gB, p, t), u_mixAB);

  // click rings the whole picture
  vec2 cp = (u_clickPos-0.5); cp.x*=asp;
  float cr = length(p - cp);
  col += vec3(1.0, 0.95, 0.85) * u_click * exp(-pow(cr - u_clickTime*1.2, 2.0)*90.0) * 0.6;

  col *= 1.0 + u_speed*0.25;
  col *= 1.0 - length(p)*0.24;
  frag = vec4(col, 1.0);
}`;

  let prog;
  let gA = new Float32Array(G), gB = new Float32Array(G);
  let mixAB = 0, transing = false, lastSwitch = null, switchAt = 0;

  function roll(arr) { for (let i = 0; i < G; i++) arr[i] = Math.random(); }

  return {
    id: 'milkdrop', name: 'Milkdrop',
    hint: 'A new universe every 30 seconds · completely random',
    setup(env) {
      prog = new (E().Program)(env.gl, E().QUAD_VERT, FRAG);
      roll(gA); roll(gB);
      mixAB = 0; transing = false; lastSwitch = null;
    },
    render(env) {
      const gl = env.gl;
      const t = env.time;

      // every 30 seconds: roll a fresh genome and crossfade into it
      if (lastSwitch === null) { lastSwitch = t; switchAt = t + 30; }
      if (!transing && t > switchAt) { roll(gB); transing = true; }
      if (transing) {
        mixAB = Math.min(1, mixAB + (env.dt || 0.016) / 2.5);
        if (mixAB >= 1) {
          gA.set(gB); mixAB = 0; transing = false;
          lastSwitch = t; switchAt = t + 30;
        }
      }

      E().screen(gl, env.W, env.H);
      prog.use();
      E().setCommon(prog, env);
      prog.set('u_mixAB', mixAB);
      gl.uniform1fv(prog.l('u_gA'), gA);
      gl.uniform1fv(prog.l('u_gB'), gB);
      env.quad.draw();
    },
    dispose() { if (prog) prog.dispose(); prog = null; },
  };
})();
