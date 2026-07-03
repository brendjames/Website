// wp-storm.js — electric storm. Lightning arcs down from the clouds to the
// cursor, re-forking several times a second; fast movement makes the arcs
// crackle harder; a click discharges every bolt at once with a sky-wide flash.
window.WP = window.WP || {};
window.WP.storm = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
// Glow of one jagged arc from a to b. seed varies the fork; amp its wildness.
float bolt(vec2 p, vec2 a, vec2 b, float seed, float amp){
  vec2 ab = b - a;
  float len = max(length(ab), 1e-3);
  vec2 dir = ab/len;
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 ap = p - a;
  float along = dot(ap, dir);
  float s = clamp(along/len, 0.0, 1.0);
  float o = dot(ap, nrm);

  float tq = floor(u_time*14.0)*0.37 + seed*11.0;   // re-fork ~14x a second
  float env = sin(s*3.14159);                       // pinned at both ends
  float disp = (fbm(vec2(s*5.0 + tq, tq)) - 0.5)*2.0
             + (fbm(vec2(s*16.0 - tq*1.3, tq*0.7)) - 0.5)*0.55;
  disp *= amp * env * len;

  // Cap the arc at its endpoints so it stops at the strike point.
  float over = max(max(-along, along - len), 0.0);
  float dist = length(vec2(o - disp, over));
  float core = exp(-pow(dist*150.0, 2.0));
  float glow = exp(-dist*22.0);
  return core*1.3 + glow*0.32;
}
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = v_uv; p.x*=asp;
  vec2 m = u_mouse; m.x*=asp;

  float tq = floor(u_time*14.0);
  float discharge = u_click * exp(-u_clickTime*2.2);
  float amp = 0.10 + u_speed*0.05 + discharge*0.05;

  // Storm-cloud ceiling.
  float cloud = fbm(vec2(p.x*1.6 + u_time*0.03, p.y*2.2 - u_time*0.015));
  vec3 col = mix(vec3(0.012,0.020,0.038), vec3(0.045,0.065,0.10),
                 smoothstep(0.35, 1.0, v_uv.y)*cloud);

  // Three bolts from jittering points in the clouds down to the cursor.
  float light = 0.0;
  for(int i=0;i<3;i++){
    float fi = float(i);
    float ax = (0.15 + 0.7*hash1(vec2(tq, fi*5.0+1.0))) * asp;
    vec2 a = vec2(ax, 1.04);
    float on = step(0.45 - discharge, hash1(vec2(tq, fi*13.0+7.0)));  // flicker
    float strength = max(on * (0.45 + 0.55*hash1(vec2(tq, fi))), discharge);
    light += bolt(p, a, m, fi*3.1, amp) * strength;
  }

  vec3 arc = vec3(0.55,0.75,1.0)*light + vec3(0.9,0.96,1.0)*pow(light, 3.0)*0.6;
  col += arc;

  // The strike point glows; the whole sky flashes on discharge.
  float md = length(p - m);
  col += vec3(0.35,0.62,0.95) * exp(-md*14.0) * (0.5 + light*0.8 + discharge*1.5);
  col += vec3(0.30,0.42,0.62) * discharge * (0.25 + cloud*0.5);

  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'storm', name: 'Storm',
    hint: 'Draw the lightning to you · click to discharge the sky',
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
