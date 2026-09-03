/**
 * eyeWheel.js — Ophanim Rendering Engine
 *
 * What this file does:
 *   1. Many interlocking eyed wheels in three.js: gyros inside rims, gear teeth, a cage, coals, four living faces, spokes that meet their own race and rim, loose eyes, a hearth, and wings.
 *   2. Instanced almond-eyes covering each rim, seated on the metal. Each eye blinks on its own phase, dilates slowly,
 *      and the pupil tracks the cursor via a cheap NDC offset.
 *   3. Attendant aspects rewrite spin, fog, fire, wings, blink, and rim scale so the change is visible.
 *   4. A distant eye can be opened (rim slider release) by boosting one instance's scale.
 *   5. Dispatches `throne:cycle` when the outer wheel wraps 2π so audio can swell (volume-capped).
 *   7. weep: every lid wells and bronze-blood tears fall while the boy screams.
 *
 * Calm Mode: rotations slow to a crawl, blinks freeze open, camera wobble dies.
 */

import * as THREE from "three";
import { throne, randRange } from "./throne.js";

const PALETTES = [
  { irisA: new THREE.Color("#5c2e0a"), irisB: new THREE.Color("#d4a017"), metal: 0x8a5a22, emit: 0x3d2208 },
  { irisA: new THREE.Color("#3a2210"), irisB: new THREE.Color("#f0d078"), metal: 0xb8892a, emit: 0x5a3a10 },
];

const EYE_VERT = /* glsl */ `
  attribute float aPhase;
  attribute float aAlive;
  varying vec2 vUv;
  varying vec2 vLook;
  varying float vPhase;
  varying float vDilate;
  varying float vAlive;
  uniform vec2 uMouse;
  uniform float uTime;
  uniform float uCalm;
  uniform float uLookGain;
  uniform float uPupilMul;

  void main() {
    vUv = uv;
    vPhase = aPhase;
    vAlive = aAlive;
    vDilate = mix(0.72, 1.25, 0.5 + 0.5 * sin(uTime * 0.37 + aPhase * 6.28318));
    vDilate *= uPupilMul;
    if (uCalm > 0.5) vDilate = 0.9 * uPupilMul;

    #ifdef USE_INSTANCING
      mat4 im = instanceMatrix;
    #else
      mat4 im = mat4(1.0);
    #endif

    vec4 worldCenter = modelMatrix * im * vec4(0.0, 0.0, 0.0, 1.0);
    vec4 clipCenter = projectionMatrix * viewMatrix * worldCenter;
    vec2 ndc = clipCenter.xy / max(abs(clipCenter.w), 0.0001);
    vLook = (uMouse - ndc) * (1.0 - uCalm * 0.7) * uLookGain;

    vec3 pos = position * mix(0.15, 1.0, aAlive);
    gl_Position = projectionMatrix * modelViewMatrix * im * vec4(pos, 1.0);
  }
`;

const EYE_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vLook;
  varying float vPhase;
  varying float vDilate;
  varying float vAlive;
  uniform float uTime;
  uniform vec3 uIrisA;
  uniform vec3 uIrisB;
  uniform float uCalm;
  uniform float uBlinkAllow;
  uniform vec3 uSclera;
  uniform float uWeep;

  void main() {
    if (vAlive < 0.2) discard;

    vec2 uv = vUv * 2.0 - 1.0;

    float period = mix(3.4, 10.0, vPhase);
    float t = mod(uTime * mix(0.45, 0.9, vPhase) + vPhase * 19.0, period);
    float blink = 0.0;
    if (t < 0.15 && uCalm < 0.5 && uBlinkAllow > 0.5) {
      blink = sin((t / 0.15) * 3.14159265);
    }
    float yScale = mix(1.0, 10.0, blink);
    vec2 e = vec2(uv.x, uv.y * yScale);

    float almondY = mix(1.72, 1.38, uWeep * step(0.0, e.y));
    float almond = length(vec2(e.x * 1.02, e.y * almondY));
    if (almond > 1.0) discard;
    float edge = smoothstep(1.0, 0.78, almond);

    vec3 sclera = mix(uSclera, vec3(0.93, 0.86, 0.68), 0.35);
    sclera = mix(sclera, vec3(0.42, 0.12, 0.12), uWeep * 0.55);
    vec2 look = clamp(vLook * 0.18, vec2(-0.22), vec2(0.22));
    look.y *= 0.6;
    vec2 irisUv = e - look;
    float ir = length(irisUv);
    float ang = atan(irisUv.y, irisUv.x);

    vec3 iris = mix(uIrisA, uIrisB, 0.45 + 0.2 * sin(vPhase * 6.0));
    float fibers = 0.5 + 0.5 * sin(ang * 22.0 + vPhase * 4.0) * sin(ir * 16.0);
    iris *= 0.88 + 0.14 * fibers;
    float irisMask = smoothstep(0.52, 0.42, ir);
    vec3 col = mix(sclera, iris, irisMask);

    float pupilR = 0.16 * vDilate;
    float pupil = smoothstep(pupilR + 0.02, pupilR - 0.01, ir);
    col = mix(col, vec3(0.07, 0.03, 0.02), pupil);

    float spec = smoothstep(0.08, 0.0, length(irisUv - vec2(-0.1, 0.12)));
    col += vec3(0.85, 0.75, 0.4) * spec * 0.45 * (1.0 - blink);

    float well = smoothstep(0.12, 0.62, e.y) * smoothstep(0.98, 0.52, almond);
    col = mix(col, vec3(0.38, 0.07, 0.09), well * uWeep * 0.72);

    float track = 1.0 - smoothstep(0.035, 0.1, abs(e.x - 0.1));
    track *= smoothstep(-0.08, 0.22, e.y) * smoothstep(1.2, 0.28, e.y);
    col = mix(col, vec3(0.62, 0.14, 0.14), track * uWeep * 0.85);

    float cry = step(0.28, fract(vPhase * 6.3));
    float dropY = fract(uTime * 0.11 + vPhase * 0.73) * 1.55 - 0.28;
    vec2 dropUv = vec2((e.x - 0.09) * 1.6, (e.y - dropY) * 0.85);
    float drop = 1.0 - smoothstep(0.028, 0.07, length(dropUv));
    drop *= cry * uWeep * step(0.02, dropY) * (1.0 - blink);
    col += vec3(0.55, 0.12, 0.1) * drop;

    vec3 rim = mix(vec3(0.55, 0.38, 0.1), iris, 0.3);
    col = mix(rim, col, edge);
    col *= 1.0 - blink * 0.7;
    col += vec3(0.4, 0.12, 0.1) * spec * uWeep * 0.5;

    gl_FragColor = vec4(col, edge);
  }
