// wp-led.js — a wall of LED pixels. Waves radiate from the cursor and light the
// dots as they pass; hot pixels tip from cyan into cyber-lime; a click
// broadcasts a ring across the whole wall.
window.WP = window.WP || {};
window.WP.led = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
void main(){
  float asp = u_res.x/u_res.y;
  vec2 gridN = vec2(floor(64.0*asp), 64.0);
  vec2 g = v_uv * gridN;
  vec2 id = floor(g);
  vec2 f  = fract(g) - 0.5;
  vec2 cell = (id + 0.5)/gridN;               // this LED's centre, in uv

  vec2 cm = cell - u_mouse; cm.x *= asp;
  float dm = length(cm);
  vec2 cc = cell - u_clickPos; cc.x *= asp;
  float dc = length(cc);

  // Wave field: cursor ripples + click broadcast ring + slow ambient drift.
  float w = 0.0;
  w += sin(dm*34.0 - u_time*3.2) * exp(-dm*2.6) * (0.55 + u_speed*1.3);
  w += u_click * exp(-pow(dc - u_clickTime*0.75, 2.0)*70.0) * 1.7;
  w += (fbm(cell*vec2(asp,1.0)*2.6 + u_time*0.12) - 0.35) * 0.8;

  float intensity = clamp(0.16 + w*0.62 + exp(-dm*7.0)*0.5, 0.0, 1.5);

  // The dot: radius and brightness follow the wave.
  float radius = 0.10 + 0.30*min(intensity, 1.0);
  float d = length(f);
  float dot_ = smoothstep(radius, radius-0.10, d);
  float rnd = hash1(id);

  vec3 base = mix(vec3(0.14,0.52,0.85), vec3(0.74,0.94,0.34),  // cyan -> lime
                  clamp(intensity-0.55, 0.0, 1.0));

  vec3 col = vec3(0.012,0.020,0.036);                          // panel behind
  col += vec3(0.02,0.035,0.055) * smoothstep(0.46, 0.30, max(abs(f.x),abs(f.y))); // socket
  col += base * dot_ * (0.22 + intensity) * (0.85 + 0.30*rnd);
  col += base * exp(-d*d*7.0) * max(intensity-0.35, 0.0) * 0.22; // bloom on hot LEDs

  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'led', name: 'LED',
    hint: 'Sweep the wall of pixels · click to broadcast a wave',
    setup(env) { prog = new (E().Program)(env.gl, E().QUAD_VERT, FRAG); },
    render(env) {
      const gl = env.gl;
      E().screen(gl, env.W, env.H);
      prog.use();
      E().setCommon(prog, env);
      env.quad.draw();
    },
    dispose() { if (prog) prog.dispose(); prog = null; },
  };
})();
