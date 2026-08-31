/**
 * abyss.js — an endless Julia field behind the wheels.
 * Zoom wraps on a log cycle so the deep never runs out of room.
 */

import { throne } from "./throne.js";

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uLook;
uniform float uCalm;
uniform float uIters;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  uv += uLook * 0.22;

  float folds = 6.28318530718 / 8.0;
  float ang = atan(uv.y, uv.x);
  float rad = length(uv);
  ang = mod(ang, folds) - folds * 0.5;
  uv = vec2(cos(ang), sin(ang)) * rad;

  float cycle = mix(0.055, 0.0, uCalm);
  float zoom = exp(mod(uTime * cycle, 3.2));
  vec2 z = uv * (2.15 / zoom);

  vec2 c = vec2(
    -0.745 + 0.045 * sin(uTime * 0.041 + 1.2),
    0.186 + 0.038 * cos(uTime * 0.033)
  );

  float n = 0.0;
  for (float i = 0.0; i < 80.0; i++) {
    if (i >= uIters) break;
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 14.0) break;
    n = i;
  }

  float t = n / max(uIters, 1.0);
  float edge = pow(t, 0.55);
  float glow = exp(-length(uv) * 0.85);
  vec3 voidc = vec3(0.03, 0.02, 0.05);
  vec3 brass = vec3(0.55, 0.3, 0.08);
  vec3 gold = vec3(0.94, 0.78, 0.36);
  vec3 ember = vec3(0.62, 0.12, 0.1);
  vec3 col = mix(voidc, brass, smoothstep(0.0, 0.28, edge));
  col = mix(col, gold, smoothstep(0.32, 0.88, edge));
  col = mix(col, ember, smoothstep(0.82, 1.0, edge) * 0.45);
  col += gold * glow * 0.12;
  col *= mix(1.0, 0.7, uCalm);
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

export function createAbyss(canvas) {
  if (!canvas) {
    return { tick() {}, dispose() {} };
  }

  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) {
    return { tick() {}, dispose() {} };
  }

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    return { tick() {}, dispose() {} };
  }

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  const uRes = gl.getUniformLocation(prog, "uRes");
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uLook = gl.getUniformLocation(prog, "uLook");
  const uCalm = gl.getUniformLocation(prog, "uCalm");
  const uIters = gl.getUniformLocation(prog, "uIters");

  const iters = throne.quality === "low" ? 28 : throne.quality === "high" ? 64 : 44;
  const dpr = throne.quality === "low" ? 0.6 : throne.quality === "high" ? 1 : 0.8;
  let frozen = 0;

  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth * dpr));
    const h = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
  }

  resize();
  window.addEventListener("resize", resize);

  return {
    tick(now) {
      if (!gl) return;
      resize();
      const t = now * 0.001;
      if (throne.calm && !frozen) frozen = t;
      if (!throne.calm) frozen = 0;
      const time = throne.calm ? frozen : t;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uLook, throne.mouse.ndcX || 0, throne.mouse.ndcY || 0);
      gl.uniform1f(uCalm, throne.calm ? 1 : 0);
      gl.uniform1f(uIters, iters);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      window.removeEventListener("resize", resize);
    },
  };
}
