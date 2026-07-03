// wp-aurora.js — northern lights. Curtains of light lean toward the cursor and
// brighten near it; fast movement adds shimmer; a click sends a surge climbing
// up the curtains from where it lands.
window.WP = window.WP || {};
window.WP.aurora = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = v_uv;
  vec2 m = u_mouse;
  float t = u_time*0.1;

  // Columns near the cursor lean toward it, more with height and cursor speed.
  float dx = m.x - p.x;
  float lean = dx * exp(-dx*dx*7.0) * (0.6 + u_speed*1.6);
  float x = (p.x + lean*(0.35 + 0.65*p.y)) * 3.0 * asp;

  // Click surge: a band of energy that climbs the curtains.
  float surgeY = u_clickTime*0.9;
  float surge = u_click
    * exp(-pow(p.y - surgeY, 2.0)*26.0)
    * exp(-pow((p.x - u_clickPos.x)*asp, 2.0)*4.5);

  vec3 col = vec3(0.010, 0.020, 0.042);            // night-sky base

  // Three drifting curtain layers.
  for(int i=0;i<3;i++){
    float fi = float(i);
    float n = fbm(vec2(x*(1.0+fi*0.7) + fi*17.0 + t*(1.0+fi*0.35),
                       p.y*0.5 - t*0.7));
    float ray  = pow(clamp(n*1.35-0.25, 0.0, 1.0), 3.0);
    float band = smoothstep(0.02, 0.30, p.y) * smoothstep(1.10, 0.50, p.y);
    float flick = 0.75 + 0.25*sin(u_time*1.4 + fi*2.1 + x*2.0);
    float glow = ray * band * flick;
    vec3 tint = mix(vec3(0.05,0.45,0.50), vec3(0.30,0.85,0.48),
                    clamp(p.y*1.3 - 0.15 + n*0.4, 0.0, 1.0));
    tint = mix(tint, vec3(0.72,0.94,0.42),          // cyber-lime crowns
               pow(clamp(p.y + n*0.2, 0.0, 1.0), 3.0)*0.5);
    col += tint * glow * (0.85 + surge*2.4) * (0.9 - fi*0.18);
  }

  // Soft brightening around the cursor.
  vec2 pm = p - m; pm.x *= asp;
  col *= 1.0 + exp(-dot(pm,pm)*6.0)*0.55;

  // Twinkling stars in the upper sky.
  vec2 sg = v_uv*vec2(140.0*asp, 140.0);
  vec2 sid = floor(sg);
  vec2 sf = fract(sg) - 0.5;
  float sr = hash1(sid);
  float star = step(0.994, sr) * exp(-dot(sf,sf)*26.0);
  float tw = 0.5 + 0.5*sin(u_time*(1.0+fract(sr*13.0)*3.0) + sr*40.0);
  col += vec3(0.7,0.85,1.0) * star * tw * smoothstep(0.35, 0.9, p.y) * 0.5;

  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'aurora', name: 'Aurora',
    hint: 'Bend the curtains of light · click for a solar surge',
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
