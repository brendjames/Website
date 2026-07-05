// wp-fireworks.js — a fireworks show you conduct. Click anywhere to launch a
// rocket to that exact spot; it climbs on a sparkling tail and bursts into a
// gravity-bound shell of colour. Moving the cursor bends the sparks like
// wind, and when nobody's clicking the sky launches its own.
window.WP = window.WP || {};
window.WP.fireworks = (function () {
  const E = () => window.Engine;
  const MAXS = 2600;

  const POINT_VERT = `#version 300 es
in vec2 a_pos;
in float a_life;
in vec3 a_col;
uniform vec2 u_res;
out float v_life;
out vec3 v_col;
void main(){
  vec2 cl = (a_pos / u_res) * 2.0 - 1.0;
  cl.y = -cl.y;
  gl_Position = vec4(cl, 0.0, 1.0);
  gl_PointSize = 1.2 + a_life*2.6;
  v_life = a_life;
  v_col = a_col;
}`;

  const POINT_FRAG = `#version 300 es
precision highp float;
in float v_life;
in vec3 v_col;
out vec4 frag;
void main(){
  if (v_life <= 0.0) discard;
  vec2 c = gl_PointCoord*2.0-1.0;
  float d = dot(c,c);
  if (d > 1.0) discard;
  float a = smoothstep(1.0, 0.0, d) * v_life;
  vec3 col = mix(v_col, vec3(1.0, 0.97, 0.9), pow(v_life, 3.0)*0.6);  // white-hot young
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
  vec3 sky = mix(vec3(0.016,0.010,0.030), vec3(0.045,0.020,0.045), 1.0-v_uv.y);
  // faint city-glow along the bottom
  sky += vec3(0.10,0.05,0.03) * exp(-v_uv.y*6.0);
  frag = vec4(sky + c, 1.0);
}`;

  const PALETTES = [
    [1.00, 0.72, 0.28],   // gold
    [0.98, 0.30, 0.24],   // crimson
    [0.45, 0.95, 0.45],   // emerald
    [0.80, 0.45, 1.00],   // violet
    [0.40, 0.80, 1.00],   // ice blue
    [1.00, 0.50, 0.75],   // rose
  ];

  let pointProg, fadeProg, presentProg, vao, buf, data, vel, decay;
  let head = 0, rockets, lastLaunch, lastClickAge, trail, lastW, lastH;

  function spawn(x, y, vx, vy, life, dec, col) {
    const i = head; head = (head + 1) % MAXS;
    data[i*6] = x; data[i*6+1] = y;
    data[i*6+2] = life;
    data[i*6+3] = col[0]; data[i*6+4] = col[1]; data[i*6+5] = col[2];
    vel[i*2] = vx; vel[i*2+1] = vy;
    decay[i] = dec;
  }

  function explode(x, y, scale) {
    const col = PALETTES[(Math.random() * PALETTES.length) | 0];
    const n = 130 + (Math.random() * 90) | 0;
    const willow = Math.random() < 0.25;          // some bursts hang and droop
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.28318;
      const sp = (0.25 + Math.pow(Math.random(), 0.5)) * (2.6 + Math.random()*2.2) * scale;
      const cv = 0.85 + Math.random()*0.3;
      spawn(x, y, Math.cos(a)*sp, Math.sin(a)*sp,
            1.0, willow ? 0.006 + Math.random()*0.005 : 0.011 + Math.random()*0.009,
            [col[0]*cv, col[1]*cv, col[2]*cv]);
    }
  }

  function launch(x, targetY, W, H, scale) {
    rockets.push({ x, y: H + 8, vy: -(9.5 + Math.random()*2.5) * scale, targetY });
  }

  return {
    id: 'fireworks', name: 'Fireworks',
    hint: 'Click anywhere to launch a shell right there',
    setup(env) {
      const gl = env.gl;
      pointProg = new (E().Program)(gl, POINT_VERT, POINT_FRAG);
      fadeProg = new (E().Program)(gl, E().QUAD_VERT, FADE_FRAG);
      presentProg = new (E().Program)(gl, E().QUAD_VERT, PRESENT_FRAG);
      data = new Float32Array(MAXS * 6);   // x, y, life, r, g, b
      vel = new Float32Array(MAXS * 2);
      decay = new Float32Array(MAXS);
      head = 0; rockets = []; lastLaunch = -10; lastClickAge = 1e9;

      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const aPos = gl.getAttribLocation(pointProg.p, 'a_pos');
      const aLife = gl.getAttribLocation(pointProg.p, 'a_life');
      const aCol = gl.getAttribLocation(pointProg.p, 'a_col');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(aLife);
      gl.vertexAttribPointer(aLife, 1, gl.FLOAT, false, 24, 8);
      gl.enableVertexAttribArray(aCol);
      gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 24, 12);
      gl.bindVertexArray(null);
      trail = E().colorTarget(gl, env.W, env.H, gl.LINEAR);
      lastW = env.W; lastH = env.H;
    },
    resize(env) {
      const gl = env.gl;
      if (trail) E().delTarget(gl, trail);
      trail = E().colorTarget(gl, env.W, env.H, gl.LINEAR);
      const sx = env.W / Math.max(1, lastW), sy = env.H / Math.max(1, lastH);
      for (let i = 0; i < MAXS; i++) { data[i*6] *= sx; data[i*6+1] *= sy; }
      lastW = env.W; lastH = env.H;
    },
    render(env) {
      const gl = env.gl, W = env.W, H = env.H, inp = env.input;
      const scale = Math.min(W, H) / 700;
      const grav = 0.045 * scale;
      const windX = inp.velPx[0] * 0.010, windY = inp.velPx[1] * 0.010;

      // a fresh click means clickAge snapped back to ~0: launch there
      if (inp.clickAge < lastClickAge - 0.5) {
        launch(inp.click.pos[0] * W, (1 - inp.click.pos[1]) * H, W, H, scale);
        lastLaunch = env.time;
      }
      lastClickAge = inp.clickAge;

      // idle show: the sky launches its own
      if (env.time - lastLaunch > 2.4 + (Math.sin(env.time*0.7)*0.5+0.5)*2.0) {
        launch(W * (0.15 + Math.random()*0.7), H * (0.15 + Math.random()*0.40), W, H, scale);
        lastLaunch = env.time;
      }

      // rockets climb, sparkle, burst
      for (let ri = rockets.length - 1; ri >= 0; ri--) {
        const rk = rockets[ri];
        rk.y += rk.vy;
        rk.vy += grav * 0.25;
        spawn(rk.x + (Math.random()-0.5)*2, rk.y, (Math.random()-0.5)*0.6*scale,
              0.9*scale, 0.5, 0.05, [1.0, 0.8, 0.5]);
        if (rk.y <= rk.targetY || rk.vy > -1.5*scale) {
          explode(rk.x, rk.y, scale);
          rockets.splice(ri, 1);
        }
      }

      // sparks: gravity, drag, cursor wind
      for (let i = 0; i < MAXS; i++) {
        let life = data[i*6+2];
        if (life <= 0) continue;
        let vx = vel[i*2] + windX * Math.min(1, life);
        let vy = vel[i*2+1] + grav;
        vx *= 0.985; vy *= 0.985;
        data[i*6]   += vx;
        data[i*6+1] += vy;
        life -= decay[i];
        data[i*6+2] = life > 0 ? life : 0;
        vel[i*2] = vx; vel[i*2+1] = vy;
      }

      // --- draw ---
      E().target(gl, trail);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      fadeProg.use().set('u_col', [0.004, 0.002, 0.010, 0.14]);  // long luminous tails
      env.quad.draw();
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      pointProg.use().set('u_res', [W, H]);
      gl.drawArrays(gl.POINTS, 0, MAXS);
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
