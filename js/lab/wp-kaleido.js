// wp-kaleido.js — a jewel-tone kaleidoscope. Slide the cursor left-right to
// change how many times the mirror folds (4..12), up-down to turn the wheel;
// a click blooms a bright ring out through the mandala. Palette: magenta,
// gold, emerald, violet.
window.WP = window.WP || {};
window.WP.kaleido = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = (v_uv-0.5); p.x*=asp;
  float r = length(p);
  float a = atan(p.y, p.x);

  // cursor X folds the mirror, cursor Y turns the wheel
  float folds = 4.0 + floor(u_mouse.x*8.0 + 0.5);
  float rot = u_time*0.07 + (u_mouse.y - 0.5)*2.6;
  a += rot;
  float sector = 6.28318530718/folds;
  a = mod(a, sector);
  a = abs(a - sector*0.5);

  vec2 q = r*vec2(cos(a), sin(a));

  // layered pattern inside one mirror wedge
  float n  = fbm(q*3.0 + vec2(u_time*0.05, -u_time*0.04));
  float n2 = fbm(q*7.0 + n - u_time*0.07);
  float rings = 0.5 + 0.5*sin(r*22.0 - u_time*0.55 + n*4.0);
  float v = n*0.6 + n2*0.5 + rings*0.25;

  vec3 col = palette(v + r*0.35,
    vec3(0.36,0.20,0.30), vec3(0.40,0.30,0.28),
    vec3(1.0,1.0,1.0),    vec3(0.00,0.22,0.45));
  col *= 0.45 + 0.55*rings;

  // sharp gem facets: bright seams where the pattern folds
  float seam = exp(-abs(a - sector*0.5)*26.0) + exp(-a*26.0);
  col += vec3(0.9,0.75,0.55) * seam * 0.10 * (1.0 + u_speed);

  // click bloom rolling outward
  float bloom = u_click * exp(-pow(r - u_clickTime*0.9, 2.0)*40.0);
  col += vec3(1.0,0.85,0.60) * bloom * 0.9;

  // richer gems: push saturation, pull overall gain down
  col = mix(vec3(dot(col, vec3(0.299,0.587,0.114))), col, 1.45);
  col *= 0.74;

  // seat it: dark core, soft edge fade
  col *= 0.30 + 0.70*smoothstep(0.015, 0.14, r);
  col *= 1.0 - r*0.38;

  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'kaleido', name: 'Kaleido',
    hint: 'Slide to fold the mirrors · click to bloom',
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
