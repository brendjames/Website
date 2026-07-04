// wp-rain.js — rain on a window at night. Drops run down the glass over warm
// out-of-focus city lights; the cursor wipes a patch of glass clear; a click
// rings the pane and clears a travelling circle. Palette: sodium amber,
// brake-light red, traffic green, neon violet.
window.WP = window.WP || {};
window.WP.rain = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
vec3 lamp(float r){
  float s = fract(r*5.7)*4.0;
  if (s < 1.7) return vec3(1.00,0.55,0.16);   // sodium amber
  if (s < 2.6) return vec3(0.95,0.22,0.18);   // brake red
  if (s < 3.3) return vec3(0.55,0.90,0.35);   // traffic green
  return vec3(0.75,0.35,0.85);                // neon violet
}
vec3 bokeh(vec2 uv, float blur){
  float asp = u_res.x/u_res.y;
  vec3 col = mix(vec3(0.055,0.032,0.028), vec3(0.016,0.012,0.022), uv.y);
  for (int i=0;i<14;i++){
    float fi = float(i);
    vec2 rnd = hash2(vec2(fi*7.3+2.0, fi*3.1+9.0));
    vec2 c = vec2(fract(rnd.x + fi*0.161)*asp, 0.08 + 0.72*rnd.y);
    vec2 q = vec2(uv.x*asp, uv.y) - c;
    float rad = (0.015 + 0.05*fract(rnd.y*7.0)) * (0.7 + blur*1.2);
    float soft = mix(0.006, 0.13, blur);
    float glow = smoothstep(rad+soft, max(rad-soft, 0.0), length(q));
    float tw = 0.75 + 0.25*sin(u_time*(0.5+rnd.x) + fi*9.0);
    col += lamp(rnd.x) * glow * tw * (0.30 + 0.45*rnd.y);
  }
  return col;
}
// One layer of drops running down the pane. Adds refraction, returns wetness.
float drops(vec2 uv, vec2 grid, float speed, inout vec2 refr){
  float asp = u_res.x/u_res.y;
  vec2 g = vec2(uv.x*asp, uv.y) * grid;
  vec2 id = floor(g);
  float rnd = hash1(id);
  vec2 f = fract(g);
  float m = 0.0;
  if (rnd > 0.30) {
    float dpy = 1.0 - fract(u_time*speed*(0.5+rnd*0.7) + rnd*9.0);
    vec2 dp = vec2(0.5 + 0.28*sin(u_time*1.1 + rnd*40.0), dpy);
    vec2 d = (f - dp) * vec2(1.2, 0.85);
    float dl = length(d);
    m = smoothstep(0.15, 0.10, dl);
    // thin wobbling streak above the drop
    float streak = smoothstep(0.055, 0.015,
        abs(f.x - dp.x - 0.05*sin((f.y - dp.y)*11.0 + rnd*20.0)))
      * step(dp.y, f.y) * exp(-(f.y - dp.y)*2.4) * 0.55;
    m = max(m, streak);
    refr += (f - dp) * m * 0.55;
  }
  return m;
}
// Static micro-droplets misted over the whole pane.
float micro(vec2 uv, inout vec2 refr){
  float asp = u_res.x/u_res.y;
  vec2 g = vec2(uv.x*asp, uv.y) * 64.0;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  vec2 rnd = hash2(id);
  vec2 off = (rnd - 0.5)*0.5;
  float r = 0.06 + 0.11*fract(rnd.x*13.0);
  float m = smoothstep(r, r*0.55, length(f - off)) * step(0.55, rnd.y);
  refr += (f - off) * m * 0.20;
  return m;
}
void main(){
  float asp = u_res.x/u_res.y;
  vec2 uv = v_uv;

  // cursor wipes the glass; a click sends a clearing ring across it
  vec2 cm = vec2((uv.x - u_mouse.x)*asp, uv.y - u_mouse.y);
  float cd = length(cm);
  float wipe = exp(-cd*cd*9.0);
  float ring = u_click * exp(-pow(cd - u_clickTime*0.7, 2.0)*50.0);
  float clarity = clamp(wipe + ring, 0.0, 1.0);
  float wet = 1.0 - clarity*0.9;

  vec2 refr = vec2(0.0);
  float dm = 0.0;
  dm += drops(uv, vec2(10.0, 6.0), 0.20, refr);
  dm += drops(uv + vec2(0.37, 0.16), vec2(19.0, 11.5), 0.29, refr)*0.8;
  dm *= wet;
  float mm = micro(uv, refr) * wet;
  refr *= wet;

  float blur = mix(0.85, 0.10, clarity);          // fogged glass, wiped clear
  blur = mix(blur, 0.06, clamp(dm*1.3, 0.0, 1.0)); // drops focus the lights

  vec3 col = bokeh(uv + refr*0.14 + vec2(0.0, mm*0.02), blur);

  // glints on the drops
  col += vec3(1.0,0.92,0.80) * pow(clamp(dm, 0.0, 1.0), 3.0) * 0.28;
  col += vec3(0.9,0.85,0.8) * mm * 0.03;

  // condensation veil outside the wiped area
  col = mix(col, col*0.55 + vec3(0.045,0.032,0.036), (1.0 - clarity)*0.38);

  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'rain', name: 'Rain',
    hint: 'Wipe the glass clear · click to ring the pane',
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
