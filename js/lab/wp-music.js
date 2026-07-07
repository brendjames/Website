// wp-music.js — a Milkdrop-style music visualiser. Four presets — Solar,
// Rings, Skyline and Vortex — morph into each other on their own: a random
// preset with a random seed every 16-32 seconds, or early on a strong beat,
// blended through a 1.6s crossfade. Feed it the microphone (it asks as soon
// as it opens); without one it grooves on a synthetic idle beat.
window.WP = window.WP || {};
window.WP.music = (function () {
  const E = () => window.Engine;
  const N = 24;
  const PRESETS = 4;

  const FRAG = Engine.FRAG_HEADER + `
uniform float u_bands[24];
uniform float u_bass;
uniform float u_level;
uniform float u_beatAge;
uniform float u_pA;
uniform float u_pB;
uniform float u_mixAB;
uniform float u_seedA;
uniform float u_seedB;

float bandAt(float x){                 // x 0..1, mirrored for symmetry
  float fb = abs(fract(x)*2.0 - 1.0) * 23.999;
  int bi = int(fb);
  return mix(u_bands[bi], u_bands[min(bi+1, 23)], fract(fb));
}

vec3 scene(int m, float seed, vec2 p, float r, float a, float t){
  vec3 col = vec3(0.0);
  float dir = sign(seed - 0.5);

  if (m == 0) {
    // SOLAR — the molten core wearing the spectrum as a crown
    float ang = mod((a + t*0.12*dir)/6.28318530718 + 1.0, 1.0);
    float fb = abs(fract(ang)*2.0 - 1.0) * 23.999;
    float band = bandAt(ang);
    float orbR = 0.13 + u_bass*0.14 + u_level*0.03;
    float barEnd = orbR + 0.02 + band*band*0.36 + band*0.05;
    float inBar = smoothstep(orbR + 0.004, orbR + 0.020, r)
                * (1.0 - smoothstep(barEnd - 0.025, barEnd + 0.010, r));
    inBar *= 0.72 + 0.28*cos(fb*12.566371);
    vec3 barCol = palette(ang + seed + t*0.02,
      vec3(0.52,0.42,0.55), vec3(0.45,0.42,0.40), vec3(1.0), vec3(0.0,0.33,0.67));
    col += vec3(0.05,0.02,0.08) * fbm(p*2.0 + t*0.05) * (0.4 + u_level*1.6);
    col += barCol * inBar * (0.30 + band*1.35);
    float core = smoothstep(orbR, orbR - 0.05, r);
    vec3 orbCol = mix(vec3(1.0,0.42,0.22), vec3(1.0,0.86,0.55), clamp(u_bass*1.2, 0.0, 1.0));
    col += orbCol * core * (0.45 + u_bass*1.5);
    col += orbCol * exp(-max(r - orbR, 0.0)*20.0) * (0.22 + u_bass*1.2);

  } else if (m == 1) {
    // RINGS — the spectrum as concentric pulse rings, bass sucks them in
    float rr = r * (1.0 - u_bass*0.18);
    float fr = clamp((rr - 0.05)/0.72, 0.0, 0.999) * 24.0;
    float band = u_bands[int(fr)];
    float line = smoothstep(0.42, 0.10, abs(fract(fr) - 0.5));
    float sweep = 0.72 + 0.28*sin(a*2.0 + t*dir*1.3 + seed*6.28);
    col += palette(fr/24.0 + seed + t*0.015,
      vec3(0.5,0.42,0.52), vec3(0.48,0.44,0.42), vec3(1.0), vec3(0.0,0.33,0.67))
      * band*band * line * sweep * 1.8;
    col += vec3(1.0,0.85,0.60) * exp(-r*9.0) * (0.22 + u_bass*1.3);
    col += vec3(0.04,0.02,0.07) * fbm(p*2.4 - t*0.04) * (0.5 + u_level);

  } else if (m == 2) {
    // SKYLINE — mirrored equalizer bars with the bass in the middle
    float fx = abs(v_uv.x*2.0 - 1.0);
    float fb = fx*23.999;
    int bi = int(fb);
    float band = mix(u_bands[bi], u_bands[min(bi+1, 23)], fract(fb));
    float base = 0.32;
    float h = 0.04 + band*band*0.50 + u_bass*0.04;
    float y = v_uv.y - base;
    float tex = 0.72 + 0.28*cos(fb*12.566371);
    vec3 bcol = palette(fx*0.8 + seed + t*0.02,
      vec3(0.5,0.42,0.52), vec3(0.48,0.44,0.42), vec3(1.0), vec3(0.0,0.33,0.67));
    float bar = step(0.0, y) * (1.0 - smoothstep(h - 0.015, h, y));
    float cap = step(0.0, y) * smoothstep(h - 0.030, h - 0.012, y) * (1.0 - smoothstep(h - 0.012, h, y));
    col += bcol * bar * (0.28 + band*1.15) * tex;
    col += vec3(1.0,0.95,0.85) * cap * band * 0.9;
    float ry = base - v_uv.y;
    float refl = step(0.0, ry) * (1.0 - smoothstep(h*0.6 - 0.01, h*0.6, ry));
    col += bcol * refl * (0.08 + band*0.22) * tex * exp(-ry*6.0);
    col += vec3(0.05,0.02,0.08) * fbm(vec2(v_uv.x*3.0, v_uv.y*2.0) + t*0.03) * (0.4 + u_level*1.4);

  } else {
    // VORTEX — a kaleido-folded tunnel that chews on the bass
    float folds = 4.0 + 2.0*floor(seed*3.0);          // 4 / 6 / 8 mirrors
    float sector = 6.28318530718/folds;
    float a2 = mod(a + t*0.25*dir, sector);
    a2 = abs(a2 - sector*0.5);
    float rz = r * (1.0 - u_bass*0.25) + 0.05;
    vec2 q = rz*vec2(cos(a2), sin(a2))*3.0;
    float v = fbm(q - t*0.22);
    float band = u_bands[int(clamp(r*1.4, 0.0, 0.999)*24.0)];
    col = palette(v + r*0.7 - t*0.04 + seed,
      vec3(0.42,0.30,0.44), vec3(0.42,0.38,0.36), vec3(1.0), vec3(0.0,0.33,0.67));
    col *= (0.22 + v*0.75) * (0.5 + band*1.3 + u_bass*0.6);
    col += vec3(1.0,0.80,0.60) * exp(-r*7.0) * (0.15 + u_bass*0.9);
  }
  return col;
}

void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = (v_uv-0.5); p.x*=asp;
  float r = length(p);
  float a = atan(p.y, p.x);
  float t = u_time;

  vec3 col = scene(int(u_pA + 0.5), u_seedA, p, r, a, t);
  if (u_mixAB > 0.002) col = mix(col, scene(int(u_pB + 0.5), u_seedB, p, r, a, t), u_mixAB);

  // shared: beat shockwave + bass breathing
  float ring = exp(-pow(r - (0.15 + u_beatAge*1.5), 2.0)*240.0) * exp(-u_beatAge*2.4);
  col += vec3(1.0,0.92,0.80) * ring * 0.7;
  col *= 1.0 + u_bass*0.25;
  col *= 1.0 - r*0.28;
  frag = vec4(col, 1.0);
}`;

  let prog, bands = new Float32Array(N), idleT = 0;
  let pA = 0, pB = 1, seedA = 0.3, seedB = 0.7, mixAB = 0, transing = false;
  let lastSwitch = null, switchAt = 0;

  function pickNext() {
    let n;
    do { n = (Math.random() * PRESETS) | 0; } while (n === pA);
    return n;
  }

  return {
    id: 'music', name: 'Music',
    hint: 'Feed it a song — presets morph on their own, Milkdrop-style',
    setup(env) {
      prog = new (E().Program)(env.gl, E().QUAD_VERT, FRAG);
      pA = 0; seedA = Math.random(); mixAB = 0; transing = false; lastSwitch = null;
    },
    render(env) {
      const gl = env.gl;
      const t = env.time;
      const au = env.audio;
      let bass, level, beatAge;
      if (au && au.on) {
        bands.set(au.bands);
        bass = au.bass; level = au.level; beatAge = Math.min(10, au.beatAge);
      } else {
        // no mic (yet): a gentle synthetic groove keeps the show running
        idleT += Math.min(0.05, env.dt || 0.016);
        for (let i = 0; i < N; i++) {
          bands[i] = Math.max(0, 0.28 + 0.20*Math.sin(idleT*2.0 + i*0.7)
                               + 0.12*Math.sin(idleT*5.3 + i*1.9));
        }
        bass = 0.28 + 0.22*Math.sin(idleT*1.8);
        level = 0.22 + env.input.speed*0.3;
        beatAge = idleT % 1.9;
      }

      // Milkdrop brain: crossfade to a random preset on a timer, or hard-cut
      // early when a strong beat lands after a minimum dwell
      if (lastSwitch === null) { lastSwitch = t; switchAt = t + 14 + Math.random()*12; }
      if (!transing && (t > switchAt || (beatAge < 0.06 && t > lastSwitch + 9))) {
        pB = pickNext(); seedB = Math.random(); transing = true;
      }
      if (transing) {
        mixAB = Math.min(1, mixAB + (env.dt || 0.016) / 1.6);
        if (mixAB >= 1) {
          pA = pB; seedA = seedB; mixAB = 0; transing = false;
          lastSwitch = t; switchAt = t + 16 + Math.random()*16;
        }
      }

      E().screen(gl, env.W, env.H);
      prog.use();
      E().setCommon(prog, env);
      prog.set('u_bass', bass).set('u_level', level).set('u_beatAge', beatAge)
        .set('u_pA', pA).set('u_pB', pB).set('u_mixAB', mixAB)
        .set('u_seedA', seedA).set('u_seedB', seedB);
      gl.uniform1fv(prog.l('u_bands'), bands);
      env.quad.draw();
    },
    dispose() { if (prog) prog.dispose(); prog = null; },
  };
})();
