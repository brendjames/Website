// wp-particles.js — magnetic particle field. ~2000 points are pulled toward the
// cursor with a swirl; fast movement flings them; a click repels them outward.
// Motion trails are accumulated in a fading framebuffer.
window.WP = window.WP || {};
window.WP.particles = (function () {
  const E = () => window.Engine;
  const N = 2200;

  const POINT_VERT = `#version 300 es
in vec2 a_pos;
in float a_spd;
uniform vec2 u_res;
out float v_spd;
void main(){
  vec2 cl = (a_pos / u_res) * 2.0 - 1.0;
  cl.y = -cl.y;
  gl_Position = vec4(cl, 0.0, 1.0);
  gl_PointSize = mix(1.4, 5.0, clamp(a_spd*0.018, 0.0, 1.0));
  v_spd = a_spd;
}`;

  const POINT_FRAG = `#version 300 es
precision highp float;
in float v_spd;
out vec4 frag;
void main(){
  vec2 c = gl_PointCoord*2.0-1.0;
  float d = dot(c,c);
  if(d > 1.0) discard;
  float a = smoothstep(1.0, 0.0, d);
  vec3 col = mix(vec3(0.18,0.62,0.92), vec3(0.85,0.96,1.0), clamp(v_spd*0.025,0.0,1.0));
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
  // gentle vignette to seat the field in deep slate
  vec2 q = v_uv - 0.5; q.x *= u_res.x/u_res.y;
  float vig = smoothstep(0.95, 0.25, length(q));
  c += vec3(0.015,0.03,0.05) * vig;     // faint cool base wash
  frag = vec4(c, 1.0);
}`;

  let pointProg, fadeProg, presentProg, vao, buf, data, vel, trail, lastW, lastH;

  function initParticles(W, H) {
    data = new Float32Array(N * 3); // x, y, spd
    vel = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      data[i * 3] = Math.random() * W;
      data[i * 3 + 1] = Math.random() * H;
      data[i * 3 + 2] = 0;
      vel[i * 2] = (Math.random() - 0.5) * 4;
      vel[i * 2 + 1] = (Math.random() - 0.5) * 4;
    }
  }

  return {
    id: 'magnet', name: 'Magnet',
    hint: 'Pull the swarm in · click to blast it apart',
    setup(env) {
      const gl = env.gl;
      pointProg = new (E().Program)(gl, POINT_VERT, POINT_FRAG);
      fadeProg = new (E().Program)(gl, E().QUAD_VERT, FADE_FRAG);
      presentProg = new (E().Program)(gl, E().QUAD_VERT, PRESENT_FRAG);

      initParticles(env.W, env.H);
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const aPos = gl.getAttribLocation(pointProg.p, 'a_pos');
      const aSpd = gl.getAttribLocation(pointProg.p, 'a_spd');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 12, 0);
      gl.enableVertexAttribArray(aSpd);
      gl.vertexAttribPointer(aSpd, 1, gl.FLOAT, false, 12, 8);
      gl.bindVertexArray(null);

      trail = E().colorTarget(gl, env.W, env.H, gl.LINEAR);
      lastW = env.W; lastH = env.H;
    },
    resize(env) {
      const gl = env.gl;
      if (trail) E().delTarget(gl, trail);
      trail = E().colorTarget(gl, env.W, env.H, gl.LINEAR);
      // Rescale existing particle positions to the new canvas.
      const sx = env.W / Math.max(1, lastW), sy = env.H / Math.max(1, lastH);
      for (let i = 0; i < N; i++) { data[i * 3] *= sx; data[i * 3 + 1] *= sy; }
      lastW = env.W; lastH = env.H;
    },
    render(env) {
      const gl = env.gl, W = env.W, H = env.H, inp = env.input;
      const mx = inp.mousePx[0], my = inp.mousePx[1];
      const mvx = inp.velPx[0], mvy = inp.velPx[1];
      const speed = inp.speed;
      const click = inp.click.energy;
      const cx = inp.click.pos[0] * W, cy = (1 - inp.click.pos[1]) * H;

      // --- CPU integration ---
      for (let i = 0; i < N; i++) {
        let x = data[i * 3], y = data[i * 3 + 1];
        let vx = vel[i * 2], vy = vel[i * 2 + 1];
        let dx = mx - x, dy = my - y;
        let dist = Math.hypot(dx, dy) + 12;
        let nx = dx / dist, ny = dy / dist;

        // Magnetic attraction with a perpendicular swirl.
        let f = 900 / dist;
        vx += nx * f * 0.045 + (-ny) * f * 0.030;
        vy += ny * f * 0.045 + (nx) * f * 0.030;

        // Fast cursor flings nearby particles along its motion.
        let near = Math.exp(-dist / 160);
        vx += mvx * 0.08 * near * (0.5 + speed);
        vy += mvy * 0.08 * near * (0.5 + speed);

        // Click repulsion burst.
        if (click > 0.01) {
          let rdx = x - cx, rdy = y - cy;
          let rd = Math.hypot(rdx, rdy) + 14;
          let rf = (6000 / rd) * click;
          vx += (rdx / rd) * rf * 0.05;
          vy += (rdy / rd) * rf * 0.05;
        }

        vx *= 0.92; vy *= 0.92;          // damping
        x += vx; y += vy;

        // Toroidal wrap.
        if (x < 0) x += W; else if (x >= W) x -= W;
        if (y < 0) y += H; else if (y >= H) y -= H;

        data[i * 3] = x; data[i * 3 + 1] = y;
        data[i * 3 + 2] = Math.hypot(vx, vy);
        vel[i * 2] = vx; vel[i * 2 + 1] = vy;
      }

      // --- Draw into the trail buffer ---
      E().target(gl, trail);
      gl.enable(gl.BLEND);
      // Fade previous frame toward deep slate (leaves trails).
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      fadeProg.use().set('u_col', [0.015, 0.03, 0.055, 0.11]);
      env.quad.draw();
      // Additive points.
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      pointProg.use().set('u_res', [W, H]);
      gl.drawArrays(gl.POINTS, 0, N);
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);

      // --- Present to screen ---
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
