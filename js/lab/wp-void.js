// wp-void.js — a black hole. It lenses and drags the starfield behind it, an
// amber accretion disk streams around the horizon with a doppler-bright side,
// and a photon ring hugs the shadow. Drag it around the sky; click to feed it
// and watch the disk flare. Palette: black, ember red, amber, white-hot.
window.WP = window.WP || {};
window.WP.void = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = (v_uv-0.5); p.x*=asp;
  vec2 m = (u_mouse-0.5); m.x*=asp;
  float t = u_time;

  float feed = u_click * exp(-u_clickTime*1.4);
  float rs = 0.052 + feed*0.018;                  // the horizon grows when fed

  vec2 d = p - m;
  float r = max(length(d), 1e-4);

  // lensing: compress space toward the horizon, with a frame-dragging swirl
  float warp = max(1.0 - rs*1.9/r, 0.0);
  float swirl = 0.35*rs/r;
  float ca = cos(swirl), sa = sin(swirl);
  vec2 bg = m + mat2(ca,-sa,sa,ca) * d * warp;

  // warm starfield + faint maroon nebula seen through the lens
  vec3 col = vec3(0.012, 0.008, 0.010);
  col += vec3(0.10, 0.045, 0.030) * fbm(bg*1.8 + 5.0);
  for(int i=0;i<2;i++){
    float fi = float(i);
    vec2 sg = bg*(90.0 + fi*70.0) + fi*17.0;
    vec2 sid = floor(sg); vec2 sf = fract(sg) - 0.5;
    float sr = hash1(sid);
    float star = step(0.992, sr) * exp(-dot(sf,sf)*24.0);
    col += mix(vec3(1.0,0.85,0.60), vec3(1.0,0.55,0.32), fract(sr*7.0))
         * star * (0.55 + 0.45*sin(t + sr*40.0)) * 0.8;
  }

  // accretion disk: tangential streaks, doppler-bright on the approaching side
  float ang = atan(d.y, d.x);
  float dr = r/rs;
  float band = smoothstep(1.05, 1.55, dr) * exp(-(dr-1.55)*0.60);
  // blend across the atan wrap so the disk has no seam at ang = +-pi
  float T = t*(0.9 + u_speed*1.4) - log(r)*6.0;
  float snA = fbm(vec2(ang*2.5 + T, dr*3.0));
  float snB = fbm(vec2((ang + 6.28318530718)*2.5 + T, dr*3.0));
  float sn = mix(snB, snA, smoothstep(-3.14159, -2.25, ang));
  float dop = 0.55 + 0.45*sin(ang + 0.6);
  float I = band * (0.30 + 1.0*sn*sn) * dop * (1.0 + feed*2.4);
  vec3 diskCol = mix(vec3(0.55,0.12,0.03), vec3(1.0,0.55,0.15), clamp(sn*1.5, 0.0, 1.0));
  col += diskCol * I;
  col += vec3(1.0,0.90,0.75) * pow(I, 3.0) * 0.35;

  // photon ring, then the shadow swallows everything inside
  col += vec3(1.0,0.82,0.55) * exp(-pow((dr-1.02)*26.0, 2.0)) * (0.85 + feed*1.6);
  col *= smoothstep(0.97, 1.02, dr);

  // feeding flushes the whole neighbourhood warm
  col += vec3(0.50,0.22,0.08) * feed * 0.30 * smoothstep(3.5, 1.0, dr);

  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'void', name: 'Void',
    hint: 'Drag the black hole · click to feed it',
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
