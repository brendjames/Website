// wp-synth.js — synthwave sunset. A striped retro sun hangs over a neon grid
// that scrolls toward the viewer. The cursor drags the sun across the sky and
// lifts the horizon; speed brightens the grid; a click flares the sun and
// rolls a pulse down the gridlines. Palette: magenta, violet, hot pink, gold.
window.WP = window.WP || {};
window.WP.synth = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = v_uv;
  float t = u_time;

  float horizon = 0.42 + (u_mouse.y-0.5)*0.10;   // cursor lifts the view a little
  float sunX = 0.5 + (u_mouse.x-0.5)*0.55;
  float flare = u_click * exp(-u_clickTime*2.0);

  vec3 col;
  if (p.y > horizon) {
    // ---- sky ----
    float sy = (p.y - horizon)/(1.0 - horizon);
    col = mix(vec3(0.42,0.06,0.32), vec3(0.05,0.02,0.13), smoothstep(0.0, 0.85, sy));

    // Striped sun, gaps widening toward the horizon.
    vec2 sp = vec2((p.x - sunX)*asp, p.y - horizon - 0.17);
    float sd = length(sp);
    float sunR = 0.14 + flare*0.02;
    float sun = smoothstep(sunR, sunR-0.005, sd);
    float cutY = p.y - horizon;
    float gap = smoothstep(0.30, 0.02, cutY);
    float stripes = 0.5 + 0.5*sin(cutY*150.0 - t*1.5);
    sun *= 1.0 - gap * smoothstep(0.35, 0.65, stripes);
    vec3 sunCol = mix(vec3(1.0,0.25,0.45), vec3(1.0,0.85,0.25),
                      smoothstep(0.0, 0.30, cutY));
    col = mix(col, sunCol, sun);
    col += sunCol * exp(-max(sd-sunR, 0.0)*9.0) * (0.35 + flare*0.9);

    // Sparse magenta-white stars up top.
    vec2 sg = v_uv*vec2(130.0*asp, 130.0);
    vec2 sf = fract(sg) - 0.5;
    float sr = hash1(floor(sg));
    float star = step(0.995, sr) * exp(-dot(sf,sf)*26.0);
    float tw = 0.5 + 0.5*sin(t*(1.0+fract(sr*13.0)*3.0) + sr*40.0);
    col += vec3(1.0,0.75,0.9) * star * tw * smoothstep(0.25, 0.8, sy) * 0.6;
  } else {
    // ---- neon grid floor ----
    float d = horizon - p.y;
    float z = 1.0/(d + 0.035);
    vec2 gp = vec2((p.x - 0.5)*asp*z*0.9, z*0.55 + t*2.2);
    float fog = exp(-z*0.10);                    // haze toward the horizon

    // Click pulse: a bright band racing from the horizon to the viewer.
    float zPulse = 16.0*exp(-u_clickTime*1.6) + 1.2;
    float band = u_click * exp(-pow(z - zPulse, 2.0)/(zPulse*0.6));

    float lx = abs(fract(gp.x) - 0.5);
    float ly = abs(fract(gp.y) - 0.5);
    float line = exp(-lx*lx*260.0) + exp(-ly*ly*260.0);

    float glowAmt = 0.55 + u_speed*0.9 + band*2.4;
    vec3 lineCol = mix(vec3(0.62,0.22,0.95), vec3(1.0,0.20,0.55), fog); // violet far -> pink near

    col = vec3(0.05,0.015,0.09);
    col += vec3(0.35,0.06,0.28) * exp(-abs(p.x-sunX)*asp*3.0) * fog * 0.8; // sun reflection
    col += lineCol * line * fog * glowAmt;
    col += vec3(1.0,0.35,0.6) * band * fog * 0.25;
  }

  // A click warms the whole frame for a beat.
  col += vec3(0.45,0.12,0.30) * flare * 0.25;

  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'synth', name: 'Synth',
    hint: 'Drag the sun across the sky · click to pulse the grid',
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
