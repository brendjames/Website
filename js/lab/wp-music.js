// wp-music.js — a bass-hungry music visualiser. Feed it the microphone (it
// asks as soon as it opens): a molten core slams with the bass, a rainbow
// spectrum ring radiates the full 24-band mix, and every beat fires a
// shockwave. Without a mic it hums along on a gentle synthetic groove.
window.WP = window.WP || {};
window.WP.music = (function () {
  const E = () => window.Engine;
  const N = 24;

  const FRAG = Engine.FRAG_HEADER + `
uniform float u_bands[24];
uniform float u_bass;
uniform float u_level;
uniform float u_beatAge;
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = (v_uv-0.5); p.x*=asp;
  float r = length(p);
  float a = atan(p.y, p.x);
  float t = u_time;

  // which band lives at this angle (mirrored so the ring is symmetric)
  float ang = mod((a + t*0.12)/6.28318530718 + 1.0, 1.0);
  float fb = abs(ang*2.0 - 1.0) * 23.999;
  int bi = int(fb);
  float band = mix(u_bands[bi], u_bands[min(bi+1, 23)], fract(fb));

  // the core slams with the bass
  float orbR = 0.13 + u_bass*0.14 + u_level*0.03;

  // spectrum ring radiating from the core
  float barLen = band*band*0.36 + band*0.05;
  float barEnd = orbR + 0.02 + barLen;
  float inBar = smoothstep(orbR + 0.004, orbR + 0.020, r)
              * (1.0 - smoothstep(barEnd - 0.025, barEnd + 0.010, r));
  inBar *= 0.72 + 0.28*cos(fb*12.566371);          // fine spoke texture

  vec3 barCol = palette(ang + t*0.02,
    vec3(0.52,0.42,0.55), vec3(0.45,0.42,0.40),
    vec3(1.0,1.0,1.0),    vec3(0.00,0.33,0.67));

  vec3 col = vec3(0.010, 0.008, 0.016);
  col += vec3(0.05,0.02,0.08) * fbm(p*2.0 + t*0.05) * (0.4 + u_level*1.6);
  col += barCol * inBar * (0.30 + band*1.35);
  // faint full-ring ghost so quiet moments still show the dial
  col += barCol * exp(-pow(r - (orbR+0.05), 2.0)*900.0) * 0.06;

  // molten core + glow
  float core = smoothstep(orbR, orbR - 0.05, r);
  vec3 orbCol = mix(vec3(1.0,0.42,0.22), vec3(1.0,0.86,0.55), clamp(u_bass*1.2, 0.0, 1.0));
  col += orbCol * core * (0.45 + u_bass*1.5 + u_level*0.4);
  col += orbCol * exp(-max(r - orbR, 0.0)*20.0) * (0.22 + u_bass*1.2);

  // beat shockwave rolling outward
  float ring = exp(-pow(r - (orbR + u_beatAge*1.5), 2.0)*240.0) * exp(-u_beatAge*2.4);
  col += vec3(1.0,0.92,0.80) * ring * 0.9;

  // whole frame breathes with the bass
  col *= 1.0 + u_bass*0.25;
  col *= 1.0 - r*0.30;
  frag = vec4(col, 1.0);
}`;

  let prog, bands = new Float32Array(N), idleT = 0;

  return {
    id: 'music', name: 'Music',
    hint: 'Feed it a song — bass slams the core, beats fire shockwaves',
    setup(env) { prog = new (E().Program)(env.gl, E().QUAD_VERT, FRAG); },
    render(env) {
      const gl = env.gl;
      const au = env.audio;
      let bass, level, beatAge;
      if (au && au.on) {
        bands.set(au.bands);
        bass = au.bass; level = au.level; beatAge = Math.min(10, au.beatAge);
      } else {
        // no mic (yet): a gentle synthetic groove keeps the dial alive
        idleT += Math.min(0.05, env.dt || 0.016);
        for (let i = 0; i < N; i++) {
          bands[i] = Math.max(0, 0.28 + 0.20*Math.sin(idleT*2.0 + i*0.7)
                               + 0.12*Math.sin(idleT*5.3 + i*1.9));
        }
        bass = 0.28 + 0.22*Math.sin(idleT*1.8);
        level = 0.22 + env.input.speed*0.3;
        beatAge = idleT % 1.9;
      }
      E().screen(gl, env.W, env.H);
      prog.use();
      E().setCommon(prog, env);
      prog.set('u_bass', bass).set('u_level', level).set('u_beatAge', beatAge);
      gl.uniform1fv(prog.l('u_bands'), bands);
      env.quad.draw();
    },
    dispose() { if (prog) prog.dispose(); prog = null; },
  };
})();
