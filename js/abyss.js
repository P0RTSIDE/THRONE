/**
 * abyss.js — a gold Mandelbrot/Julia field that stays on the filaments.
 * The view drifts along the set. Nothing wraps, so nothing snaps.
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
uniform float uMood;

vec2 square(vec2 z) {
  return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  uv += uLook * 0.035;

  float turn = uTime * 0.011;
  float ca = cos(turn);
  float sa = sin(turn);
  uv = vec2(ca * uv.x - sa * uv.y, sa * uv.x + ca * uv.y);

  vec2 drift = vec2(sin(uTime * 0.0073), cos(uTime * 0.0058)) * 0.16;
  float sc = 1.22 + 0.1 * sin(uTime * 0.009);
  if (uCalm > 0.5) {
    sc = 1.22;
    drift *= 0.15;
  }

  float path = uTime * 0.0054;
  float th = 2.15 + path + 0.55 * sin(path * 0.41);
  vec2 cWalk = 0.28 * vec2(cos(th), sin(th)) + vec2(-0.76, 0.09);
  vec2 cPretty = vec2(-0.745429, 0.113008);
  vec2 cShip = vec2(-1.25, 0.045);
  float pick = 0.5 + 0.5 * sin(uTime * 0.0047);
  vec2 c = mix(mix(cPretty, cWalk, 0.62), cShip, pick * 0.18);

  vec2 z = (uv + drift) * sc;
  float n = 0.0;
  float trapX = 12.0;
  float trapY = 12.0;
  float trapC = 12.0;
  float minR = 12.0;
  vec2 last = z;
  for (float i = 0.0; i < 96.0; i++) {
    if (i >= uIters) break;
    z = square(z) + c;
    z = vec2(z.x, mix(z.y, abs(z.y), 0.22));
    float r2 = dot(z, z);
    trapX = min(trapX, abs(z.x));
    trapY = min(trapY, abs(z.y));
    trapC = min(trapC, abs(length(z) - 0.55));
    minR = min(minR, r2);
    last = z;
    if (r2 > 20.0) break;
    n = i;
  }

  vec2 m = uv * 0.72 + vec2(-0.55, 0.02) + drift * 0.55;
  vec2 mz = vec2(0.0);
  float mn = 0.0;
  float mTrap = 12.0;
  for (float i = 0.0; i < 96.0; i++) {
    if (i >= uIters * 0.7) break;
    mz = square(mz) + m;
    float r2 = dot(mz, mz);
    mTrap = min(mTrap, abs(mz.x * mz.y));
    if (r2 > 16.0) break;
    mn = i;
  }

  float t = n / max(uIters, 1.0);
  float mt = mn / max(uIters * 0.7, 1.0);
  float fil = 1.0 - smoothstep(0.0, 0.09, min(trapX, trapY));
  float ring = 1.0 - smoothstep(0.0, 0.18, trapC);
  float vein = 1.0 - smoothstep(0.0, 0.1, mTrap);
  float interior = 1.0 - smoothstep(0.0, 0.45, minR);
  float stripes = 0.5 + 0.5 * sin(atan(last.y, last.x) * 7.0 + uTime * 0.16);
  float edge = pow(max(t, mt * 0.85), 0.38);

  vec3 voidc = vec3(0.028, 0.016, 0.04);
  vec3 brass = vec3(0.48, 0.26, 0.07);
  vec3 gold = vec3(0.95, 0.8, 0.38);
  vec3 ember = vec3(0.62, 0.14, 0.08);
  vec3 violet = vec3(0.28, 0.1, 0.42);
  vec3 sear = vec3(0.96, 0.92, 0.78);

  float mood = clamp(uMood, 0.0, 5.0);
  vec3 accent = mix(gold, brass, smoothstep(0.0, 1.0, mood));
  accent = mix(accent, violet, smoothstep(1.2, 2.2, mood));
  accent = mix(accent, ember, smoothstep(2.2, 3.2, mood));
  accent = mix(accent, sear, smoothstep(3.2, 4.2, mood));
  accent = mix(accent, vec3(0.7, 0.12, 0.22), smoothstep(4.2, 5.0, mood));

  vec3 col = mix(voidc, brass, smoothstep(0.05, 0.42, edge));
  col = mix(col, accent, fil * 0.78 + vein * 0.45);
  col = mix(col, gold, ring * 0.55 + stripes * fil * 0.22);
  col = mix(col, ember, interior * (1.0 - fil) * 0.22);
  col += accent * (fil * 0.2 + vein * 0.12);
  col = mix(col, voidc, smoothstep(0.92, 1.0, t) * 0.15 * (1.0 - fil));
  col *= mix(1.0, 0.7, uCalm);
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("abyss shader", gl.getShaderInfoLog(sh));
  }
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
    canvas.dataset.abyss = "fail";
    return { tick() {}, dispose() {} };
  }
  canvas.dataset.abyss = "ok";

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  const uRes = gl.getUniformLocation(prog, "uRes");
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uLook = gl.getUniformLocation(prog, "uLook");
  const uCalm = gl.getUniformLocation(prog, "uCalm");
  const uIters = gl.getUniformLocation(prog, "uIters");
  const uMood = gl.getUniformLocation(prog, "uMood");

  const iters = throne.quality === "low" ? 48 : throne.quality === "high" ? 88 : 68;
  let mood = 0;
  const dpr = throne.quality === "low" ? 0.65 : throne.quality === "high" ? 1 : 0.85;
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
      const moodId = {
        witness: 0,
        merkavah: 1,
        waters: 2,
        seraph: 3,
        unblinking: 4,
        inverted: 5,
        name: 0.4,
        hush: 2.1,
        offered: 0.2,
      };
      const targetMood = moodId[throne.aspect] == null ? 0 : moodId[throne.aspect];
      mood += (targetMood - mood) * 0.012;
      gl.uniform1f(uMood, mood);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      window.removeEventListener("resize", resize);
    },
  };
}