`;

function qualityConfig(q) {
  const native = window.devicePixelRatio || 1;
  if (q === "low") {
    return { uSeg: 12, vSeg: 6, tube: 10, radial: 32, dpr: Math.min(0.85, native), glow: false, host: 2, extra: 0, eyeSeg: 12 };
  }
  if (q === "high") {
    return { uSeg: 28, vSeg: 16, tube: 24, radial: 80, dpr: Math.min(1.5, native), glow: true, host: 7, extra: 2, eyeSeg: 24 };
  }
  return { uSeg: 18, vSeg: 9, tube: 14, radial: 48, dpr: Math.min(1.15, native), glow: false, host: 4, extra: 0, eyeSeg: 16 };
}

/** Place an eye on a torus, facing along the surface normal. */
function torusPoint(R, r, u, v, target, normal) {
  const cu = Math.cos(u);
  const su = Math.sin(u);
  const cv = Math.cos(v);
  const sv = Math.sin(v);
  target.set((R + r * cv) * cu, (R + r * cv) * su, r * sv);
  normal.set(cv * cu, cv * su, sv).normalize();
}

function makeEyeField(R, r, uSeg, vSeg, eyeSize, eyeSeg = 16) {
  const count = uSeg * vSeg * 2;
  const geom = new THREE.CircleGeometry(eyeSize * 0.5, eyeSeg);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uIrisA: { value: PALETTES[0].irisA.clone() },
      uIrisB: { value: PALETTES[0].irisB.clone() },
      uCalm: { value: 0 },
      uLookGain: { value: 1 },
      uPupilMul: { value: 1 },
      uBlinkAllow: { value: 1 },
      uSclera: { value: new THREE.Color("#f3ebd6") },
      uWeep: { value: 0 },
    },
    vertexShader: EYE_VERT,
    fragmentShader: EYE_FRAG,
    alphaTest: 0.14,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.InstancedMesh(geom, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const phases = new Float32Array(count);
  const alive = new Float32Array(count);
  const dummy = new THREE.Object3D();
  const pos = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const up = new THREE.Vector3(0, 0, 1);

  let i = 0;
  for (let side = 0; side < 2; side++) {
    const inward = side === 1;
    for (let iu = 0; iu < uSeg; iu++) {
      for (let iv = 0; iv < vSeg; iv++) {
        const u = ((iu + (inward ? 0.35 : 0)) / uSeg) * Math.PI * 2;
        const v = ((iv + (inward ? 0.2 : 0)) / vSeg) * Math.PI * 2;
        torusPoint(R, r, u, v, pos, nrm);
        const face = inward ? nrm.clone().negate() : nrm;
        dummy.position.copy(pos).addScaledVector(face, r * 0.04);
        dummy.up.copy(up);
        dummy.lookAt(pos.clone().add(face));
        dummy.rotateZ((throne.rng() - 0.5) * 0.8);
        dummy.scale.set(0.45 + throne.rng() * 0.95, 0.28 + throne.rng() * 0.55, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        phases[i] = throne.rng();
        alive[i] = 1;
        i++;
      }
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  geom.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
  geom.setAttribute("aAlive", new THREE.InstancedBufferAttribute(alive, 1));
  mesh.frustumCulled = false;
  return { mesh, mat, alive, count };
}

export function createEyeWheel(root) {
  const cfg = qualityConfig(throne.quality);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0c0912, 0.01);
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(41, 1, 0.1, 90);
  camera.position.set(0, 0.35, 4.8);

  const renderer = new THREE.WebGLRenderer({
    antialias: throne.quality === "high" && cfg.dpr <= 1.05,
    alpha: true,
    powerPreference: throne.quality === "low" ? "low-power" : "high-performance",
  });
  renderer.setPixelRatio(cfg.dpr);
  renderer.setClearColor(0x0c0912, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;
  root.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0x3a2a18, 0.55);
  const hemi = new THREE.HemisphereLight(0xf0d078, 0x100814, 0.85);
  const key = new THREE.PointLight(0xffe6a8, 2.4, 28, 1.1);
  key.position.set(0.4, 5.4, 3.2);
  const fill = new THREE.PointLight(0x6a3a14, 0.55, 18, 1.4);
  fill.position.set(-2.8, -1.2, 2.4);
  const glory = new THREE.PointLight(0xfff1c8, 1.6, 36, 1.8);
  glory.position.set(0, 9, -1);
  scene.add(ambient, hemi, key, fill, glory);
  scene.environment = null;

  const vault = new THREE.Mesh(
    new THREE.SphereGeometry(18, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
    new THREE.MeshBasicMaterial({ color: 0xf0d078, transparent: true, opacity: 0.04, side: THREE.BackSide, depthWrite: false })
  );
  vault.position.y = 4;
  scene.add(vault);

  const host = new THREE.Group();
  scene.add(host);
  const hostMat = new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.09, depthWrite: false });
  for (let h = 0; h < cfg.host + 6; h++) {
    const g = new THREE.Mesh(new THREE.TorusGeometry(0.22 + (h % 4) * 0.1, 0.03, 8, 18), hostMat);
    const a = (h / (cfg.host + 6)) * Math.PI * 2 + 0.4;
    const far = h < cfg.host;
    const rad = far ? 14 + (h % 3) : 5.4 + (h % 3) * 1.1;
    g.position.set(Math.cos(a) * rad, ((h % 5) - 2) * (far ? 3.2 : 1.4), Math.sin(a) * rad - (far ? 6 : 1));
    g.rotation.set(0.7 + h * 0.2, a, 0.3 + h * 0.15);
    host.add(g);
  }

  const outerGroup = new THREE.Group();
  const innerGroup = new THREE.Group();
  const thirdGroup = new THREE.Group();
  const fourthGroup = new THREE.Group();
  const fifthGroup = new THREE.Group();
  const sixthGroup = new THREE.Group();
  const seventhGroup = new THREE.Group();
  const eighthGroup = new THREE.Group();
  const wingGroup = new THREE.Group();
  const looseGroup = new THREE.Group();
  innerGroup.rotation.x = Math.PI * 0.5;
  innerGroup.rotation.z = 0.18;
  thirdGroup.rotation.z = Math.PI * 0.5;
  thirdGroup.rotation.x = 0.32;
  fourthGroup.rotation.x = 1.15;
  fourthGroup.rotation.y = 0.62;
  fifthGroup.rotation.x = 0.55;
  fifthGroup.rotation.z = 1.15;
  sixthGroup.rotation.y = 0.88;
  sixthGroup.rotation.x = 0.95;
  seventhGroup.rotation.x = 1.35;
  seventhGroup.rotation.z = 0.4;
  eighthGroup.rotation.y = 1.25;
  eighthGroup.rotation.x = 0.22;
  scene.add(outerGroup, innerGroup, thirdGroup, fourthGroup, fifthGroup, sixthGroup, seventhGroup, eighthGroup, wingGroup, looseGroup);

  const kernelMat = new THREE.MeshStandardMaterial({ color: 0x090704, roughness: 0.96, metalness: 0.02 });
  const kernel = new THREE.Group();
  const kernelHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), kernelMat);
  const kernelBody = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), kernelMat);
  kernelBody.position.set(0.07, -0.14, 0.03);
  kernel.add(kernelHead, kernelBody);
  scene.add(kernel);

  const fatherMat = new THREE.MeshStandardMaterial({
    color: 0x16100a,
    roughness: 0.94,
    metalness: 0.06,
    emissive: 0x2a1608,
    emissiveIntensity: 0.18,
  });
  const father = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.28, 1.12, 10), fatherMat);
  robe.position.y = 0.08;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 10, 8), fatherMat);
  head.position.y = 0.74;
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), fatherMat);
  shoulder.scale.set(1.4, 0.42, 0.72);
  shoulder.position.y = 0.54;
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.52, 6), fatherMat);
  armL.position.set(-0.3, 0.26, 0.06);
  armL.rotation.z = 0.5;
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.56, 6), fatherMat);
  armR.position.set(0.27, 0.3, 0.14);
  armR.rotation.z = -0.62;
  armR.rotation.x = -0.4;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.3, 0.012), fatherMat);
  blade.position.set(0.36, 0.0, 0.32);
  blade.rotation.z = -0.45;
  father.add(robe, head, shoulder, armL, armR, blade);
  const fatherLight = new THREE.PointLight(0xc9a227, 0.9, 7.2, 1.5);
  fatherLight.position.set(0.15, 0.95, 0.55);
  father.add(fatherLight);
  father.position.set(0, -1.05, 5.6);
  father.scale.setScalar(1.38);
  father.visible = false;
  scene.add(father);

  const outerR = 2.18;
  const outerTube = 0.4;
  const innerR = 1.82;
  const innerTube = 0.34;
  const thirdR = 1.55;
  const thirdTube = 0.22;
  const fourthR = 2.55;
  const fourthTube = 0.16;
  const fifthR = 1.12;
  const fifthTube = 0.2;
  const sixthR = 2.95;
  const sixthTube = 0.1;
  const seventhR = 0.78;
  const seventhTube = 0.14;
  const eighthR = 3.35;
  const eighthTube = 0.07;

  function metalMat(color, emit) {
    return new THREE.MeshStandardMaterial({
      color,
      metalness: 0.22,
      roughness: 0.74,
      emissive: emit,
      emissiveIntensity: 0.35,
    });
  }

  const pal0 = PALETTES[0];
  const outerMesh = new THREE.Mesh(
    new THREE.TorusGeometry(outerR, outerTube, cfg.tube, cfg.radial),
    metalMat(pal0.metal, pal0.emit)
  );
  const innerMesh = new THREE.Mesh(
    new THREE.TorusGeometry(innerR, innerTube, cfg.tube, cfg.radial),
    metalMat(pal0.metal, pal0.emit)
  );
  const thirdMesh = new THREE.Mesh(
    new THREE.TorusGeometry(thirdR, thirdTube, Math.max(10, cfg.tube - 6), Math.max(48, cfg.radial - 24)),
    metalMat(pal0.metal, pal0.emit)
  );
  const fourthMesh = new THREE.Mesh(
    new THREE.TorusGeometry(fourthR, fourthTube, Math.max(8, cfg.tube - 8), Math.max(40, cfg.radial - 28)),
    metalMat(pal0.metal, pal0.emit)
  );
  const fifthMesh = new THREE.Mesh(
    new THREE.TorusGeometry(fifthR, fifthTube, Math.max(10, cfg.tube - 6), Math.max(40, cfg.radial - 20)),
    metalMat(pal0.metal, pal0.emit)
  );
  const sixthMesh = new THREE.Mesh(
    new THREE.TorusGeometry(sixthR, sixthTube, Math.max(8, cfg.tube - 8), Math.max(36, cfg.radial - 28)),
    metalMat(pal0.metal, pal0.emit)
  );
  const seventhMesh = new THREE.Mesh(
    new THREE.TorusGeometry(seventhR, seventhTube, Math.max(8, cfg.tube - 8), Math.max(32, cfg.radial - 32)),
    metalMat(pal0.metal, pal0.emit)
  );
  const eighthMesh = new THREE.Mesh(
    new THREE.TorusGeometry(eighthR, eighthTube, Math.max(8, cfg.tube - 10), Math.max(32, cfg.radial - 34)),
    metalMat(pal0.metal, pal0.emit)
  );
  outerGroup.add(outerMesh);
  innerGroup.add(innerMesh);
  thirdGroup.add(thirdMesh);
  fourthGroup.add(fourthMesh);
  fifthGroup.add(fifthMesh);
  sixthGroup.add(sixthMesh);
  seventhGroup.add(seventhMesh);
  eighthGroup.add(eighthMesh);

  const ninthGroup = new THREE.Group();
  const tenthGroup = new THREE.Group();
  ninthGroup.rotation.set(0.42, 1.72, 0.88);
  tenthGroup.rotation.set(1.08, 0.31, 1.55);
  const ninthR = 2.28;
  const ninthTube = 0.09;
  const tenthR = 0.52;
  const tenthTube = 0.11;
  const ninthMesh = new THREE.Mesh(
    new THREE.TorusGeometry(ninthR, ninthTube, Math.max(8, cfg.tube - 10), Math.max(36, cfg.radial - 28)),
    metalMat(pal0.metal, pal0.emit)
  );
  const tenthMesh = new THREE.Mesh(
    new THREE.TorusGeometry(tenthR, tenthTube, Math.max(8, cfg.tube - 8), Math.max(28, cfg.radial - 32)),
    metalMat(pal0.metal, pal0.emit)
  );
  ninthGroup.add(ninthMesh);
  tenthGroup.add(tenthMesh);
  if (cfg.extra >= 1) scene.add(ninthGroup);
  if (cfg.extra >= 2) scene.add(tenthGroup);

  const spokeMat = metalMat(pal0.metal, pal0.emit);
  const spokes = [];
  const metalExtras = [ninthMesh, tenthMesh];
  const gyros = [];

  function addTrack(group, R, tube) {
    const track = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.76, Math.max(0.03, tube * 0.26), 8, Math.max(28, cfg.radial - 30)),
      metalMat(pal0.metal, pal0.emit)
    );
    group.add(track);
    metalExtras.push(track);
  }

  function addGyro(parent, R, tube) {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.9, Math.max(0.04, tube * 0.42), Math.max(8, cfg.tube - 8), Math.max(32, cfg.radial - 24)),
      metalMat(pal0.metal, pal0.emit)
    );
    g.rotation.x = Math.PI * 0.5;
    g.add(mesh);
    parent.add(g);
    metalExtras.push(mesh);
    gyros.push(g);
    return g;
  }

  function addTeeth(group, R, tube, count) {
    const geom = new THREE.CylinderGeometry(0.018, 0.032, tube * 2.05, 10);
    const mesh = new THREE.InstancedMesh(geom, spokeMat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      dummy.lookAt(0, 0, 0);
      dummy.rotateX(Math.PI * 0.5);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    group.add(mesh);
    spokes.push(mesh);
  }

  addTrack(outerGroup, outerR, outerTube);
  addTrack(innerGroup, innerR, innerTube);
  addTrack(thirdGroup, thirdR, thirdTube);
  addGyro(outerGroup, outerR, outerTube);
  addGyro(innerGroup, innerR, innerTube);
  if (cfg.extra >= 1) {
    addTrack(fifthGroup, fifthR, fifthTube);
    addGyro(thirdGroup, thirdR, thirdTube);
    addGyro(fifthGroup, fifthR, fifthTube);
  }
  addTeeth(outerGroup, outerR, outerTube, cfg.extra >= 2 ? 32 : cfg.extra >= 1 ? 24 : 14);
  addTeeth(innerGroup, innerR, innerTube, cfg.extra >= 2 ? 22 : 14);
  if (cfg.extra >= 1) addTeeth(thirdGroup, thirdR, thirdTube, 16);

  function addBar(group, x0, y0, x1, y1, thick) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 0.2;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(thick, thick, len, 8), spokeMat);
    bar.position.set((x0 + x1) * 0.5, (y0 + y1) * 0.5, 0);
    bar.rotation.z = Math.atan2(dy, dx) - Math.PI * 0.5;
    group.add(bar);
    spokes.push(bar);
  }

  function addRimJoints(group, R, count, size) {
    const geom = new THREE.SphereGeometry(size, 8, 6);
    const mesh = new THREE.InstancedMesh(geom, spokeMat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    group.add(mesh);
    spokes.push(mesh);
  }

  function addWheelWeb(group, R, spokeCount, thick) {
    const raceR = R * 0.76;
    for (let i = 0; i < spokeCount; i++) {
      const a = (i / spokeCount) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      addBar(group, c * raceR, s * raceR, c * R, s * R, thick);
    }
    addRimJoints(group, R, spokeCount, Math.max(0.02, thick * 2.3));
    addRimJoints(group, raceR, spokeCount, Math.max(0.015, thick * 1.7));
  }

  addWheelWeb(outerGroup, outerR, cfg.extra >= 2 ? 12 : cfg.extra >= 1 ? 10 : 8, 0.016);
  addWheelWeb(innerGroup, innerR, cfg.extra >= 2 ? 9 : 7, 0.013);
  addWheelWeb(thirdGroup, thirdR, 8, 0.011);
  addWheelWeb(fifthGroup, fifthR, 6, 0.009);

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    addBar(seventhGroup, Math.cos(a) * 0.28, Math.sin(a) * 0.28, Math.cos(a) * seventhR, Math.sin(a) * seventhR, 0.008);
  }
  addRimJoints(seventhGroup, seventhR, 5, 0.022);

  const hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 8, 22), metalMat(pal0.metal, pal0.emit));
  const hubNut = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), metalMat(pal0.metal, pal0.emit));
  seventhGroup.add(hubRing, hubNut);
  metalExtras.push(hubRing, hubNut);
  addTrack(seventhGroup, seventhR, seventhTube);
  if (cfg.extra >= 2) addGyro(seventhGroup, seventhR, seventhTube);

  const cage = new THREE.Group();
  const cageN = cfg.extra >= 2 ? 3 : cfg.extra >= 1 ? 2 : 1;
  for (let i = 0; i < cageN; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.55 + i * 0.22, 0.028, 6, 42),
      metalMat(pal0.metal, pal0.emit)
    );
    ring.rotation.x = 0.4 + i * 0.55;
    ring.rotation.y = i * 0.7;
    cage.add(ring);
    metalExtras.push(ring);
  }
  scene.add(cage);

  const fire = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.08, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xf0d078, transparent: true, opacity: 0.35 })
  );
  const hearth = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 14, 12),
    new THREE.MeshBasicMaterial({ color: 0xf0d078, transparent: true, opacity: 0.2 })
  );
  const fire2 = new THREE.Mesh(
    new THREE.TorusGeometry(0.88, 0.045, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xf0d078, transparent: true, opacity: 0.22 })
  );
  scene.add(fire, hearth, fire2);

  const coalGroup = new THREE.Group();
  const coalMat = new THREE.MeshBasicMaterial({ color: 0xf0d078, transparent: true, opacity: 0.38 });
  const coalN = cfg.extra >= 2 ? 14 : cfg.extra >= 1 ? 9 : 5;
  for (let i = 0; i < coalN; i++) {
    const coal = new THREE.Mesh(new THREE.SphereGeometry(0.035 + throne.rng() * 0.045, 6, 5), coalMat);
    const a = (i / coalN) * Math.PI * 2;
    coal.position.set(Math.cos(a) * 0.52, (throne.rng() - 0.5) * 0.18, Math.sin(a) * 0.52);
    coalGroup.add(coal);
  }
  scene.add(coalGroup);

  const faces = new THREE.Group();
  const faceMat = new THREE.MeshBasicMaterial({
    color: 0xc9a227,
    transparent: true,
    opacity: 0.11,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const faceSolid = metalMat(pal0.metal, pal0.emit);
  faceSolid.transparent = true;
  faceSolid.opacity = 0.55;
  faceSolid.depthWrite = false;

  function placeFace(group, a, lift) {
    group.position.set(Math.cos(a) * 1.28, lift, Math.sin(a) * 1.28);
    group.lookAt(0, 0, 0);
    faces.add(group);
  }

  const man = new THREE.Group();
  man.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), faceSolid));
  const manEyeL = new THREE.Mesh(new THREE.CircleGeometry(0.045, 8), faceMat);
  const manEyeR = manEyeL.clone();
  manEyeL.position.set(-0.07, 0.04, 0.2);
  manEyeR.position.set(0.07, 0.04, 0.2);
  man.add(manEyeL, manEyeR);
  placeFace(man, 0, 0.18);

  const lion = new THREE.Group();
  lion.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), faceSolid));
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 6), faceSolid);
  const earR = earL.clone();
  earL.position.set(-0.16, 0.16, 0.04);
  earR.position.set(0.16, 0.16, 0.04);
  earL.rotation.z = 0.4;
  earR.rotation.z = -0.4;
  lion.add(earL, earR);
  placeFace(lion, Math.PI * 0.5, 0.12);

  const ox = new THREE.Group();
  ox.add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), faceSolid));
  const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 6), faceSolid);
  const hornR = hornL.clone();
  hornL.position.set(-0.14, 0.22, 0.02);
  hornR.position.set(0.14, 0.22, 0.02);
  hornL.rotation.z = 0.55;
  hornR.rotation.z = -0.55;
  ox.add(hornL, hornR);
  placeFace(ox, Math.PI, 0.08);

  const eagle = new THREE.Group();
  eagle.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), faceSolid));
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), faceSolid);
  beak.rotation.x = Math.PI * 0.5;
  beak.position.set(0, -0.02, 0.22);
  eagle.add(beak);
  placeFace(eagle, Math.PI * 1.5, 0.22);

  for (let i = 0; i < 4; i++) {
    const ghost = new THREE.Mesh(new THREE.CircleGeometry(0.34, 14), faceMat);
    const a = (i / 4) * Math.PI * 2 + 0.4;
    ghost.position.set(Math.cos(a) * 1.05, Math.sin(a * 3) * 0.35, Math.sin(a) * 1.05);
    ghost.lookAt(0, 0, 0);
    faces.add(ghost);
  }
  scene.add(faces);

  const es = cfg.eyeSeg;
  const outerEyes = makeEyeField(outerR, outerTube, cfg.uSeg, cfg.vSeg, 0.34, es);
  const innerEyes = makeEyeField(innerR, innerTube, Math.max(8, cfg.uSeg - 2), Math.max(5, cfg.vSeg - 1), 0.32, es);
  const thirdEyes = makeEyeField(thirdR, thirdTube, Math.max(7, cfg.uSeg - 4), Math.max(4, cfg.vSeg - 2), 0.28, es);
  const fourthEyes = makeEyeField(fourthR, fourthTube, Math.max(6, cfg.uSeg - 6), Math.max(4, cfg.vSeg - 3), 0.2, es);
  const fifthEyes = makeEyeField(fifthR, fifthTube, Math.max(6, cfg.uSeg - 8), Math.max(4, cfg.vSeg - 4), 0.22, es);
  const sixthEyes = makeEyeField(sixthR, sixthTube, Math.max(5, cfg.uSeg - 8), Math.max(3, cfg.vSeg - 5), 0.16, es);
  const seventhEyes = makeEyeField(seventhR, seventhTube, Math.max(5, cfg.uSeg - 10), Math.max(3, cfg.vSeg - 5), 0.2, es);
  const eighthEyes = makeEyeField(eighthR, eighthTube, Math.max(4, cfg.uSeg - 10), Math.max(3, cfg.vSeg - 6), 0.12, es);
  outerGroup.add(outerEyes.mesh);
  innerGroup.add(innerEyes.mesh);
  thirdGroup.add(thirdEyes.mesh);
  fourthGroup.add(fourthEyes.mesh);
  fifthGroup.add(fifthEyes.mesh);
  sixthGroup.add(sixthEyes.mesh);
  seventhGroup.add(seventhEyes.mesh);
  eighthGroup.add(eighthEyes.mesh);

  const eyeFields = [outerEyes, innerEyes, thirdEyes, fourthEyes, fifthEyes, sixthEyes, seventhEyes, eighthEyes];
  if (cfg.extra >= 1) {
    const ninthEyes = makeEyeField(ninthR, ninthTube, Math.max(6, cfg.uSeg - 8), Math.max(3, cfg.vSeg - 5), 0.14, es);
    ninthGroup.add(ninthEyes.mesh);
    eyeFields.push(ninthEyes);
  }
  if (cfg.extra >= 2) {
    const tenthEyes = makeEyeField(tenthR, tenthTube, Math.max(5, cfg.uSeg - 10), Math.max(3, cfg.vSeg - 6), 0.16, es);
    tenthGroup.add(tenthEyes.mesh);
    eyeFields.push(tenthEyes);
    if (gyros[0]) {
      const gyroEyes = makeEyeField(outerR * 0.9, outerTube * 0.42, Math.max(6, cfg.uSeg - 8), Math.max(3, cfg.vSeg - 5), 0.18, es);
      gyros[0].add(gyroEyes.mesh);
      eyeFields.push(gyroEyes);
    }
  }

  const wingMat = new THREE.MeshBasicMaterial({
    color: 0xf0d078,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wingCount = cfg.extra >= 2 ? 16 : 12;
  for (let i = 0; i < wingCount; i++) {
    const wing = new THREE.Mesh(new THREE.CircleGeometry(1.45 + (i % 4) * 0.1, 24), wingMat.clone());
    wing.scale.set(1.55 + (i % 4) * 0.12, 0.48 + (i % 3) * 0.08, 1);
    wing.rotation.y = (i / wingCount) * Math.PI * 2;
    wing.rotation.z = 0.42 * ((i % 2) * 2 - 1);
    wing.rotation.x = 0.2 * ((i % 3) - 1);
    wing.position.y = ((i % 4) - 1.5) * 0.1;
    wing.userData.veil = i % 3 === 0;
    wingGroup.add(wing);
  }

  // One hub eye for the "true name" aspect.
  const hubGeom = new THREE.CircleGeometry(1, 48);
  const hubMat = outerEyes.mat.clone();
  hubMat.uniforms = THREE.UniformsUtils.clone(outerEyes.mat.uniforms);
  const hubEye = new THREE.Mesh(hubGeom, hubMat);
  hubEye.scale.set(1.18, 0.73, 1);
  hubEye.visible = false;
  scene.add(hubEye);

  const likenessSkin = new THREE.MeshBasicMaterial({
    color: 0xc4a056,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const likenessShade = new THREE.MeshBasicMaterial({
    color: 0x1a1008,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const boyEyeMat = outerEyes.mat.clone();
  boyEyeMat.uniforms = THREE.UniformsUtils.clone(outerEyes.mat.uniforms);
  const likenessGroup = new THREE.Group();
  likenessGroup.visible = false;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.78, 18, 14), likenessSkin);
  skull.scale.set(0.82, 1.06, 0.64);
  const brow = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 20, Math.PI), likenessSkin);
  brow.rotation.x = Math.PI;
  brow.position.set(0, 0.22, 0.42);
  brow.scale.set(1.05, 0.55, 0.8);
  const boyEyeL = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), boyEyeMat);
  const boyEyeR = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), boyEyeMat);
  boyEyeL.scale.set(1, 0.58, 1);
  boyEyeR.scale.set(1, 0.58, 1);
  boyEyeL.position.set(-0.26, 0.12, 0.62);
  boyEyeR.position.set(0.26, 0.12, 0.62);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 7), likenessSkin);
  nose.rotation.x = Math.PI * 0.55;
  nose.position.set(0, -0.02, 0.62);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 18, Math.PI * 1.05), likenessShade);
  mouth.rotation.x = Math.PI * 0.55;
  mouth.position.set(0, -0.28, 0.5);
  mouth.scale.set(1.15, 0.45, 1);
  likenessGroup.add(skull, brow, boyEyeL, boyEyeR, nose, mouth);
  likenessGroup.position.set(0, 0.06, 1.45);
  likenessGroup.renderOrder = 8;
  scene.add(likenessGroup);

  const tearMat = new THREE.MeshBasicMaterial({
    color: 0x7a1a1e,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const tearGroup = new THREE.Group();
  const tearN = cfg.extra >= 2 ? 52 : cfg.extra >= 1 ? 34 : 18;
  const tearGeom = new THREE.SphereGeometry(0.042, 8, 8);
  for (let i = 0; i < tearN; i++) {
    const drop = new THREE.Mesh(tearGeom, tearMat);
    drop.scale.set(0.7, 1.7, 0.7);
    drop.visible = false;
    drop.userData = { vx: 0, vy: 0, vz: 0, delay: 0, born: 0 };
    tearGroup.add(drop);
  }
  scene.add(tearGroup);

  function seedTears() {
    tearGroup.children.forEach((drop) => {
      const a = throne.rng() * Math.PI * 2;
      const r = 1.15 + throne.rng() * 2.05;
      drop.position.set(Math.cos(a) * r, 0.35 + throne.rng() * 1.15, Math.sin(a) * r);
      drop.userData.vx = (throne.rng() - 0.5) * 0.05;
      drop.userData.vy = -0.14 - throne.rng() * 0.16;
      drop.userData.vz = (throne.rng() - 0.5) * 0.05;
      drop.userData.delay = throne.rng() * 3.2;
      drop.userData.born = 0;
      drop.visible = true;
    });
  }

  const clock = new THREE.Clock();
  let outerAngle = 0;
  let lastCycle = 0;
  let paletteIndex = 0;
  let paletteMix = 0;
  let running = true;
  let distantEye = -1;
  let distantUntil = 0;
  let aspect = {
    id: "witness",
    blink: 1,
    look: 1,
    pupil: 1,
    spin: 1,
    camZ: 4.7,
    third: 1,
    fifth: 1,
    sixth: 1,
    ninth: 1,
    tenth: 1,
    wings: 0,
    hub: 0,
    fog: 0.01,
    fire: 1,
    host: 1,
    presence: 1,
    fogCol: new THREE.Color("#0c0912"),
    sclera: new THREE.Color("#f3ebd6"),
    palLock: -1,
  };
  let spinBoost = 1;
  let zNudge = 0;
  let viewRadius = 4.8;
  let pulseScale = 1;
  let yaw = 0.22;
  let pitch = 0.1;
  let adaptDpr = cfg.dpr;
  let slowStreak = 0;
  let offerAge = 0;
  let offering = false;
  let wounding = false;
  let woundAge = 0;
  let bleeding = false;
  let bleedAge = 0;
  let slain = false;
  let slayAge = 0;
  let likenessOn = false;
  let likenessPhase = "idle";
  let likenessAge = 0;
  let likeness = 0;
  let likenessNeedsRestore = false;
  let weeping = false;
  let weep = 0;
  let weepAge = 0;
  let ascended = false;
  let ascendAge = 0;

  function orbitTarget(radius, shakeAmt) {
    const cp = Math.cos(pitch);
    const tx = Math.sin(yaw) * cp * radius;
    const ty = Math.sin(pitch) * radius * 0.7;
    const tz = Math.cos(yaw) * cp * radius;
    const dist = Math.hypot(tx, ty, tz) || 1;
    const s = radius / dist;
    return {
      x: tx * s + Math.sin(throne.time * 0.07) * shakeAmt,
      y: ty * s + Math.sin(throne.time * 0.05) * shakeAmt * 0.5,
      z: tz * s,
    };
  }

  function placeOrbitCamera(radius, shakeAmt) {
    const p = orbitTarget(radius, shakeAmt);
    camera.position.set(p.x, p.y, p.z);
    camera.lookAt(0, 0, 0);
  }

  function resize() {
    const w = root.clientWidth || window.innerWidth;
    const h = root.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  resize();
  placeOrbitCamera(viewRadius, 0);
  window.addEventListener("resize", resize);

  function applyPalette(index, dt) {
    const pal = PALETTES[index];
    const mats = [...eyeFields.map((f) => f.mat), hubMat, boyEyeMat];
    for (const m of mats) {
      m.uniforms.uIrisA.value.lerp(pal.irisA, Math.min(1, dt * 1.8));
      m.uniforms.uIrisB.value.lerp(pal.irisB, Math.min(1, dt * 1.8));
    }
    const tint = [outerMesh, innerMesh, thirdMesh, fourthMesh, fifthMesh, sixthMesh, seventhMesh, eighthMesh, ...spokes, ...metalExtras];
    for (const mesh of tint) {
      if (!mesh.material) continue;
      mesh.material.color.lerp(new THREE.Color(pal.metal), Math.min(1, dt * 1.2));
      if (mesh.material.emissive) mesh.material.emissive.lerp(new THREE.Color(pal.emit), Math.min(1, dt * 1.2));
    }
    faceSolid.color.lerp(new THREE.Color(pal.metal), Math.min(1, dt * 1.2));
    if (faceSolid.emissive) faceSolid.emissive.lerp(new THREE.Color(pal.emit), Math.min(1, dt * 1.2));
    likenessSkin.color.lerp(new THREE.Color(pal.metal).offsetHSL(0.02, 0.08, 0.12), Math.min(1, dt * 1.2));
    key.color.lerp(new THREE.Color(pal.metal), Math.min(1, dt));
  }

  function applyAspectUniforms() {
    const mats = [...eyeFields.map((f) => f.mat), hubMat, boyEyeMat];
    for (const m of mats) {
      m.uniforms.uBlinkAllow.value = aspect.blink * (1 - weep * 0.88);
      m.uniforms.uLookGain.value = aspect.look * (throne.raptured ? 2.4 : 1);
      m.uniforms.uPupilMul.value = aspect.pupil;
      m.uniforms.uSclera.value.copy(aspect.sclera);
      m.uniforms.uWeep.value = weep;
    }
  }

  function setRimPresence(amount) {
    for (const field of eyeFields) {
      for (let i = 0; i < field.count; i++) {
        field.alive[i] = amount;
      }
      field.mesh.geometry.attributes.aAlive.needsUpdate = true;
    }
  }

  function tick() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    throne.time = t;

    if (weeping) {
      weepAge += dt;
      if (weepAge < 1.6) weep = Math.min(1, weepAge / 1.6);
      else if (weepAge < 9.5) weep = 1;
      else {
        weep = Math.max(0, 1 - (weepAge - 9.5) / 11);
        if (weep <= 0.001) {
          weep = 0;
          weeping = false;
          tearGroup.children.forEach((d) => {
            d.visible = false;
          });
        }
      }
    } else {
      weep += (0 - weep) * Math.min(1, dt * 1.2);
    }
    if (slain) {
      weeping = false;
      weep += (0 - weep) * Math.min(1, dt * 1.4);
    }

    const calm = throne.calm ? 1 : 0;
    const rim = Math.max(0, Math.min(1, throne.rim ?? 0.37));
    const rimSpin = (slain || throne.lore.offered || throne.raptured) ? 1 : (1.28 - rim * 0.42);
    if (likenessOn && !slain && !offering) {
      likenessAge += dt;
      if (likenessPhase === "form") {
        const u = Math.min(1, likenessAge / 5.8);
        likeness = u * u * (3 - 2 * u);
        if (u >= 1) {
          likeness = 1;
          likenessPhase = "hold";
          likenessAge = 0;
        }
      } else if (likenessPhase === "hold") {
        likeness = 1;
        if (likenessAge > 6.2) {
          likenessPhase = "fade";
          likenessAge = 0;
        }
      } else if (likenessPhase === "fade") {
        const u = Math.min(1, likenessAge / 22);
        likeness = 1 - u * u * (3 - 2 * u);
        if (u >= 1) {
          likeness = 0;
          likenessOn = false;
          likenessPhase = "idle";
        }
      }
    } else if (slain || offering) {
      likenessOn = false;
      likeness = 0;
      likenessPhase = "idle";
    }

    const grave = 0.42;
    const spin = (throne.calm ? 0.08 : 1) * aspect.spin * (throne.raptured ? 1.2 : 1) * spinBoost * rimSpin * grave * (1 + throne.fall * 3.2) * (1 - likeness * 0.94);

    outerGroup.rotation.y += dt * 0.16 * spin;
    outerGroup.rotation.z += dt * 0.03 * spin;
    outerGroup.rotation.x += dt * 0.014 * spin;
    innerGroup.rotation.x += dt * 0.18 * spin;
    innerGroup.rotation.y += dt * 0.05 * spin;
    innerGroup.rotation.z += dt * 0.022 * spin;
    thirdGroup.rotation.y += dt * 0.2 * spin;
    thirdGroup.rotation.z += dt * 0.07 * spin;
    fourthGroup.rotation.x += dt * 0.12 * spin;
    fourthGroup.rotation.y += dt * -0.08 * spin;
    fifthGroup.rotation.z += dt * 0.16 * spin;
    fifthGroup.rotation.y += dt * 0.06 * spin;
    sixthGroup.rotation.x += dt * -0.1 * spin;
    sixthGroup.rotation.z += dt * 0.05 * spin;
    seventhGroup.rotation.y += dt * 0.22 * spin;
    seventhGroup.rotation.x += dt * 0.08 * spin;
    eighthGroup.rotation.z += dt * -0.07 * spin;
    eighthGroup.rotation.y += dt * 0.04 * spin;
    ninthGroup.rotation.y += dt * 0.11 * spin;
    ninthGroup.rotation.z += dt * -0.055 * spin;
    tenthGroup.rotation.x += dt * 0.18 * spin;
    tenthGroup.rotation.y += dt * -0.13 * spin;
    gyros.forEach((g, i) => {
      g.rotation.y += dt * 0.16 * spin * (i % 2 ? -1 : 1);
      g.rotation.z += dt * 0.03 * spin;
    });
    cage.rotation.y += dt * 0.032 * spin;
    cage.rotation.x += dt * 0.012 * Math.sin(t * 0.09);
    coalGroup.rotation.y += dt * 0.2 * Math.abs(spin);
    coalGroup.children.forEach((c, i) => {
      c.position.y = Math.sin(t * 0.55 + i * 0.4) * 0.05;
    });
    fire.rotation.y += dt * 0.22 * spin;
    fire.rotation.x = Math.sin(t * 0.18) * 0.16;
    fire2.rotation.y += dt * -0.16 * spin;
    fire2.rotation.z = Math.sin(t * 0.14) * 0.1;
    const fireMul = aspect.fire || 1;
    hearth.scale.setScalar((0.88 + Math.sin(t * 0.42) * 0.06) * Math.max(0.4, fireMul));
    hearth.material.opacity = (0.14 + Math.abs(Math.sin(t * 0.55)) * 0.07) * fireMul;
    fire.material.opacity = 0.2 * fireMul;
    fire.scale.setScalar(0.78 + fireMul * 0.38);
    fire2.material.opacity = 0.12 * fireMul;
    fire2.scale.setScalar(0.74 + fireMul * 0.32);
    coalMat.opacity = 0.18 * fireMul + Math.abs(Math.sin(t * 0.7)) * 0.1;
    faces.rotation.y += dt * 0.06 * spin;
    looseGroup.rotation.y += dt * 0.05 * spin;
    looseGroup.rotation.x = Math.sin(t * 0.08) * 0.12;
    host.rotation.y += dt * 0.01 * Math.abs(spin);
    const hostTarget = ascended
      ? 1.38
      : (aspect.host || 1) * (slain ? 0.18 : (0.52 + rim * 1.95));
    const hostEase = ascended ? 0.28 : 2;
    host.scale.setScalar(host.scale.x + (hostTarget - host.scale.x) * Math.min(1, dt * hostEase));
    const hostOp = 0.05 + Math.min(0.28, hostTarget * 0.08);
    hostMat.opacity += (hostOp - hostMat.opacity) * Math.min(1, dt * 2);
    kernel.visible = !throne.lore.offered && !ascended;
    kernel.rotation.y += dt * 0.03;
    kernel.position.y = Math.sin(t * 0.22) * 0.03;
    pulseScale += (1 - pulseScale) * Math.min(1, dt * 0.65);
    const ps = pulseScale;
    if (!slain && !offering) {
      outerGroup.scale.setScalar(ps);
      innerGroup.scale.setScalar(2 - ps);
    }
    if (wounding) {
      woundAge += dt;
      scene.fog.color.lerp(new THREE.Color("#4a1020"), 0.03);
      spinBoost = -0.72;
      if (woundAge > 5.2) {
        wounding = false;
        spinBoost = 1;
      }
    }
    if (bleeding) {
      bleedAge += dt;
      scene.fog.density += (0.1 - scene.fog.density) * 0.08;
      hubEye.visible = true;
      hubEye.lookAt(camera.position);
      hubEye.scale.setScalar(Math.min(1.8, 0.4 + bleedAge * 0.16));
    }
    if (offering) {
      offerAge += dt;
      const shrink = Math.max(0.16, 1 - offerAge * 0.055);
      outerGroup.scale.setScalar(ps * shrink);
      innerGroup.scale.setScalar(Math.max(0.12, (2 - ps) * shrink));
      fourthGroup.scale.setScalar(Math.min(1.15, 0.45 + offerAge * 0.055));
      fifthGroup.scale.setScalar(Math.max(0.12, shrink));
      sixthGroup.scale.setScalar(Math.max(0.18, shrink * 0.9));
      ninthGroup.scale.setScalar(Math.max(0.1, shrink));
      tenthGroup.scale.setScalar(Math.max(0.1, shrink * 0.85));
      cage.scale.setScalar(Math.max(0.12, shrink));
      yaw += (0 - yaw) * Math.min(1, dt * 0.45);
      pitch += (0.06 - pitch) * Math.min(1, dt * 0.45);
      scene.fog.density += (0.04 - scene.fog.density) * 0.05;
      scene.fog.color.lerp(new THREE.Color("#f3e6c4"), 0.03);
    }
    if (slain) {
      slayAge += dt;
      const shrink = Math.max(0.05, 1 - slayAge * 0.08);
      outerGroup.scale.setScalar(ps * shrink);
      innerGroup.scale.setScalar(Math.max(0.06, (2 - ps) * shrink));
      fifthGroup.scale.setScalar(Math.max(0.05, shrink * 0.7));
      sixthGroup.scale.setScalar(Math.max(0.05, shrink * 0.55));
      ninthGroup.scale.setScalar(Math.max(0.05, shrink * 0.6));
      tenthGroup.scale.setScalar(Math.max(0.05, shrink * 0.5));
      cage.scale.setScalar(Math.max(0.08, shrink * 0.4));
      spinBoost = 0.02;
      scene.fog.density += (0.09 - scene.fog.density) * 0.06;
      scene.fog.color.lerp(new THREE.Color("#1a0608"), 0.04);
    }
    if (!slain) {
      spinBoost += (1 - spinBoost) * Math.min(1, dt * 0.5);
    }
    if (!document.body.classList.contains("gazing")) {
      zNudge *= ascended ? 0.82 : 0.97;
    }
    if (likeness > 0.01 && !ascended) {
      zNudge += (-1.05 * likeness - zNudge) * Math.min(1, dt * 0.4);
      yaw += (0.015 - yaw) * Math.min(1, dt * 0.28 * likeness);
      pitch += (0.045 - pitch) * Math.min(1, dt * 0.28 * likeness);
    }
    wingGroup.rotation.y += dt * 0.12 * Math.abs(spin);
    wingGroup.rotation.x = Math.sin(t * 0.12) * 0.05;

    const thirdTarget = aspect.third;
    const s = thirdGroup.scale.x;
    const next = s + (thirdTarget - s) * Math.min(1, dt * 0.85);
    thirdGroup.scale.setScalar(Math.max(0.001, next));
    if (!offering) {
      const e5 = fifthGroup.scale.x + ((aspect.fifth || 1) - fifthGroup.scale.x) * Math.min(1, dt * 0.7);
      const e6 = sixthGroup.scale.x + ((aspect.sixth || 1) - sixthGroup.scale.x) * Math.min(1, dt * 0.7);
      const e9 = ninthGroup.scale.x + ((aspect.ninth == null ? 1 : aspect.ninth) - ninthGroup.scale.x) * Math.min(1, dt * 0.7);
      const e10 = tenthGroup.scale.x + ((aspect.tenth == null ? 1 : aspect.tenth) - tenthGroup.scale.x) * Math.min(1, dt * 0.7);
      fifthGroup.scale.setScalar(Math.max(0.05, e5));
      sixthGroup.scale.setScalar(Math.max(0.05, e6));
      ninthGroup.scale.setScalar(Math.max(0.05, e9));
      tenthGroup.scale.setScalar(Math.max(0.05, e10));
      const cageTarget = slain ? 0.2 : 1;
      cage.scale.setScalar(cage.scale.x + (cageTarget - cage.scale.x) * Math.min(1, dt * 0.55));
      if (!ascended) {
        const rimFog = 0.0015 + rim * 0.064;
        const fogTarget = slain
          ? (aspect.fog == null ? 0.08 : aspect.fog)
          : ((aspect.fog == null ? 0.01 : aspect.fog) * 0.32 + rimFog * 0.88);
        scene.fog.density += (fogTarget - scene.fog.density) * Math.min(1, dt * 0.45);
        if (aspect.fogCol) scene.fog.color.lerp(aspect.fogCol, Math.min(1, dt * 0.5));
      }
    }

    wingGroup.visible = !throne.calm;
    const wingUp = aspect.wings > 0.5;
    wingGroup.scale.setScalar(wingUp ? 1.55 : 0.92);
    const wingOp = wingUp ? 0.55 : 0.08;
    wingGroup.children.forEach((w) => {
      if (w.material) w.material.opacity = w.userData.veil && !wingUp ? 0.12 : wingOp;
    });
    hubEye.visible = !ascended && (aspect.hub > 0.5 || throne.lore.offered) && likeness < 0.12;
    if (hubEye.visible) {
      hubEye.lookAt(camera.position);
      if (throne.lore.offered) {
        const grow = Math.min(2.2, 0.35 + offerAge * 0.22);
        hubEye.scale.setScalar(grow);
      } else {
        hubEye.scale.setScalar(1 + (pulseScale - 1) * 1.1);
      }
    }

    const L = likeness;
    if (L > 0.001 && !slain && !offering) {
      outerGroup.scale.x *= (0.78 + (1 - L) * 0.22) * (1 - L * 0.18);
      outerGroup.scale.y *= 1 + L * 0.38;
      outerGroup.scale.z *= 1 - L * 0.72;
      innerGroup.position.set(-0.5 * L, 0.28 * L, 1.2 * L);
      innerGroup.scale.x *= 1 - L * 0.68;
      innerGroup.scale.y *= 1 - L * 0.68;
      innerGroup.scale.z *= 1 - L * 0.78;
      thirdGroup.position.set(0.5 * L, 0.28 * L, 1.2 * L);
      thirdGroup.scale.multiplyScalar(1 - L * 0.64);
      fifthGroup.position.set(0, 0.02 * L, 1.35 * L);
      fifthGroup.scale.multiplyScalar(1 - L * 0.74);
      seventhGroup.position.set(0, -0.52 * L, 1.15 * L);
      seventhGroup.scale.x *= 1 - L * 0.38;
      seventhGroup.scale.y *= 1 - L * 0.82;
      seventhGroup.scale.z *= 1 - L * 0.58;
      fourthGroup.position.z = -0.45 * L;
      fourthGroup.scale.multiplyScalar(1 - L * 0.4);
      sixthGroup.position.z = -0.55 * L;
      sixthGroup.scale.multiplyScalar(1 - L * 0.48);
      eighthGroup.scale.multiplyScalar(1 - L * 0.35);
      ninthGroup.scale.multiplyScalar(1 - L * 0.4);
      tenthGroup.scale.multiplyScalar(1 - L * 0.45);
      cage.scale.multiplyScalar(1 - L * 0.28);
      faces.scale.setScalar(1 - L * 0.72);
      looseGroup.scale.setScalar(1 - L * 0.55);
      fire.position.y = -0.48 * L;
      fire.scale.x *= 1 - L * 0.25;
      fire.scale.y *= 1 - L * 0.7;
      fire.material.opacity = (0.2 * (aspect.fire || 1)) * (1 - L * 0.55);
      fire2.material.opacity = 0.12 * (aspect.fire || 1) * (1 - L * 0.7);
      likenessGroup.visible = true;
      likenessGroup.lookAt(camera.position);
      likenessGroup.scale.setScalar(0.95 + L * 1.15);
      likenessSkin.opacity = 0.4 + L * 0.52;
      likenessShade.opacity = 0.35 + L * 0.5;
      boyEyeL.scale.setScalar(0.7 + L * 0.55);
      boyEyeR.scale.setScalar(0.7 + L * 0.55);
      setRimPresence((aspect.presence || 1) * (1 - L * 0.88));
    } else {
      innerGroup.position.set(0, 0, 0);
      thirdGroup.position.set(0, 0, 0);
      fifthGroup.position.set(0, 0, 0);
      seventhGroup.position.set(0, 0, 0);
      fourthGroup.position.z = 0;
      sixthGroup.position.z = 0;
      fire.position.y = 0;
      faces.scale.setScalar(1);
      looseGroup.scale.setScalar(1);
      likenessGroup.visible = false;
      likenessSkin.opacity = 0;
      likenessShade.opacity = 0;
      if (likenessNeedsRestore) {
        setRimPresence(aspect.presence || 1);
        likenessNeedsRestore = false;
      }
    }

    outerAngle += dt * 0.35 * Math.abs(spin);
    if (outerAngle - lastCycle > Math.PI * 2) {
      lastCycle = outerAngle;
      window.dispatchEvent(new CustomEvent("throne:cycle"));
    }

    if (aspect.palLock >= 0) {
      paletteIndex = aspect.palLock;
    } else {
      paletteMix += dt * (throne.calm ? 0.02 : 0.035);
      if (paletteMix > 8) {
        paletteMix = 0;
        paletteIndex = (paletteIndex + 1) % PALETTES.length;
        throne.palette = paletteIndex;
        document.body.classList.remove("palette-gold", "palette-white", "palette-violet");
        document.body.classList.add(["palette-gold", "palette-white"][paletteIndex] || "palette-gold");
      }
    }
    applyPalette(paletteIndex, dt);
    applyAspectUniforms();
    if (likeness > 0.2) {
      boyEyeMat.uniforms.uBlinkAllow.value = 0;
      boyEyeMat.uniforms.uLookGain.value = 2.4;
    }

    const falling = throne.fall > 0.001;
    if (ascended) {
      ascendAge += dt;
      father.visible = true;
      hubEye.visible = false;
      weeping = false;
      weep += (0 - weep) * Math.min(1, dt * 0.8);
      const easeIn = Math.min(1, ascendAge / 6.4);
      const s = easeIn * easeIn * (3 - 2 * easeIn);
      const hx = 0;
      const hy = 0.14;
      const hz = 0.22;
      camera.position.x += (hx - camera.position.x) * Math.min(1, dt * (0.16 + s * 0.2));
      camera.position.y += (hy - camera.position.y) * Math.min(1, dt * (0.16 + s * 0.2));
      camera.position.z += (hz - camera.position.z) * Math.min(1, dt * (0.16 + s * 0.2));
      const lookY = father.position.y + 0.72 + Math.sin(t * 0.08) * 0.03;
      camera.lookAt(father.position.x, lookY, father.position.z);
      const fovWant = 58;
      camera.fov += (fovWant - camera.fov) * Math.min(1, dt * 0.07);
      camera.updateProjectionMatrix();
      yaw = 0;
      pitch = 0.04;
      zNudge = 0;
      father.lookAt(camera.position.x, camera.position.y + 0.15, camera.position.z);
      father.rotation.x += (0.08 - father.rotation.x) * Math.min(1, dt * 0.12);
      scene.fog.density += (0.016 - scene.fog.density) * Math.min(1, dt * 0.32);
      scene.fog.color.lerp(new THREE.Color("#1a0e08"), Math.min(1, dt * 0.38));
      key.intensity += (1.15 - key.intensity) * Math.min(1, dt * 0.2);
    } else {
      const rimZ = 2.35 + rim * 10.5;
      const rimBlend = (slain || offering || throne.lore.offered || falling || throne.raptured) ? 0 : 0.82;
      const baseZ = throne.raptured ? 0.78 : (aspect.camZ * (1 - rimBlend) + rimZ * rimBlend);
      const targetRadius = falling
        ? Math.max(0.06, (aspect.camZ + zNudge) * (1 - throne.fall) * 0.42)
        : baseZ + zNudge;
      const gazing = document.body.classList.contains("gazing");
      viewRadius += (targetRadius - viewRadius) * (falling ? 0.12 : 0.08);
      const fovBase = falling ? 32 + throne.fall * 86 : (throne.raptured ? 88 : (41 - likeness * 7));
      const fovTarget = (gazing && !falling && !throne.raptured) ? fovBase - 2.2 : fovBase;
      camera.fov += (fovTarget - camera.fov) * (falling ? 0.12 : 0.055);
      camera.updateProjectionMatrix();
      const shake = (gazing || throne.calm) ? 0 : (throne.raptured ? 0.01 : 0.014);
      const want = orbitTarget(viewRadius, shake);
      const ease = falling ? 0.18 : (gazing ? 0.048 : 0.1);
      camera.position.x += (want.x - camera.position.x) * ease;
      camera.position.y += (want.y - camera.position.y) * ease;
      camera.position.z += (want.z - camera.position.z) * ease;
      if (!falling) {
        const d = Math.hypot(camera.position.x, camera.position.y, camera.position.z) || 1;
        const minD = viewRadius * 0.972;
        const maxD = viewRadius * 1.018;
        if (d < minD) camera.position.multiplyScalar(minD / d);
        else if (d > maxD) camera.position.multiplyScalar(maxD / d);
      }
      camera.lookAt(0, 0, 0);
    }

    const mouse = new THREE.Vector2(throne.mouse.ndcX, throne.mouse.ndcY);
    for (const field of eyeFields) {
      field.mat.uniforms.uTime.value = t;
      field.mat.uniforms.uMouse.value.copy(mouse);
      field.mat.uniforms.uCalm.value = calm;
      field.mat.uniforms.uWeep.value = weep;
    }
    hubMat.uniforms.uTime.value = t;
    hubMat.uniforms.uMouse.value.copy(mouse);
    hubMat.uniforms.uCalm.value = calm;
    hubMat.uniforms.uWeep.value = weep;
    boyEyeMat.uniforms.uTime.value = t;
    boyEyeMat.uniforms.uMouse.value.copy(mouse);
    boyEyeMat.uniforms.uCalm.value = calm;
    boyEyeMat.uniforms.uWeep.value = weep;

    if (weep > 0.02) {
      tearMat.opacity = 0.38 + weep * 0.5;
      tearMat.color.setHex(0xa21822);
      tearGroup.children.forEach((drop) => {
        drop.userData.born += dt;
        if (drop.userData.born < drop.userData.delay) return;
        drop.position.x += drop.userData.vx * dt;
        drop.position.y += drop.userData.vy * dt;
        drop.position.z += drop.userData.vz * dt;
        drop.rotation.z += dt * 0.15;
        if (drop.position.y < -3.4) {
          const a = throne.rng() * Math.PI * 2;
          const r = 1.15 + throne.rng() * 2.05;
          drop.position.set(Math.cos(a) * r, 0.45 + throne.rng() * 1.05, Math.sin(a) * r);
          drop.userData.delay = throne.rng() * 1.4;
          drop.userData.born = 0;
        }
      });
    } else {
      tearMat.opacity = 0;
    }

    if (distantEye >= 0 && t > distantUntil) {
      outerEyes.alive[distantEye] = 1;
      outerEyes.mesh.geometry.attributes.aAlive.needsUpdate = true;
      distantEye = -1;
    }

    key.position.set(Math.sin(t * 0.12) * 0.22, Math.cos(t * 0.09) * 0.16, 0.2);
    renderer.render(scene, camera);
    if (!falling && t > 2 && dt > 0.033) {
      slowStreak++;
      if (slowStreak > 24 && adaptDpr > 0.7) {
        adaptDpr = Math.max(0.7, Math.round(adaptDpr * 0.88 * 100) / 100);
        renderer.setPixelRatio(adaptDpr);
        slowStreak = 0;
      }
    } else {
      slowStreak = Math.max(0, slowStreak - 2);
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  return {
    /** A slow weight-shift when something is answered. */
    shudder() {
      if (throne.calm) return;
      pulseScale = 1.07;
    },
    /** Slider-release: force a previously "closed" eye open larger for a few seconds. */
    openDistantEye() {
      const idx = Math.floor(throne.rng() * outerEyes.count);
      distantEye = idx;
      distantUntil = clock.elapsedTime + 6;
      outerEyes.alive[idx] = 1.8;
      outerEyes.mesh.geometry.attributes.aAlive.needsUpdate = true;
    },
    setPalette(index) {
      paletteIndex = ((index % PALETTES.length) + PALETTES.length) % PALETTES.length;
      throne.palette = paletteIndex;
    },
    orbit(dx, dy) {
      if (ascended) return;
      yaw -= dx * 0.0017;
      pitch = Math.max(-0.52, Math.min(0.52, pitch + dy * 0.00125));
    },
    getOrbit() {
      return { yaw, pitch };
    },
    tilt(nx, ny) {
      this.orbit(nx * 18, ny * 12);
    },
    setRapture(on) {
      if (ascended) return;
      throne.raptured = !!on;
      document.documentElement.classList.toggle("raptured", !!on);
      scene.fog.density = on ? 0.14 : 0.022;
      pulseScale = on ? 1.06 : 0.96;
    },
    fallIn() {
      if (ascended) return;
      this.setAspect("unblinking");
      spinBoost = 1.8;
      pulseScale = 1.12;
      zNudge = -1.2;
      yaw = 0;
      pitch = 0;
      scene.fog.density = 0.002;
    },
    pulse() {
      pulseScale = 1.045;
    },
    nudgeZ(delta) {
      if (ascended) return;
      zNudge = Math.max(-3.2, Math.min(13.6, zNudge + delta));
    },
    setSpinBoost(n) {
      if (ascended) return;
      spinBoost = n;
    },
    offer() {
      if (ascended) return;
      offering = true;
      offerAge = 0;
      pulseScale = 1.08;
      zNudge = 0;
      scene.fog.density = 0.07;
      this.setAspect("offered");
    },
    wound() {
      if (ascended || slain) return;
      wounding = true;
      woundAge = 0;
      pulseScale = 1.08;
      spinBoost = -0.72;
      scene.fog.density = 0.06;
      this.setAspect("inverted");
    },
    bleed() {
      bleeding = true;
      bleedAge = 0;
      pulseScale = 0.72;
      hubEye.visible = true;
    },
    showFace() {
      hubEye.visible = true;
      this.setAspect("name");
      pulseScale = 1.06;
    },
    /** Wheels take a boy's look, hold it, then become wheels again. */
    wearFace() {
      if (slain || offering || ascended || throne.lore.offered) return;
      likenessOn = true;
      likenessPhase = "form";
      likenessAge = 0;
      likeness = 0;
      likenessNeedsRestore = true;
      pulseScale = 1.03;
    },
    /** Every lid wells. The boy has come back screaming. */
    weep() {
      if (slain || offering || ascended || throne.lore.offered) return;
      weeping = true;
      weepAge = 0;
      weep = 0;
      seedTears();
      pulseScale = 1.03;
    },
    /** You finish the boy. The count keeps the father. You are the looking. */
    ascend() {
      if (slain || offering || throne.lore.offered) return;
      ascended = true;
      ascendAge = 0;
      weeping = false;
      likenessOn = false;
      likeness = 0;
      offering = false;
      wounding = false;
      bleeding = false;
      father.visible = true;
      kernel.visible = false;
      hubEye.visible = false;
      pulseScale = 1.04;
      spinBoost = 0.62;
      this.setAspect("ascended");
    },
    slay() {
      slain = true;
      slayAge = 0;
      offering = false;
      wounding = false;
      pulseScale = 0.42;
      spinBoost = 0.02;
      scene.fog.density = 0.08;
      this.setAspect("slain");
    },
    /**
     * Rewrite the angel. Aspects change blink, gaze, extra rims, wings, hub eye, fog, fire, and spin.
     */
    setAspect(id) {
      const table = {
        witness: { blink: 1, look: 1.15, pupil: 1.1, spin: 1, camZ: 4.7, third: 1, fifth: 1, sixth: 1, ninth: 1, tenth: 1, wings: 0, hub: 0, presence: 1, fog: 0.01, fire: 1, host: 1, palLock: -1, sclera: "#f3ebd6", fogCol: "#0c0912" },
        unblinking: { blink: 0, look: 4.2, pupil: 2.2, spin: 0.18, camZ: 4.1, third: 1.25, fifth: 1.2, sixth: 0.7, ninth: 1.15, tenth: 0.8, wings: 0, hub: 0, presence: 1, fog: 0.002, fire: 0.2, host: 0.55, palLock: 1, sclera: "#ffffff", fogCol: "#1a1610" },
        merkavah: { blink: 1, look: 1.7, pupil: 1.25, spin: 2.35, camZ: 9.4, third: 1.35, fifth: 1.55, sixth: 2.05, ninth: 1.55, tenth: 1.7, wings: 0, hub: 0, presence: 1, fog: 0.004, fire: 1.7, host: 3.2, palLock: 0, sclera: "#f0d078", fogCol: "#1a0c04" },
        waters: { blink: 0.12, look: 0.35, pupil: 0.5, spin: 0.08, camZ: 10.4, third: 0.7, fifth: 1.85, sixth: 0.4, ninth: 0.45, tenth: 0.35, wings: 0, hub: 0, presence: 1, fog: 0.058, fire: 0.12, host: 0.25, palLock: 1, sclera: "#c8b8e0", fogCol: "#12081f" },
        seraph: { blink: 1, look: 2.4, pupil: 1.35, spin: 2.5, camZ: 5.0, third: 1.2, fifth: 1.2, sixth: 1.15, ninth: 1.25, tenth: 1.2, wings: 1, hub: 0, presence: 1, fog: 0.005, fire: 3.4, host: 1.6, palLock: 1, sclera: "#fff6d8", fogCol: "#2a1008" },
        inverted: { blink: 1, look: 2.4, pupil: 1.85, spin: -1.7, camZ: 5.1, third: 1, fifth: 1, sixth: 1.15, ninth: 1.1, tenth: 1.2, wings: 0, hub: 0, presence: 1, fog: 0.028, fire: 1.9, host: 0.7, palLock: 0, sclera: "#2a1014", fogCol: "#1a0608" },
        name: { blink: 0, look: 3.4, pupil: 1.85, spin: 0.18, camZ: 4.9, third: 0.45, fifth: 0.4, sixth: 0.35, ninth: 0.28, tenth: 0.22, wings: 0, hub: 1, presence: 0.12, fog: 0.012, fire: 0.5, host: 0.3, palLock: 0, sclera: "#f4f1e8", fogCol: "#100c08" },
        hush: { blink: 1, look: 0.15, pupil: 0.45, spin: 0.07, camZ: 10.2, third: 0.55, fifth: 0.5, sixth: 0.45, ninth: 0.4, tenth: 0.35, wings: 0, hub: 0, presence: 0.08, fog: 0.036, fire: 0.18, host: 0.22, palLock: 0, sclera: "#6a6048", fogCol: "#0a0808" },
        offered: { blink: 1, look: 0.4, pupil: 0.75, spin: 0.04, camZ: 4.6, third: 0.16, fifth: 0.16, sixth: 0.16, ninth: 0.14, tenth: 0.12, wings: 0, hub: 1, presence: 0.1, fog: 0.02, fire: 0.22, host: 0.15, palLock: 1, sclera: "#fff8ea", fogCol: "#f3e6c4" },
        ascended: { blink: 1, look: 0.28, pupil: 0.85, spin: 0.55, camZ: 0.22, third: 1.05, fifth: 1.1, sixth: 1.05, ninth: 1.08, tenth: 1.05, wings: 1, hub: 0, presence: 1, fog: 0.014, fire: 1.75, host: 1.35, palLock: 1, sclera: "#fff4dc", fogCol: "#1a0e08" },
        judged: { blink: 0.2, look: 3.1, pupil: 1.7, spin: -1.15, camZ: 5.5, third: 0.85, fifth: 0.7, sixth: 0.8, ninth: 0.75, tenth: 0.7, wings: 0, hub: 0, presence: 0.85, fog: 0.038, fire: 2.4, host: 0.45, palLock: 0, sclera: "#3a1014", fogCol: "#1c0608" },
        praised: { blink: 1, look: 1.6, pupil: 1.2, spin: 1.8, camZ: 5.6, third: 1.15, fifth: 1.2, sixth: 1.1, ninth: 1.2, tenth: 1.15, wings: 1, hub: 0, presence: 1, fog: 0.006, fire: 2.8, host: 1.8, palLock: 1, sclera: "#fff4d4", fogCol: "#241408" },
        slain: { blink: 0, look: 0.05, pupil: 0.3, spin: 0.01, camZ: 11.4, third: 0.2, fifth: 0.14, sixth: 0.12, ninth: 0.1, tenth: 0.08, wings: 0, hub: 0, presence: 0.04, fog: 0.07, fire: 0.04, host: 0.08, palLock: 0, sclera: "#2a1810", fogCol: "#080404" },
        adversary: { blink: 1, look: 2.8, pupil: 1.95, spin: -2.2, camZ: 4.7, third: 1.1, fifth: 1.25, sixth: 1.3, ninth: 1.35, tenth: 1.4, wings: 0, hub: 1, presence: 1, fog: 0.022, fire: 2.6, host: 1.4, palLock: 0, sclera: "#4a1020", fogCol: "#140408" },
      };
      const next = table[id] || table.witness;
      aspect = {
        id: table[id] ? id : "witness",
        blink: next.blink,
        look: next.look,
        pupil: next.pupil,
        spin: next.spin,
        camZ: next.camZ,
        third: next.third,
        fifth: next.fifth,
        sixth: next.sixth,
        ninth: next.ninth == null ? 1 : next.ninth,
        tenth: next.tenth == null ? 1 : next.tenth,
        wings: next.wings,
        hub: next.hub,
        fog: next.fog,
        fire: next.fire,
        host: next.host,
        presence: next.presence,
        palLock: next.palLock,
        sclera: new THREE.Color(next.sclera),
        fogCol: new THREE.Color(next.fogCol || "#0c0912"),
      };
      throne.aspect = aspect.id;
      if (next.palLock >= 0) {
        paletteIndex = next.palLock;
        throne.palette = paletteIndex;
      }
      setRimPresence(next.presence);
      applyAspectUniforms();
      [...document.body.classList].forEach((c) => {
        if (c.startsWith("aspect-") || c.startsWith("palette-")) document.body.classList.remove(c);
      });
      document.body.classList.add(`aspect-${aspect.id}`);
      const palName = ["palette-gold", "palette-white", "palette-violet"][next.palLock] || "palette-gold";
      document.body.classList.add(palName);
    },
    dispose() {
      running = false;
      window.removeEventListener("resize", resize);
      renderer.dispose();
    },
  };
}

export function createFallbackWheel(root) {
  root.innerHTML = `
    <div class="fallback-wheels" aria-hidden="true" style="position:absolute;inset:0;display:grid;place-items:center;">
      <div style="width:min(70vw,520px);aspect-ratio:1;border:16px solid #8a5a22;border-radius:50%;
        box-shadow:0 0 28px #c9a22744, inset 0 0 40px #3d220855;"></div>
    </div>`;
  return { shudder() {}, openDistantEye() {}, setPalette() {}, setAspect() {}, tilt() {}, orbit() {}, getOrbit() { return { yaw: 0, pitch: 0 }; }, setRapture() {}, pulse() {}, fallIn() {}, nudgeZ() {}, setSpinBoost() {}, offer() {}, wound() {}, bleed() {}, showFace() {}, wearFace() {}, weep() {}, slay() {}, ascend() {}, dispose() {} };
}
