// wp-glyphs.js — digital rain. Columns of mutating glyphs fall in phosphor
// green; the stream parts around the cursor like a stone in a river; a click
// fires a glitch wave that tears the columns sideways as it passes.
window.WP = window.WP || {};
window.WP.glyphs = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
// pseudo-glyph: a 3x4 bit pattern per cell that rerolls over time
float glyphBits(vec2 cf, vec2 id, float reroll){
  vec2 gpix = floor(cf * vec2(3.0, 4.0));
  float bit = step(0.42, hash1(id*vec2(3.1,7.7) + gpix*vec2(13.7,5.3) + reroll*0.913));
  vec2 mrg = step(vec2(0.10,0.08), cf) * step(cf, vec2(0.90,0.92));
  return bit * mrg.x * mrg.y;
}
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = v_uv;
  float t = u_time;

  // the stream parts around the cursor
  vec2 dm = vec2((p.x - u_mouse.x)*asp, p.y - u_mouse.y);
  float md = length(dm);
  vec2 push = (dm/max(md,1e-3)) * exp(-md*md*9.0) * 0.05;
  push.x /= asp;
  p += push;

  // click: a glitch wave expands up and down from the click row
  float gw = u_clickTime*1.1;
  float gband = u_click * (exp(-pow(p.y-(u_clickPos.y-gw), 2.0)*280.0)
                         + exp(-pow(p.y-(u_clickPos.y+gw), 2.0)*280.0));
  p.x += (hash1(vec2(floor(p.y*90.0), floor(t*24.0))) - 0.5) * gband * 0.12;

  vec2 grid = vec2(44.0*asp, 28.0);
  vec2 g = p*grid;
  vec2 id = floor(g);
  vec2 cf = fract(g);

  float crnd = hash1(vec2(id.x, 11.0));
  float fall = 0.10 + crnd*0.26;                  // column speed
  float head = fract(crnd*9.0 - t*fall);
  float d = fract(p.y - head);                    // distance above the head
  float L = 0.22 + crnd*0.36;                     // trail length
  float energy = d < L ? pow(1.0 - d/L, 1.8) : 0.0;

  float glyph = glyphBits(cf, id, floor(t*(1.5 + 8.0*energy) + crnd*7.0));

  vec3 green = vec3(0.15, 0.95, 0.35);
  vec3 col = vec3(0.004, 0.012, 0.006);
  col += green * glyph * energy * (0.75 + 0.45*hash1(id));
  col += vec3(0.80, 1.0, 0.85) * glyph * step(d, 0.038) * 0.9;   // white-hot head

  // dim hole + faint rim where the stream parts
  col *= 1.0 - exp(-md*md*12.0)*0.65;
  col += green * exp(-abs(md - 0.17)*26.0) * 0.06;

  // glitch band flashes the glyphs it crosses
  col += vec3(0.75, 1.0, 0.8) * gband * glyph * 0.9;

  // movement lifts the whole stream's brightness; subtle CRT scanlines
  col *= (1.0 + u_speed*0.45) * (0.92 + 0.08*sin(v_uv.y*u_res.y*3.14159));

  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'glyphs', name: 'Glyphs',
    hint: 'Part the code stream · click for a glitch wave',
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
