// wp-topo.js — a living topographic map. Contour lines in copper and gold
// trace slowly drifting terrain; a hill rises wherever the cursor rests and
// the contours bunch tight around it; a click lifts a sudden peak that
// subsides again. Palette: espresso dark, copper, gold.
window.WP = window.WP || {};
window.WP.topo = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
float height(vec2 p, vec2 m, vec2 c){
  float h = fbm(p*1.7 + vec2(u_time*0.030, u_time*0.021));
  h += 0.50*exp(-dot(p-m,p-m)*7.0);            // hill under the cursor
  h += 0.60*u_click*exp(-dot(p-c,p-c)*9.0);    // click peak, subsides with u_click
  return h;
}
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = (v_uv-0.5)*1.6; p.x*=asp;
  vec2 m = (u_mouse-0.5)*1.6; m.x*=asp;
  vec2 c = (u_clickPos-0.5)*1.6; c.x*=asp;

  float h = height(p, m, c);

  // hillshade from finite differences, lit from the north-west
  float e = 0.02;
  float hx = height(p + vec2(e, 0.0), m, c);
  float hy = height(p + vec2(0.0, e), m, c);
  float light = clamp(0.62 + ((h - hx) + (hy - h)*0.7)*9.0, 0.35, 1.25);

  // contour lines, index line every 5th
  float L = 15.0;
  float lev = h*L;
  float f = fract(lev);
  float w = fwidth(lev)*1.3;
  float line = smoothstep(w*2.4, 0.0, min(f, 1.0 - f));
  float isMajor = 1.0 - step(0.5, mod(floor(lev), 5.0));

  vec3 base = mix(vec3(0.050, 0.034, 0.026), vec3(0.115, 0.078, 0.052), clamp(h*0.6, 0.0, 1.0));
  base *= light;

  vec3 lineCol = mix(vec3(0.66, 0.40, 0.20), vec3(1.0, 0.80, 0.42), clamp(h*0.8, 0.0, 1.0));
  vec3 col = base + lineCol * line * (0.30 + 0.70*isMajor) * (0.75 + u_speed*0.6);

  // warm survey light around the cursor
  col += vec3(0.55, 0.32, 0.12) * exp(-dot(p-m,p-m)*5.0) * 0.10;

  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'topo', name: 'Topo',
    hint: 'Raise the terrain · click to lift a peak',
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
