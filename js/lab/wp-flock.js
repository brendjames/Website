// wp-flock.js — a starling murmuration. ~600 boids flock with alignment,
// cohesion and separation; the cursor is a predator they pour around, faster
// movement spooks them harder, and a click is a hawk strike that scatters the
// whole flock. Dusk palette: plum sky, amber-rose birds.
window.WP = window.WP || {};
window.WP.flock = (function () {
  const E = () => window.Engine;
  const N = 620;

  const POINT_VERT = `#version 300 es
in vec2 a_pos;
in float a_spd;
in float a_rnd;
uniform vec2 u_res;
out float v_spd;
out float v_rnd;
void main(){
  vec2 cl = (a_pos / u_res) * 2.0 - 1.0;
  cl.y = -cl.y;
  gl_Position = vec4(cl, 0.0, 1.0);
  gl_PointSize = 1.6 + a_rnd*1.6 + clamp(a_spd*0.10, 0.0, 1.4);
  v_spd = a_spd;
  v_rnd = a_rnd;
}`;

  const POINT_FRAG = `#version 300 es
precision highp float;
in float v_spd;
in float v_rnd;
out vec4 frag;
void main(){
  vec2 c = gl_PointCoord*2.0-1.0;
  float d = dot(c,c);
  if (d > 1.0) discard;
  float a = smoothstep(1.0, 0.0, d);
  vec3 col = mix(vec3(0.85,0.45,0.35), vec3(0.95,0.70,0.40), v_rnd);
  col *= 0.55 + clamp(v_spd*0.10, 0.0, 0.6);
  frag = vec4(col * a, a);
}`;

  const FADE_FRAG = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec4 u_col;
void main(){ frag = u_col; }`;

  const PRESENT_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 frag;
uniform sampler2D u_tex;
uniform vec2 u_res;
void main(){
  vec3 c = texture(u_tex, v_uv).rgb;
  // dusk sky behind the flock
  vec3 sky = mix(vec3(0.16,0.055,0.075), vec3(0.075,0.03,0.085), smoothstep(0.0,1.0,v_uv.y));
  sky += vec3(0.30,0.12,0.05) * exp(-pow((v_uv.y-0.12)*3.2, 2.0)) * 0.5;  // amber horizon
  vec2 q = v_uv - 0.5; q.x *= u_res.x/u_res.y;
  sky *= 1.0 - dot(q,q)*0.4;
  frag = vec4(sky + c, 1.0);
}`;

  let pointProg, fadeProg, presentProg, vao, buf, data, vel, rnd, trail, lastW, lastH;

  function init(W, H) {
    data = new Float32Array(N * 4);   // x, y, spd, rnd
    vel = new Float32Array(N * 2);
    rnd = new Float32Array(N);
    const cx = W * 0.5, cy = H * 0.45, s = Math.min(W, H) * 0.2;
    for (let i = 0; i < N; i++) {
      data[i*4]   = cx + (Math.random() - 0.5) * s * 2;
      data[i*4+1] = cy + (Math.random() - 0.5) * s;
      rnd[i] = Math.random();
      data[i*4+3] = rnd[i];
      const a = Math.random() * 6.283;
      vel[i*2] = Math.cos(a) * 2; vel[i*2+1] = Math.sin(a) * 2;
    }
  }

  return {
    id: 'flock', name: 'Flock',
    hint: 'Fly through the murmuration · click for a hawk strike',
    setup(env) {
      const gl = env.gl;
      pointProg = new (E().Program)(gl, POINT_VERT, POINT_FRAG);
      fadeProg = new (E().Program)(gl, E().QUAD_VERT, FADE_FRAG);
      presentProg = new (E().Program)(gl, E().QUAD_VERT, PRESENT_FRAG);
      init(env.W, env.H);
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const aPos = gl.getAttribLocation(pointProg.p, 'a_pos');
      const aSpd = gl.getAttribLocation(pointProg.p, 'a_spd');
      const aRnd = gl.getAttribLocation(pointProg.p, 'a_rnd');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(aSpd);
      gl.vertexAttribPointer(aSpd, 1, gl.FLOAT, false, 16, 8);
      gl.enableVertexAttribArray(aRnd);
      gl.vertexAttribPointer(aRnd, 1, gl.FLOAT, false, 16, 12);
      gl.bindVertexArray(null);
      trail = E().colorTarget(gl, env.W, env.H, gl.LINEAR);
      lastW = env.W; lastH = env.H;
    },
    resize(env) {
      const gl = env.gl;
      if (trail) E().delTarget(gl, trail);
      trail = E().colorTarget(gl, env.W, env.H, gl.LINEAR);
      const sx = env.W / Math.max(1, lastW), sy = env.H / Math.max(1, lastH);
      for (let i = 0; i < N; i++) { data[i*4] *= sx; data[i*4+1] *= sy; }
      lastW = env.W; lastH = env.H;
    },
    render(env) {
      const gl = env.gl, W = env.W, H = env.H, inp = env.input;
      const mx = inp.mousePx[0], my = inp.mousePx[1];
      const click = inp.click.energy;
      const cx = inp.click.pos[0] * W, cy = (1 - inp.click.pos[1]) * H;
      const scale = Math.min(W, H) / 700;          // keep behaviour resolution-independent
      const R = 62 * scale;                        // neighbour radius
      const maxS = 4.6 * scale, minS = 1.7 * scale;

      // --- spatial binning ---
      const cols = Math.max(1, Math.ceil(W / R)), rows = Math.max(1, Math.ceil(H / R));
      const bins = new Array(cols * rows);
      for (let i = 0; i < N; i++) {
        const bx = Math.min(cols - 1, Math.max(0, (data[i*4] / R) | 0));
        const by = Math.min(rows - 1, Math.max(0, (data[i*4+1] / R) | 0));
        const k = by * cols + bx;
        (bins[k] || (bins[k] = [])).push(i);
      }

      // --- boid rules ---
      for (let i = 0; i < N; i++) {
        const x = data[i*4], y = data[i*4+1];
        let vx = vel[i*2], vy = vel[i*2+1];
        let ax = 0, ay = 0, cxs = 0, cys = 0, alx = 0, aly = 0, cnt = 0;

        const bx = Math.min(cols - 1, Math.max(0, (x / R) | 0));
        const by = Math.min(rows - 1, Math.max(0, (y / R) | 0));
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const nx = bx + ox, ny = by + oy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const bin = bins[ny * cols + nx];
          if (!bin) continue;
          for (let bi = 0; bi < bin.length; bi++) {
            const j = bin[bi];
            if (j === i) continue;
            const dx = data[j*4] - x, dy = data[j*4+1] - y;
            const d2 = dx*dx + dy*dy;
            if (d2 > R*R) continue;
            cnt++;
            cxs += dx; cys += dy;                           // cohesion
            alx += vel[j*2]; aly += vel[j*2+1];             // alignment
            if (d2 < R*R*0.14) {                            // separation
              const d = Math.sqrt(d2) + 0.001;
              ax -= (dx/d) * (R*0.37 - d) * 0.10;
              ay -= (dy/d) * (R*0.37 - d) * 0.10;
            }
          }
        }
        if (cnt > 0) {
          ax += (cxs / cnt) * 0.0045;
          ay += (cys / cnt) * 0.0045;
          ax += ((alx / cnt) - vx) * 0.055;
          ay += ((aly / cnt) - vy) * 0.055;
        }

        // predator cursor: flee, harder when it moves fast
        let dx = x - mx, dy = y - my;
        let d = Math.hypot(dx, dy) + 1;
        const fleeR = 175 * scale * (1 + inp.speed * 0.7);
        if (d < fleeR) {
          const f = (1 - d / fleeR) * (0.55 + inp.speed * 0.9) * scale;
          ax += (dx / d) * f * 1.6;
          ay += (dy / d) * f * 1.6;
        }

        // hawk strike: click scatters everything near it
        if (click > 0.01) {
          let rx = x - cx, ry = y - cy;
          let rd = Math.hypot(rx, ry) + 8;
          const rf = (5200 * scale / rd) * click * 0.05;
          ax += (rx / rd) * rf;
          ay += (ry / rd) * rf;
        }

        // soft bounds + gentle pull to centre keeps the flock on stage
        const mgn = 70 * scale;
        if (x < mgn) ax += 0.10 * scale; if (x > W - mgn) ax -= 0.10 * scale;
        if (y < mgn) ay += 0.10 * scale; if (y > H - mgn) ay -= 0.10 * scale;
        ax += (W*0.5 - x) * 0.00012;
        ay += (H*0.45 - y) * 0.00012;

        vx += ax; vy += ay;
        const sp = Math.hypot(vx, vy) + 1e-4;
        const cl = sp > maxS ? maxS/sp : (sp < minS ? minS/sp : 1);
        vx *= cl; vy *= cl;

        data[i*4] = x + vx;
        data[i*4+1] = y + vy;
        data[i*4+2] = Math.hypot(vx, vy) / scale;
        vel[i*2] = vx; vel[i*2+1] = vy;
      }

      // --- draw ---
      E().target(gl, trail);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      fadeProg.use().set('u_col', [0, 0, 0, 0.26]);        // short wing-blur trails
      env.quad.draw();
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      pointProg.use().set('u_res', [W, H]);
      gl.drawArrays(gl.POINTS, 0, N);
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);

      E().screen(gl, W, H);
      presentProg.use().tex('u_tex', trail.tex);
      presentProg.set('u_res', [W, H]);
      env.quad.draw();
    },
    dispose(env) {
      const gl = env.gl;
      if (trail) E().delTarget(gl, trail);
      if (buf) gl.deleteBuffer(buf);
      if (vao) gl.deleteVertexArray(vao);
      if (pointProg) pointProg.dispose();
      if (fadeProg) fadeProg.dispose();
      if (presentProg) presentProg.dispose();
      trail = buf = vao = pointProg = fadeProg = presentProg = null;
    },
  };
})();
