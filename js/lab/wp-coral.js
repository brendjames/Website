// wp-coral.js — a living culture. Gray-Scott reaction-diffusion grows coral
// patterns in a petri dish: hold and drag to paint culture onto the glass,
// click to drop a seed colony and watch it bloom. Palette: aubergine dish,
// gold structure, magenta growing edges.
window.WP = window.WP || {};
window.WP.coral = (function () {
  const E = () => window.Engine;

  const SIM_FRAG = Engine.FRAG_HEADER + `
uniform sampler2D u_state;
uniform vec2 u_texel;
uniform float u_down;
uniform float u_init;
void main(){
  vec2 uv = v_uv;
  if (u_init > 0.5) {
    // fresh dish: all substrate, a few sparse seed colonies
    float seed = step(0.9982, hash1(floor(uv/u_texel/5.0)));
    frag = vec4(1.0, seed*0.9, 0.0, 1.0);
    return;
  }
  vec2 c = texture(u_state, uv).rg;
  vec2 lap =
      (texture(u_state, uv + vec2( u_texel.x, 0.0)).rg
     + texture(u_state, uv + vec2(-u_texel.x, 0.0)).rg
     + texture(u_state, uv + vec2(0.0,  u_texel.y)).rg
     + texture(u_state, uv + vec2(0.0, -u_texel.y)).rg) * 0.20
    + (texture(u_state, uv + u_texel).rg
     + texture(u_state, uv - u_texel).rg
     + texture(u_state, uv + vec2( u_texel.x, -u_texel.y)).rg
     + texture(u_state, uv + vec2(-u_texel.x,  u_texel.y)).rg) * 0.05
    - c;

  float A = c.r, B = c.g;
  float rxn = A*B*B;
  float f = 0.0545, k = 0.0620;                   // coral-growth regime
  A += 1.00*lap.r - rxn + f*(1.0 - A);
  B += 0.50*lap.g + rxn - (k + f)*B;

  // brush: holding the pointer paints culture along the stroke
  vec2 asp = vec2(u_res.x/u_res.y, 1.0);
  vec2 a = u_pmouse*asp, b = u_mouse*asp, P = uv*asp;
  vec2 ba = b - a, pa = P - a;
  float h = clamp(dot(pa,ba)/max(dot(ba,ba), 1e-6), 0.0, 1.0);
  float sd = length(pa - ba*h);
  B += exp(-sd*sd*4000.0) * u_down * 0.35;

  // click: drop a seed colony
  vec2 rc = P - u_clickPos*asp;
  B += u_click * exp(-dot(rc,rc)*1200.0) * 0.5;

  frag = vec4(clamp(A, 0.0, 1.0), clamp(B, 0.0, 1.0), 0.0, 1.0);
}`;

  const SHOW_FRAG = Engine.FRAG_HEADER + `
uniform sampler2D u_state;
void main(){
  float B = texture(u_state, v_uv).g;
  float grown = smoothstep(0.12, 0.42, B);
  float edge  = smoothstep(0.05, 0.20, B) * (1.0 - smoothstep(0.25, 0.50, B));

  vec3 col = mix(vec3(0.040, 0.014, 0.050), vec3(0.018, 0.008, 0.028), v_uv.y);
  col = mix(col, vec3(0.95, 0.72, 0.22), grown);          // gold structure
  col += vec3(0.85, 0.25, 0.75) * edge * 0.55;            // magenta growth front

  vec2 q = v_uv - u_mouse; q.x *= u_res.x/u_res.y;
  col += vec3(0.40, 0.20, 0.50) * exp(-dot(q,q)*14.0) * 0.12;
  frag = vec4(col, 1.0);
}`;

  const STEPS = 9;
  let simProg, showProg, sim, sw, sh, fresh;

  function simSize(env) {
    const maxDim = 800;
    const w = Math.round(env.W * 0.5), h = Math.round(env.H * 0.5);
    const s = Math.min(1, maxDim / Math.max(w, h));
    return [Math.max(2, Math.round(w * s)), Math.max(2, Math.round(h * s))];
  }

  return {
    id: 'coral', name: 'Coral',
    hint: 'Paint to grow the culture · click to seed a colony',
    setup(env) {
      const gl = env.gl;
      simProg = new (E().Program)(gl, E().QUAD_VERT, SIM_FRAG);
      showProg = new (E().Program)(gl, E().QUAD_VERT, SHOW_FRAG);
      [sw, sh] = simSize(env);
      sim = new (E().PingPong)(gl, sw, sh, gl.LINEAR);
      fresh = true;
    },
    resize(env) {
      [sw, sh] = simSize(env);
      if (sim) { sim.resize(sw, sh); fresh = true; }
    },
    render(env) {
      const gl = env.gl, texel = [1 / sw, 1 / sh];
      for (let i = 0; i < STEPS; i++) {
        E().target(gl, sim.write);
        simProg.use();
        E().setCommon(simProg, env);
        simProg.set('u_texel', texel)
          .set('u_down', env.input.down ? 1 : 0)
          .set('u_init', fresh ? 1 : 0)
          .tex('u_state', sim.read.tex);
        env.quad.draw();
        sim.swap();
        fresh = false;
      }
      E().screen(gl, env.W, env.H);
      showProg.use();
      E().setCommon(showProg, env);
      showProg.tex('u_state', sim.read.tex);
      env.quad.draw();
    },
    dispose(env) {
      if (sim) sim.dispose();
      if (simProg) simProg.dispose();
      if (showProg) showProg.dispose();
      sim = simProg = showProg = null;
    },
  };
})();
