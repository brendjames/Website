// wp-plasma.js — flowing energy field. The cursor is an attractor that swirls and
// concentrates the field; speed brightens it; a click flashes an expanding ring.
window.WP = window.WP || {};
window.WP.plasma = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = (v_uv-0.5); p.x*=asp; p*=3.0;
  vec2 m = (u_mouse-0.5); m.x*=asp; m*=3.0;
  vec2 toM = p - m; float md = length(toM);

  // Swirl space around the cursor.
  float ang = atan(toM.y, toM.x);
  float sw  = 1.2 / (md + 0.5);
  vec2 sp = p + vec2(cos(ang+sw), sin(ang+sw)) * 0.6 * exp(-md*0.5);

  float t = u_time*0.6;
  float v = 0.0;
  v += sin(sp.x*1.5 + t);
  v += sin(sp.y*1.7 - t*1.1);
  v += sin((sp.x+sp.y)*1.1 + t*0.7);
  v += 1.5 * fbm(sp*0.8 + t*0.1);
  v += 2.0 * exp(-md*1.2);                                   // concentration at cursor
  v += u_click * exp(-pow(md - u_clickTime*2.2, 2.0)*6.0) * 1.6; // click ring
  v /= 4.0;

  float glow = 0.5 + 0.5*sin(v*3.14159 + t);

  vec3 col = palette(v*0.5 + 0.2,
    vec3(0.04,0.09,0.15), vec3(0.20,0.40,0.55),
    vec3(0.9,0.95,1.0),   vec3(0.30,0.45,0.62));

  col += vec3(0.10,0.50,0.70) * pow(glow,2.0) * (0.55 + u_speed*1.4);
  col += vec3(0.6,0.9,1.0) * exp(-md*3.0) * 0.6;            // hot cursor core
  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'plasma', name: 'Plasma',
    hint: 'Steer the energy · click to detonate a flash',
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
