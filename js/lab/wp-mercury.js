// wp-mercury.js — liquid-metal droplets. Blobs drift on orbits but are drawn
// toward the cursor, merging with the droplet it carries; a click makes the
// whole pool shiver. Screen-space gradients give the metal its shading.
window.WP = window.WP || {};
window.WP.mercury = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
float field(vec2 p, vec2 m, out vec2 grad){
  float t = u_time*0.5;
  float shiver = u_click * sin(u_clickTime*26.0) * 0.22;
  float f = 0.0;
  grad = vec2(0.0);
  for(int i=0;i<6;i++){
    float fi = float(i);
    vec2 rnd = hash2(vec2(fi*3.7+1.0, fi*9.1+5.0));
    vec2 c = vec2(sin(t*(0.35+rnd.x*0.40) + rnd.x*6.2831)*0.68,
                  cos(t*(0.45+rnd.y*0.35) + rnd.y*6.2831)*0.46);
    c = mix(c, m, 0.15 + 0.08*sin(t*0.4 + fi*1.7));   // gently drawn to the cursor
    float rad = (0.070 + 0.038*rnd.y) * (1.0 + shiver*(0.6+rnd.x));
    vec2 dd = p - c;
    float d2 = max(dot(dd,dd), 1e-5);
    float w = rad*rad / d2;
    f += w;
    grad += -2.0 * w * dd / d2;
  }
  // The droplet riding the cursor grows a little with speed.
  vec2 dm = p - m;
  float mrad = 0.085 + u_speed*0.035;
  float d2 = max(dot(dm,dm), 1e-5);
  float w = mrad*mrad / d2;
  f += w;
  grad += -2.0 * w * dm / d2;
  return f;
}
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = (v_uv-0.5); p.x*=asp; p*=1.15;
  vec2 m = (u_mouse-0.5); m.x*=asp; m*=1.15;

  vec2 g;
  float f = field(p, m, g);

  // Analytic surface normal; fade the gradient inside so the deep interior
  // reads as a flat pool instead of a spiky 1/d^2 well.
  g *= exp(-max(f - 1.15, 0.0)*3.0);
  vec3 n = normalize(vec3(-g*0.055, 1.0));

  float body = smoothstep(0.98, 1.12, f);            // inside the metal
  float rim  = smoothstep(0.90, 1.02, f) * (1.0 - smoothstep(1.06, 1.50, f));

  // Slate backdrop with a soft pool shadow under the blobs.
  vec3 col = mix(vec3(0.020,0.038,0.066), vec3(0.045,0.075,0.115), v_uv.y);
  col -= vec3(0.012,0.018,0.024) * smoothstep(0.55, 1.0, f);

  // Chrome shading: cool base, sky reflection band, sharp specular.
  vec3 L = normalize(vec3(-0.45, 0.60, 0.66));
  vec3 H = normalize(L + vec3(0.0,0.0,1.0));
  float diff = max(dot(n,L), 0.0);
  float spec = pow(max(dot(n,H), 0.0), 90.0);
  float band = smoothstep(-0.25, 0.75, n.y);

  vec3 metal = vec3(0.055,0.085,0.13)
             + vec3(0.10,0.22,0.34) * diff
             + vec3(0.06,0.28,0.44) * band
             + vec3(0.85,0.96,1.0)  * spec * 1.4;

  col = mix(col, metal, body);
  col += vec3(0.25,0.70,1.0) * rim * (0.35 + u_speed*0.9 + u_click*0.8);
  col += vec3(0.10,0.42,0.62) * exp(-dot(p-m,p-m)*9.0) * 0.30;

  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'mercury', name: 'Mercury',
    hint: 'Herd the droplets · click to make the pool shiver',
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
