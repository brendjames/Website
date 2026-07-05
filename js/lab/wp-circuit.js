// wp-circuit.js — a living circuit board in the site's brand colours: copper
// Truchet traces on dark board, gold pads at the junctions, and cyber-lime
// pulses running the lines. Traces power up around the cursor; a click sends
// a surge rippling across the whole board.
window.WP = window.WP || {};
window.WP.circuit = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = v_uv; p.x*=asp;
  vec2 mp = u_mouse; mp.x*=asp;
  vec2 clp = u_clickPos; clp.x*=asp;

  float scale = 13.0;
  vec2 g = p*scale;
  vec2 id = floor(g);
  vec2 f = fract(g);

  // Truchet diagonals: each cell carries one of two 45-degree traces
  float o = step(0.5, hash1(id));
  float dA = abs(f.x - f.y)*0.7071;
  float dB = abs(f.x + f.y - 1.0)*0.7071;
  float d = mix(dB, dA, o);
  float s = mix((f.x + 1.0 - f.y)*0.5, (f.x + f.y)*0.5, o);   // param along trace
  float line = smoothstep(0.050, 0.020, d);

  // solder pads where traces meet cell corners
  vec2 q = abs(f - 0.5);
  float cornerD = length(vec2(0.5) - q);
  float pad = smoothstep(0.150, 0.095, cornerD) * smoothstep(0.040, 0.070, cornerD);

  // power: cursor proximity + click surge ring, evaluated per-cell
  vec2 cw = (id + 0.5)/scale;
  float power = exp(-length(cw - mp)*3.6) * (0.7 + u_speed*0.9);
  float ring = u_click * exp(-pow(length(cw - clp) - u_clickTime*1.1, 2.0)*26.0);
  power += ring*1.6;

  // pulses: glints that run the traces, faster where powered
  float dir = sign(hash1(id + 7.3) - 0.5);
  float ph = fract(s*dir + u_time*(0.22 + power*0.55) + hash1(id + 3.1)*7.0);
  float glint = exp(-pow(ph - 0.5, 2.0)*110.0) * line;

  vec3 col = vec3(0.040, 0.048, 0.032);                       // board
  col += vec3(0.02, 0.03, 0.02) * fbm(p*2.2 + 4.0);           // faint substrate mottle
  col += vec3(0.55, 0.33, 0.16) * line * (0.30 + power*0.55); // copper trace
  col += vec3(0.80, 0.60, 0.25) * pad * (0.35 + power*0.9);   // gold pads
  col += vec3(0.72, 0.94, 0.35) * glint * (0.55 + power*2.0); // lime pulse
  col += vec3(0.72, 0.94, 0.35) * ring * line * 1.4;          // surge front

  // vignette
  vec2 vq = v_uv - 0.5; vq.x *= asp;
  col *= 1.0 - dot(vq,vq)*0.45;

  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'circuit', name: 'Circuit',
    hint: 'Power the traces · click to surge the board',
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
