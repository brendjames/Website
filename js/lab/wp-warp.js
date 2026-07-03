// wp-warp.js — starfield warp tunnel. The vanishing point follows the cursor;
// moving fast stretches the stars into streaks; a click punches the whole field
// to lightspeed with a flash.
window.WP = window.WP || {};
window.WP.warp = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = (v_uv-0.5); p.x*=asp;
  vec2 m = (u_mouse-0.5); m.x*=asp;

  vec2 c = m*0.6;                       // vanishing point trails the cursor
  vec2 d = p - c;
  float r = length(d);
  float a = atan(d.y, d.x);

  float jump  = u_click * exp(-u_clickTime*1.6);       // lightspeed burst
  float boost = 1.0 + u_speed*1.6 + jump*5.0;
  float t = u_time*0.5;

  // Faint nebula backdrop.
  vec3 col = vec3(0.008,0.015,0.030);
  col += vec3(0.03,0.07,0.13) * fbm(p*1.6 + vec2(t*0.05, -t*0.03));

  // Three depth layers of star lanes in log-polar space.
  for(int i=0;i<3;i++){
    float fi = float(i);
    float lanes = 26.0 + fi*18.0;
    float za = a/6.28318530718 + 0.5;
    float lane  = floor(za*lanes);
    float laneF = fract(za*lanes) - 0.5;
    float rnd = hash1(vec2(lane, fi*7.0));
    float flow = fract(log(r + 0.05)*0.9 - t*(0.35 + fi*0.22)*boost - rnd);

    float across = exp(-laneF*laneF*90.0);                    // lane thinness
    float len = 240.0 / (1.0 + u_speed*2.6 + jump*9.0);       // streaks at speed
    float pip = exp(-pow(flow-0.5, 2.0)*len);
    float depth = smoothstep(0.03, 0.35, r);                  // clear the core

    vec3 starCol = mix(vec3(0.30,0.65,1.0), vec3(0.82,0.95,1.0), rnd);
    col += starCol * pip * across * depth * (0.35 + rnd*0.85) * (1.0 - fi*0.22);
  }

  // Engine-core glow at the vanishing point + click flash.
  col += vec3(0.18,0.52,0.90) * exp(-r*4.5) * (0.55 + jump*1.2);
  col += vec3(0.65,0.85,1.0) * jump * 0.30;

  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'warp', name: 'Warp',
    hint: 'Steer the tunnel · click to jump to lightspeed',
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
