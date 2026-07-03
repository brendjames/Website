// wp-chrome.js — liquid-metal domain-warped flow. The cursor warps the molten bands;
// faster movement adds turbulence; a click sends a shock ring outward.
window.WP = window.WP || {};
window.WP.chrome = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = (v_uv-0.5); p.x*=asp; p*=2.2;
  vec2 m = (u_mouse-0.5); m.x*=asp; m*=2.2;
  float t = u_time*0.08;

  vec2 toM = p - m; float md = length(toM);
  float warp = (0.55 + u_speed*2.2) * exp(-md*0.75);
  vec2 dir = toM / max(md,1e-3);

  // Domain warping -> molten metal.
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(3.1,1.7) - t));
  vec2 r = vec2(
    fbm(p + 2.0*q + warp*dir + vec2(1.7,9.2)),
    fbm(p + 2.0*q - warp*dir*0.6 + vec2(8.3,2.8))
  );
  float f = fbm(p + 2.6*r + t*0.5);

  // Click shock ring.
  float ring = u_click * exp(-pow(md - u_clickTime*1.6, 2.0) * 7.0);
  f += ring*0.45;

  // Chrome ramp in slate/blue/cyan.
  vec3 col = palette(f + 0.10,
    vec3(0.09,0.14,0.20), vec3(0.16,0.26,0.38),
    vec3(1.0,1.0,1.0),    vec3(0.55,0.62,0.72));

  // Anisotropic sheen on the metal bands.
  float band = abs(fract(f*4.0)-0.5)*2.0;
  float sheen = pow(1.0-band, 8.0);
  col += sheen * vec3(0.5,0.72,0.95) * (0.35 + u_speed*0.9);

  // Fine contour lines deepen the molten read.
  col *= 0.72 + 0.5*smoothstep(0.0, 0.04, abs(fract(f*8.0)-0.5));

  // Cool cursor pool.
  col += vec3(0.10,0.40,0.60) * exp(-md*2.4) * 0.5;

  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'chrome', name: 'Chrome',
    hint: 'Move to warp the metal · click for a shock ring',
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
