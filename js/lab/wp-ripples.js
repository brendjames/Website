// wp-ripples.js — real water height-field simulation. The mouse drags the surface;
// a click drops a stone. Chrome/cyan refraction + specular over a slate gradient.
window.WP = window.WP || {};
window.WP.ripples = (function () {
  const E = () => window.Engine;

  const SIM_FRAG = Engine.FRAG_HEADER + `
uniform sampler2D u_state;
uniform vec2  u_texel;
uniform float u_down;     // 1 while pointer is pressed -> heavier drag
void main(){
  vec2 uv = v_uv;
  vec4 s  = texture(u_state, uv);
  float h    = s.r;          // current height
  float prev = s.g;          // height one step ago
  float l = texture(u_state, uv - vec2(u_texel.x,0.0)).r;
  float r = texture(u_state, uv + vec2(u_texel.x,0.0)).r;
  float u = texture(u_state, uv + vec2(0.0,u_texel.y)).r;
  float d = texture(u_state, uv - vec2(0.0,u_texel.y)).r;

  // Classic wave propagation.
  float nh = (l + r + u + d) * 0.5 - prev;
  nh *= 0.9915;             // damping

  vec2 asp = vec2(u_res.x/u_res.y, 1.0);
  vec2 p = uv * asp;

  // Disturbance along the segment the cursor traversed this frame.
  vec2 a = u_pmouse*asp, b = u_mouse*asp;
  vec2 pa = p - a, ba = b - a;
  float t = clamp(dot(pa,ba)/max(dot(ba,ba),1e-5), 0.0, 1.0);
  float segd = length(pa - ba*t);
  float amp = clamp(u_speed, 0.0, 1.4) * (0.10 + 0.12*u_down);
  nh -= exp(-segd*segd*2200.0) * amp;

  // Click = a fat impulse drop.
  float cd = length(p - u_clickPos*asp);
  nh -= exp(-cd*cd*1100.0) * u_click * 0.85;

  nh = clamp(nh, -1.2, 1.2);
  frag = vec4(nh, h, 0.0, 1.0);
}`;

  const DISP_FRAG = Engine.FRAG_HEADER + `
uniform sampler2D u_state;
uniform vec2 u_texel;

vec3 bg(vec2 uv, vec3 n){
  vec3 top = vec3(0.17,0.22,0.30);   // slate
  vec3 bot = vec3(0.02,0.05,0.10);   // deep blue
  vec3 g = mix(bot, top, smoothstep(0.0,1.0,uv.y));
  // reflected cyan sky band
  float band = smoothstep(0.15,0.95, n.y*0.5+0.5);
  g += vec3(0.0,0.20,0.34) * band * 0.55;
  // cool cursor glow
  vec2 asp = vec2(u_res.x/u_res.y,1.0);
  float gl = exp(-length((uv-u_mouse)*asp)*3.2);
  g += vec3(0.10,0.42,0.62) * gl * 0.35;
  return g;
}
void main(){
  vec2 uv = v_uv;
  float hL = texture(u_state, uv - vec2(u_texel.x,0.0)).r;
  float hR = texture(u_state, uv + vec2(u_texel.x,0.0)).r;
  float hU = texture(u_state, uv + vec2(0.0,u_texel.y)).r;
  float hD = texture(u_state, uv - vec2(0.0,u_texel.y)).r;
  float S = 7.0;
  vec3 n = normalize(vec3((hL-hR)*S, (hD-hU)*S, 1.0));

  vec2 ruv = uv + n.xy * 0.05;       // refraction
  vec3 base = bg(ruv, n);

  vec3 L = normalize(vec3(-0.45,0.55,0.70));
  vec3 V = vec3(0.0,0.0,1.0);
  vec3 H = normalize(L+V);
  float spec = pow(max(dot(n,H),0.0), 110.0);
  float fres = pow(1.0 - n.z, 3.0);

  vec3 col = base
    + spec * vec3(0.85,0.96,1.0) * 1.3
    + fres * vec3(0.18,0.46,0.66);

  frag = vec4(col, 1.0);
}`;

  let sim, simProg, dispProg, sw, sh;
  function simSize(env) {
    const maxDim = 1100;
    let w = Math.round(env.W * 0.6), h = Math.round(env.H * 0.6);
    const s = Math.min(1, maxDim / Math.max(w, h));
    return [Math.max(2, Math.round(w * s)), Math.max(2, Math.round(h * s))];
  }

  return {
    id: 'ripple', name: 'Ripple',
    hint: 'Drag to push the water · click to drop a stone',
    setup(env) {
      const gl = env.gl;
      simProg = new (E().Program)(gl, E().QUAD_VERT, SIM_FRAG);
      dispProg = new (E().Program)(gl, E().QUAD_VERT, DISP_FRAG);
      [sw, sh] = simSize(env);
      sim = new (E().PingPong)(gl, sw, sh, gl.LINEAR);
    },
    resize(env) {
      [sw, sh] = simSize(env);
      if (sim) sim.resize(sw, sh);
    },
    render(env) {
      const gl = env.gl, texel = [1 / sw, 1 / sh];
      // Two simulation substeps for livelier propagation.
      for (let i = 0; i < 2; i++) {
        E().target(gl, sim.write);
        simProg.use();
        E().setCommon(simProg, env);
        simProg.set('u_texel', texel)
          .set('u_down', env.input.down ? 1 : 0)
          .tex('u_state', sim.read.tex);
        env.quad.draw();
        sim.swap();
      }
      // Display.
      E().screen(gl, env.W, env.H);
      dispProg.use();
      E().setCommon(dispProg, env);
      dispProg.set('u_texel', texel).tex('u_state', sim.read.tex);
      env.quad.draw();
    },
    dispose(env) {
      if (sim) sim.dispose();
      if (simProg) simProg.dispose();
      if (dispProg) dispProg.dispose();
      sim = simProg = dispProg = null;
    },
  };
})();
