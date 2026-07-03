// gl-engine.js — minimal WebGL2 toolkit shared by every wallpaper.
window.Engine = (function () {
  function createGL(canvas) {
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: false,
      premultipliedAlpha: false, powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL2 not supported');
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    gl.getExtension('EXT_float_blend');
    return gl;
  }

  // Fullscreen single-triangle vertex shader. v_uv spans 0..1 over the screen.
  const QUAD_VERT = `#version 300 es
in vec2 position;
out vec2 v_uv;
void main(){ v_uv = position*0.5+0.5; gl_Position = vec4(position,0.0,1.0); }`;

  // Shared GLSL helpers injected into every quad fragment shader.
  const GLSL_COMMON = `
float hash1(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
vec2 hash2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453123); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  float a=hash1(i), b=hash1(i+vec2(1.0,0.0)), c=hash1(i+vec2(0.0,1.0)), d=hash1(i+vec2(1.0,1.0));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v=0.0, a=0.5;
  mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<6;i++){ v+=a*vnoise(p); p=m*p; a*=0.5; }
  return v;
}
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b*cos(6.28318530718*(c*t+d)); }
`;

  // Standard fragment-shader header: precision, varyings, the common uniform set, helpers.
  const FRAG_HEADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 frag;
uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_mouse;     // 0..1, y up
uniform vec2  u_pmouse;    // previous frame mouse
uniform vec2  u_vel;       // per-frame mouse delta
uniform float u_speed;     // smoothed cursor speed, ~0..1.5
uniform float u_click;     // click energy, decays 1->0
uniform vec2  u_clickPos;  // 0..1
uniform float u_clickTime; // seconds since last click
` + GLSL_COMMON;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      console.error(log, src);
      throw new Error('Shader compile error: ' + log);
    }
    return s;
  }

  class Program {
    constructor(gl, vert, frag) {
      this.gl = gl;
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vert));
      gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
      gl.bindAttribLocation(p, 0, 'position');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        throw new Error('Link error: ' + gl.getProgramInfoLog(p));
      }
      this.p = p;
      this._loc = {};
      this.unit = 0;
    }
    use() { this.gl.useProgram(this.p); this.unit = 0; return this; }
    l(n) { if (!(n in this._loc)) this._loc[n] = this.gl.getUniformLocation(this.p, n); return this._loc[n]; }
    set(n, v) {
      const gl = this.gl, L = this.l(n);
      if (L == null) return this;
      if (typeof v === 'number') gl.uniform1f(L, v);
      else if (v.length === 2) gl.uniform2fv(L, v);
      else if (v.length === 3) gl.uniform3fv(L, v);
      else if (v.length === 4) gl.uniform4fv(L, v);
      return this;
    }
    seti(n, v) { const L = this.l(n); if (L != null) this.gl.uniform1i(L, v); return this; }
    tex(n, texture) {
      const gl = this.gl, u = this.unit++;
      gl.activeTexture(gl.TEXTURE0 + u);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      this.seti(n, u);
      return this;
    }
    dispose() { this.gl.deleteProgram(this.p); }
  }

  function quad(gl) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return { draw() { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); } };
  }

  function makeTarget(gl, w, h, internalFormat, format, type, filter) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, w, h };
  }
  function floatTarget(gl, w, h, filter) {
    return makeTarget(gl, w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, filter || gl.LINEAR);
  }
  function colorTarget(gl, w, h, filter) {
    return makeTarget(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, filter || gl.LINEAR);
  }
  function delTarget(gl, t) { if (!t) return; gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }

  class PingPong {
    constructor(gl, w, h, filter) {
      this.gl = gl; this.filter = filter || gl.LINEAR;
      this.a = floatTarget(gl, w, h, this.filter);
      this.b = floatTarget(gl, w, h, this.filter);
      this.w = w; this.h = h; this.clear();
    }
    get read() { return this.a; }
    get write() { return this.b; }
    swap() { const t = this.a; this.a = this.b; this.b = t; }
    clear() {
      const gl = this.gl;
      for (const t of [this.a, this.b]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
        gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    resize(w, h) {
      const gl = this.gl;
      delTarget(gl, this.a); delTarget(gl, this.b);
      this.a = floatTarget(gl, w, h, this.filter);
      this.b = floatTarget(gl, w, h, this.filter);
      this.w = w; this.h = h; this.clear();
    }
    dispose() { delTarget(this.gl, this.a); delTarget(this.gl, this.b); }
  }

  // Bind the default framebuffer and set the viewport.
  function screen(gl, w, h) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
  }
  // Bind an offscreen target and set the viewport.
  function target(gl, t) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.viewport(0, 0, t.w, t.h);
  }

  // Push the standard uniform set onto a program.
  function setCommon(prog, env) {
    const i = env.input;
    prog.set('u_res', [env.W, env.H])
      .set('u_time', env.time)
      .set('u_mouse', i.mouse)
      .set('u_pmouse', i.pmouse)
      .set('u_vel', i.vel)
      .set('u_speed', i.speed)
      .set('u_click', i.click.energy)
      .set('u_clickPos', i.click.pos)
      .set('u_clickTime', i.clickAge);
  }

  return {
    createGL, Program, quad, PingPong,
    floatTarget, colorTarget, delTarget,
    screen, target, setCommon,
    QUAD_VERT, FRAG_HEADER, GLSL_COMMON,
  };
})();
