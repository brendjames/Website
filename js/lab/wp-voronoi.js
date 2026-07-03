// wp-voronoi.js — cellular network. Cells near the cursor light up; edges glow with
// cursor speed; a click sends a ring of activation rippling across the lattice.
window.WP = window.WP || {};
window.WP.voronoi = (function () {
  const E = () => window.Engine;

  const FRAG = Engine.FRAG_HEADER + `
void main(){
  float asp = u_res.x/u_res.y;
  vec2 p = v_uv; p.x*=asp;
  float scale = 7.0;
  vec2 g = p*scale;
  vec2 ip = floor(g), fp = fract(g);

  float f1 = 10.0, f2 = 10.0;
  vec2 cId = ip;
  for(int y=-1;y<=1;y++){
    for(int x=-1;x<=1;x++){
      vec2 o = vec2(float(x), float(y));
      vec2 id = ip + o;
      vec2 rnd = hash2(id);
      vec2 cp = o + (0.5 + 0.42*sin(u_time*0.5 + 6.2831*rnd)) - fp;
      float d = dot(cp, cp);
      if(d < f1){ f2 = f1; f1 = d; cId = id; }
      else if(d < f2){ f2 = d; }
    }
  }
  f1 = sqrt(f1); f2 = sqrt(f2);
  float edge = smoothstep(0.0, 0.055, f2 - f1);   // 0 on the borders

  // Approx cell-centre in p-space, for cursor / click distances.
  vec2 cw = (cId + 0.5) / scale;
  vec2 mp = u_mouse; mp.x*=asp;
  float nearCursor = exp(-length(cw-mp)*6.0);

  vec2 clp = u_clickPos; clp.x*=asp;
  float ringR = u_clickTime*0.85;
  float act = u_click * exp(-pow(length(cw-clp) - ringR, 2.0)*11.0);

  float light = nearCursor + act;
  float rnd = hash1(cId);

  vec3 base = mix(vec3(0.05,0.08,0.13), vec3(0.14,0.42,0.58), clamp(light,0.0,1.0));
  base *= 0.82 + 0.40*rnd;
  base += (1.0 - f1) * 0.04;

  vec3 edgeCol = vec3(0.30,0.70,0.95) * (0.35 + u_speed*1.4 + light*1.6);

  vec3 col = mix(edgeCol, base, edge);
  frag = vec4(col, 1.0);
}`;

  let prog;
  return {
    id: 'voronoi', name: 'Cells',
    hint: 'Glide across the lattice · click to fire a pulse',
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
