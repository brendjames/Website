// wp-ember.js — open fire. A bed of flame burns along the bottom and a plume
// rises wherever the cursor sits; fast movement fans the flames brighter;
// a click throws a ring of heat and a burst of sparks. Warm palette:
// charcoal, ember red, orange, white-hot.
window.WP = window.WP || {};
window.WP.ember = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = v_uv; p.x*=asp;
  vec2 m = u_mouse; m.x*=asp;
  float t = u_time;

  float fan = 1.0 + u_speed*0.9;                 // moving fans the flames

  // Rising turbulence, warped by a second noise pass.
  vec2 q = vec2(p.x*3.2, p.y*3.4 - t*1.35);
  float n = fbm(q + vec2(fbm(q*1.6 + t*0.25), 0.0)*1.1);

  // Heat: a bed along the bottom, a pocket + rising column at the cursor,
  // and an expanding ring on click.
  vec2 toM = p - m;
  float above = max(p.y - m.y, 0.0);
  float bed    = smoothstep(0.34, -0.10, v_uv.y) * 0.85;
  float pocket = 1.1*exp(-dot(toM,toM)*12.0);
  float column = 0.55*exp(-toM.x*toM.x*22.0) * exp(-above*2.6);
  vec2 tc = p - vec2(u_clickPos.x*asp, u_clickPos.y);
  float ring = 1.4*u_click * exp(-pow(length(tc) - u_clickTime*1.3, 2.0)*26.0);
  float heat = bed + pocket + column + ring;

  float f = min(max(n*heat*fan - 0.22, 0.0), 1.3);

  // Fire ramp: charcoal -> ember red -> orange -> white-hot.
  vec3 col = vec3(0.020, 0.010, 0.012);
  col += vec3(0.98, 0.28, 0.05) * f;
  col += vec3(1.05, 0.70, 0.12) * f*f * 0.45;
  col += vec3(1.00, 0.94, 0.75) * pow(f, 4.0) * 0.12;

  // Sparks drifting up out of the hot zones.
  float sparkAmt = 0.5 + u_speed + u_click*2.2;
  vec2 sg = vec2(p.x*24.0 + sin(p.y*6.0 + t)*0.6, p.y*24.0 - t*4.5);
  vec2 sid = floor(sg);
  vec2 sf = fract(sg) - 0.5;
  float sr = hash1(sid);
  float tw = 0.5 + 0.5*sin(t*7.0 + sr*44.0);
  float spark = step(0.955, sr) * exp(-dot(sf,sf)*22.0) * tw;
  spark *= smoothstep(0.15, 0.8, heat*0.5);      // sparks live where it's hot
  col += vec3(1.0, 0.62, 0.18) * spark * sparkAmt;

  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'ember', name: 'Ember',
    hint: 'Stoke the fire · click to throw a burst of sparks',
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
