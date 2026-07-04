// wp-ink.js — ink in water. A two-field fluid: a velocity field advects itself
// and a dye field; dragging stirs the water and feeds ink along the stroke;
// a click bursts a drop outward. The ink colour drifts around the wheel over
// time, so no two minutes look alike.
window.WP = window.WP || {};
window.WP.ink = (function () {
  const E = () => window.Engine;

  const VEL_FRAG = Engine.FRAG_HEADER + `
uniform sampler2D u_velTex;
uniform float u_dt;
void main(){
  vec2 asp = vec2(u_res.x/u_res.y, 1.0);
  vec2 uv = v_uv;
  vec2 vel = texture(u_velTex, uv).xy;
  vec2 v = texture(u_velTex, uv - vel*u_dt).xy;   // self-advection

  // ambient swirl so the ink never fully stalls
  vec2 pp = uv*asp*2.5;
  v += vec2(vnoise(pp + u_time*0.08) - 0.5,
            vnoise(pp + 37.7 - u_time*0.07) - 0.5) * 0.35 * u_dt;

  // stir along the cursor's drag segment
  vec2 a = u_pmouse*asp, b = u_mouse*asp, P = uv*asp;
  vec2 ba = b - a, pa = P - a;
  float h = clamp(dot(pa,ba)/max(dot(ba,ba), 1e-6), 0.0, 1.0);
  float sd = length(pa - ba*h);
  v += (u_vel/max(u_dt, 1e-3)) * exp(-sd*sd*350.0) * 0.55;

  // click: radial burst
  vec2 rc = P - u_clickPos*asp;
  float rl = max(length(rc), 1e-4);
  v += (rc/rl) * u_click * exp(-rl*rl*30.0) * 1.4;

  v *= 0.986;                                     // friction
  frag = vec4(clamp(v, vec2(-3.0), vec2(3.0)), 0.0, 1.0);
}`;

  const DYE_FRAG = Engine.FRAG_HEADER + `
uniform sampler2D u_dyeTex;
uniform sampler2D u_velTex;
uniform float u_dt;
void main(){
  vec2 asp = vec2(u_res.x/u_res.y, 1.0);
  vec2 uv = v_uv;
  vec2 vel = texture(u_velTex, uv).xy;
  vec3 dye = texture(u_dyeTex, uv - vel*u_dt).rgb;
  dye *= 0.992;                                   // slow fade

  // ink seeps from the cursor constantly and pours when it moves,
  // colour cycling around the wheel
  vec2 a = u_pmouse*asp, b = u_mouse*asp, P = uv*asp;
  vec2 ba = b - a, pa = P - a;
  float h = clamp(dot(pa,ba)/max(dot(ba,ba), 1e-6), 0.0, 1.0);
  float sd = length(pa - ba*h);
  vec3 inkCol = 0.55 + 0.45*cos(6.2831*(u_time*0.03 + vec3(0.0, 0.33, 0.67)));
  dye += inkCol * (0.08 + clamp(u_speed*1.3, 0.0, 1.0)) * exp(-sd*sd*700.0);

  // click drops a fat blob of the complementary colour
  vec2 rc = P - u_clickPos*asp;
  dye += inkCol.bgr * u_click * exp(-dot(rc,rc)*160.0) * 0.9;

  frag = vec4(clamp(dye, 0.0, 2.0), 1.0);
}`;

  const SHOW_FRAG = Engine.FRAG_HEADER + `
uniform sampler2D u_dyeTex;
void main(){
  vec3 dye = texture(u_dyeTex, v_uv).rgb;
  vec3 col = vec3(0.012, 0.012, 0.020) + dye;
  vec2 q = v_uv - 0.5; q.x *= u_res.x/u_res.y;
  col *= 1.0 - dot(q,q)*0.35;                     // gentle vignette
  frag = vec4(col, 1.0);
}`;

  let velProg, dyeProg, showProg, vel, dye, sw, sh;
  function simSize(env) {
    const maxDim = 1024;
    const w = Math.round(env.W * 0.5), h = Math.round(env.H * 0.5);
    const s = Math.min(1, maxDim / Math.max(w, h));
    return [Math.max(2, Math.round(w * s)), Math.max(2, Math.round(h * s))];
  }

  return {
    id: 'ink', name: 'Ink',
    hint: 'Stir the water · click to burst a drop of ink',
    setup(env) {
      const gl = env.gl;
      velProg = new (E().Program)(gl, E().QUAD_VERT, VEL_FRAG);
      dyeProg = new (E().Program)(gl, E().QUAD_VERT, DYE_FRAG);
      showProg = new (E().Program)(gl, E().QUAD_VERT, SHOW_FRAG);
      [sw, sh] = simSize(env);
      vel = new (E().PingPong)(gl, sw, sh, gl.LINEAR);
      dye = new (E().PingPong)(gl, sw, sh, gl.LINEAR);
    },
    resize(env) {
      [sw, sh] = simSize(env);
      if (vel) vel.resize(sw, sh);
      if (dye) dye.resize(sw, sh);
    },
    render(env) {
      const gl = env.gl;
      const dt = Math.min(env.dt || 0.016, 0.033);

      E().target(gl, vel.write);
      velProg.use(); E().setCommon(velProg, env);
      velProg.set('u_dt', dt).tex('u_velTex', vel.read.tex);
      env.quad.draw(); vel.swap();

      E().target(gl, dye.write);
      dyeProg.use(); E().setCommon(dyeProg, env);
      dyeProg.set('u_dt', dt).tex('u_dyeTex', dye.read.tex).tex('u_velTex', vel.read.tex);
      env.quad.draw(); dye.swap();

      E().screen(gl, env.W, env.H);
      showProg.use(); E().setCommon(showProg, env);
      showProg.tex('u_dyeTex', dye.read.tex);
      env.quad.draw();
    },
    dispose(env) {
      if (vel) vel.dispose();
      if (dye) dye.dispose();
      if (velProg) velProg.dispose();
      if (dyeProg) dyeProg.dispose();
      if (showProg) showProg.dispose();
      vel = dye = velProg = dyeProg = showProg = null;
    },
  };
})();
