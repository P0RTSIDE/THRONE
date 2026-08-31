/**
 * eyeWheel.js — Ophanim Rendering Engine
 *
 * What this file does:
 *   1. Two intersecting tori (wheel within a wheel) in three.js, spinning on independent axes.
 *   2. Instanced almond-eyes covering each rim. Each eye blinks on its own phase, dilates slowly,
 *      and the pupil tracks the cursor via a cheap NDC offset in the vertex shader.
 *   3. Palette cycling: burnished gold, searing white, UV-violet.
 *   4. A "distant eye" can be opened (rim slider release) by boosting one instance's scale.
 *   5. Dispatches `throne:cycle` when the outer wheel wraps 2π so audio can swell (volume-capped).
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

    float almond = length(vec2(e.x * 0.78, e.y * 1.62));
    if (almond > 1.02) discard;
    float edge = smoothstep(1.0, 0.84, almond);

    vec3 sclera = mix(uSclera, vec3(0.93, 0.86, 0.68), 0.35);
    vec2 look = clamp(vLook * 0.18, vec2(-0.22), vec2(0.22));
    look.y *= 0.6;
    vec2 irisUv = e - look;
    float ir = length(irisUv);

    vec3 iris = mix(uIrisA, uIrisB, 0.45 + 0.2 * sin(vPhase * 6.0));
    float irisMask = smoothstep(0.52, 0.42, ir);
    vec3 col = mix(sclera, iris, irisMask);

    float hatch = sin(ir * 18.0 + vPhase) * 0.06;
    col += iris * hatch * irisMask;

    float pupilR = 0.16 * vDilate;
    float pupil = smoothstep(pupilR + 0.02, pupilR - 0.01, ir);
    col = mix(col, vec3(0.07, 0.03, 0.02), pupil);

    float spec = smoothstep(0.08, 0.0, length(irisUv - vec2(-0.1, 0.12)));
    col += vec3(0.85, 0.75, 0.4) * spec * 0.45 * (1.0 - blink);

    vec3 rim = mix(vec3(0.55, 0.38, 0.1), iris, 0.3);
    col = mix(rim, col, edge);
    col *= 1.0 - blink * 0.7;

    gl_FragColor = vec4(col, edge);
  }
`;

function qualityConfig(q) {
  if (q === "low") {
    return { uSeg: 14, vSeg: 8, tube: 14, radial: 40, dpr: 1, glow: false, host: 3 };
  }
  if (q === "high") {
    return { uSeg: 28, vSeg: 16, tube: 26, radial: 88, dpr: Math.min(2, window.devicePixelRatio || 1), glow: true, host: 7 };
  }
  return { uSeg: 22, vSeg: 12, tube: 18, radial: 64, dpr: Math.min(1.5, window.devicePixelRatio || 1), glow: true, host: 5 };
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

function makeEyeField(R, r, uSeg, vSeg, eyeSize) {
  const count = uSeg * vSeg * 2;
  const geom = new THREE.PlaneGeometry(eyeSize, eyeSize * 0.58);
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
    },
    vertexShader: EYE_VERT,
    fragmentShader: EYE_FRAG,
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
        dummy.position.copy(pos).addScaledVector(face, r * 0.2);
        dummy.up.copy(up);
        dummy.lookAt(pos.clone().add(face));
        dummy.rotateZ((throne.rng() - 0.5) * 0.8);
        dummy.scale.setScalar(0.45 + throne.rng() * 0.95);
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
  scene.fog = new THREE.FogExp2(0x140e18, 0.022);
  scene.background = new THREE.Color(0x0c0912);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 90);
  camera.position.set(0, 0.35, 7.6);

  const renderer = new THREE.WebGLRenderer({ antialias: cfg.dpr > 1, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(cfg.dpr);
  renderer.setClearColor(0x0c0912, 1);
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

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(32, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x2a1c10, transparent: true, opacity: 0.35, side: THREE.BackSide })
  );
  scene.add(dome);
  const vault = new THREE.Mesh(
    new THREE.SphereGeometry(18, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
    new THREE.MeshBasicMaterial({ color: 0xf0d078, transparent: true, opacity: 0.06, side: THREE.BackSide, depthWrite: false })
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
  scene.add(outerGroup, innerGroup, thirdGroup, fourthGroup, fifthGroup, sixthGroup, wingGroup, looseGroup);

  const kernelMat = new THREE.MeshStandardMaterial({ color: 0x090704, roughness: 0.96, metalness: 0.02 });
  const kernel = new THREE.Group();
  const kernelHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), kernelMat);
  const kernelBody = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), kernelMat);
  kernelBody.position.set(0.07, -0.14, 0.03);
  kernel.add(kernelHead, kernelBody);
  scene.add(kernel);

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
  outerGroup.add(outerMesh);
  innerGroup.add(innerMesh);
  thirdGroup.add(thirdMesh);
  fourthGroup.add(fourthMesh);
  fifthGroup.add(fifthMesh);
  sixthGroup.add(sixthMesh);

  const spokeMat = metalMat(pal0.metal, pal0.emit);
  const spokes = [];
  for (let i = 0; i < 10; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.02, outerR * 2.05, 6), spokeMat);
    spoke.rotation.z = (i / 10) * Math.PI;
    outerGroup.add(spoke);
    spokes.push(spoke);
  }
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.016, innerR * 2.02, 6), spokeMat);
    spoke.rotation.x = Math.PI * 0.5;
    spoke.rotation.z = (i / 6) * Math.PI;
    innerGroup.add(spoke);
    spokes.push(spoke);
  }

  const fire = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.08, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xf0d078, transparent: true, opacity: 0.35 })
  );
  const hearth = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 14, 12),
    new THREE.MeshBasicMaterial({ color: 0xf0d078, transparent: true, opacity: 0.2 })
  );
  scene.add(fire, hearth);

  const faces = new THREE.Group();
  const faceMat = new THREE.MeshBasicMaterial({
    color: 0xc9a227,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (let i = 0; i < 4; i++) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), faceMat);
    const a = (i / 4) * Math.PI * 2;
    face.position.set(Math.cos(a) * 1.05, Math.sin(a) * 0.35, Math.sin(a) * 1.05);
    face.lookAt(0, 0, 0);
    faces.add(face);
  }
  scene.add(faces);

  const outerEyes = makeEyeField(outerR, outerTube, cfg.uSeg, cfg.vSeg, 0.34);
  const innerEyes = makeEyeField(innerR, innerTube, Math.max(12, cfg.uSeg - 2), Math.max(8, cfg.vSeg - 1), 0.32);
  const thirdEyes = makeEyeField(thirdR, thirdTube, Math.max(10, cfg.uSeg - 4), Math.max(7, cfg.vSeg - 2), 0.28);
  const fourthEyes = makeEyeField(fourthR, fourthTube, Math.max(10, cfg.uSeg - 6), Math.max(6, cfg.vSeg - 3), 0.2);
  const fifthEyes = makeEyeField(fifthR, fifthTube, Math.max(8, cfg.uSeg - 8), Math.max(6, cfg.vSeg - 4), 0.22);
  const sixthEyes = makeEyeField(sixthR, sixthTube, Math.max(8, cfg.uSeg - 8), Math.max(5, cfg.vSeg - 5), 0.16);
  outerGroup.add(outerEyes.mesh);
  innerGroup.add(innerEyes.mesh);
  thirdGroup.add(thirdEyes.mesh);
  fourthGroup.add(fourthEyes.mesh);
  fifthGroup.add(fifthEyes.mesh);
  sixthGroup.add(sixthEyes.mesh);

  const eyeFields = [outerEyes, innerEyes, thirdEyes, fourthEyes, fifthEyes, sixthEyes];

  const looseCount = cfg.host + 8;
  for (let i = 0; i < looseCount; i++) {
    const eye = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28 + throne.rng() * 0.85, 0.14 + throne.rng() * 0.48),
      outerEyes.mat
    );
    const a = throne.rng() * Math.PI * 2;
    const b = throne.rng() * Math.PI;
    const rad = 1.1 + throne.rng() * 2.4;
    eye.position.set(Math.cos(a) * Math.sin(b) * rad, Math.cos(b) * rad * 0.7, Math.sin(a) * Math.sin(b) * rad);
    eye.lookAt(0, 0, 0);
    if (throne.rng() > 0.5) eye.rotateZ(throne.rng() * 6);
    looseGroup.add(eye);
  }

  // Six light-wings: only shown for the seraph aspect.
  const wingMat = new THREE.MeshBasicMaterial({
    color: 0xf0d078,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 10; i++) {
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 0.42 + (i % 3) * 0.12), wingMat.clone());
    wing.rotation.y = (i / 10) * Math.PI * 2;
    wing.rotation.z = 0.38 * ((i % 2) * 2 - 1);
    wing.rotation.x = 0.18 * ((i % 3) - 1);
    wing.position.y = ((i % 3) - 1) * 0.12;
    wingGroup.add(wing);
  }

  // One hub eye for the "true name" aspect.
  const hubGeom = new THREE.PlaneGeometry(2.6, 1.55);
  const hubMat = outerEyes.mat.clone();
  hubMat.uniforms = THREE.UniformsUtils.clone(outerEyes.mat.uniforms);
  const hubEye = new THREE.Mesh(hubGeom, hubMat);
  hubEye.visible = false;
  scene.add(hubEye);

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
    camZ: 7.6,
    third: 1,
    wings: 0,
    hub: 0,
    presence: 1,
    sclera: new THREE.Color("#f3ebd6"),
    palLock: -1,
  };
  let spinBoost = 1;
  let zNudge = 0;
  let pulseScale = 1;
  let yaw = 0.22;
  let pitch = 0.1;
  let offerAge = 0;
  let offering = false;
  let wounding = false;
  let woundAge = 0;
  let bleeding = false;
  let bleedAge = 0;

  function resize() {
    const w = root.clientWidth || window.innerWidth;
    const h = root.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  resize();
  window.addEventListener("resize", resize);

  function applyPalette(index, dt) {
    const pal = PALETTES[index];
    const mats = [...eyeFields.map((f) => f.mat), hubMat];
    for (const m of mats) {
      m.uniforms.uIrisA.value.lerp(pal.irisA, Math.min(1, dt * 1.8));
      m.uniforms.uIrisB.value.lerp(pal.irisB, Math.min(1, dt * 1.8));
    }
    for (const mesh of [outerMesh, innerMesh, thirdMesh, fourthMesh, fifthMesh, sixthMesh, ...spokes]) {
      mesh.material.color.lerp(new THREE.Color(pal.metal), Math.min(1, dt * 1.2));
      mesh.material.emissive.lerp(new THREE.Color(pal.emit), Math.min(1, dt * 1.2));
    }
    key.color.lerp(new THREE.Color(pal.metal), Math.min(1, dt));
  }

  function applyAspectUniforms() {
    const mats = [...eyeFields.map((f) => f.mat), hubMat];
    for (const m of mats) {
      m.uniforms.uBlinkAllow.value = aspect.blink;
      m.uniforms.uLookGain.value = aspect.look * (throne.raptured ? 2.4 : 1);
      m.uniforms.uPupilMul.value = aspect.pupil;
      m.uniforms.uSclera.value.copy(aspect.sclera);
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

    const calm = throne.calm ? 1 : 0;
    const spin = (throne.calm ? 0.08 : 1) * aspect.spin * (throne.raptured ? 1.65 : 1) * spinBoost;

    outerGroup.rotation.y += dt * 0.35 * spin;
    outerGroup.rotation.z += dt * 0.07 * spin;
    outerGroup.rotation.x += dt * 0.03 * spin;
    innerGroup.rotation.x += dt * 0.42 * spin;
    innerGroup.rotation.y += dt * 0.11 * spin;
    innerGroup.rotation.z += dt * 0.05 * spin;
    thirdGroup.rotation.y += dt * 0.5 * spin;
    thirdGroup.rotation.z += dt * 0.16 * spin;
    fourthGroup.rotation.x += dt * 0.28 * spin;
    fourthGroup.rotation.y += dt * -0.19 * spin;
    fifthGroup.rotation.z += dt * 0.38 * spin;
    fifthGroup.rotation.y += dt * 0.14 * spin;
    sixthGroup.rotation.x += dt * -0.22 * spin;
    sixthGroup.rotation.z += dt * 0.11 * spin;
    fire.rotation.y += dt * 0.8 * spin;
    fire.rotation.x = Math.sin(t * 0.6) * 0.4;
    hearth.scale.setScalar(0.85 + Math.sin(t * 1.6) * 0.12);
    hearth.material.opacity = 0.14 + Math.abs(Math.sin(t * 2.1)) * 0.12;
    faces.rotation.y += dt * 0.16 * spin;
    looseGroup.rotation.y += dt * 0.12 * spin;
    looseGroup.rotation.x = Math.sin(t * 0.21) * 0.35;
    host.rotation.y += dt * 0.018 * Math.abs(spin);
    kernel.visible = !throne.lore.offered;
    kernel.rotation.y += dt * 0.08;
    kernel.position.y = Math.sin(t * 0.7) * 0.04;
    pulseScale += (1 - pulseScale) * Math.min(1, dt * 4);
    const ps = pulseScale;
    outerGroup.scale.setScalar(ps);
    innerGroup.scale.setScalar(2 - ps);
    if (wounding) {
      woundAge += dt;
      scene.fog.color.lerp(new THREE.Color("#4a1020"), 0.1);
      spinBoost = -2.6;
      if (woundAge > 2.5) {
        wounding = false;
        spinBoost = 1;
      }
    }
    if (bleeding) {
      bleedAge += dt;
      scene.fog.density += (0.1 - scene.fog.density) * 0.08;
      hubEye.visible = true;
      hubEye.lookAt(camera.position);
      hubEye.scale.setScalar(Math.min(2.2, 0.4 + bleedAge * 0.5));
    }
    if (offering) {
      offerAge += dt;
      const shrink = Math.max(0.16, 1 - offerAge * 0.14);
      outerGroup.scale.setScalar(ps * shrink);
      innerGroup.scale.setScalar(Math.max(0.12, (2 - ps) * shrink));
      fourthGroup.scale.setScalar(Math.min(1.15, 0.45 + offerAge * 0.14));
      fifthGroup.scale.setScalar(Math.max(0.12, shrink));
      sixthGroup.scale.setScalar(Math.max(0.18, shrink * 0.9));
      yaw += (0 - yaw) * Math.min(1, dt * 1.25);
      pitch += (0.06 - pitch) * Math.min(1, dt * 1.25);
      scene.fog.density += (0.04 - scene.fog.density) * 0.05;
      scene.fog.color.lerp(new THREE.Color("#f3e6c4"), 0.03);
    }
    spinBoost += (1 - spinBoost) * Math.min(1, dt * 1.8);
    zNudge *= 0.92;
    wingGroup.rotation.y += dt * 0.55 * Math.abs(spin);
    wingGroup.rotation.x = Math.sin(t * 0.4) * 0.12;

    const thirdTarget = aspect.third;
    const s = thirdGroup.scale.x;
    const next = s + (thirdTarget - s) * Math.min(1, dt * 3);
    thirdGroup.scale.setScalar(Math.max(0.001, next));

    wingGroup.visible = !throne.calm;
    wingGroup.scale.setScalar(aspect.wings > 0.5 ? 1 : 0.68);
    const wingOp = aspect.wings > 0.5 ? 0.28 : 0.1;
    wingGroup.children.forEach((w) => {
      if (w.material) w.material.opacity = wingOp;
    });
    hubEye.visible = aspect.hub > 0.5 || throne.lore.offered;
    if (hubEye.visible) {
      hubEye.lookAt(camera.position);
      if (throne.lore.offered) {
        const grow = Math.min(2.7, 0.35 + offerAge * 0.55);
        hubEye.scale.setScalar(grow);
      } else {
        hubEye.scale.setScalar(1 + (pulseScale - 1) * 2.4);
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
      paletteMix += dt * (throne.calm ? 0.05 : 0.12);
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

    const radius = (throne.raptured ? 0.78 : aspect.camZ) + zNudge;
    const fovTarget = throne.raptured ? 88 : 48;
    camera.fov += (fovTarget - camera.fov) * 0.05;
    camera.updateProjectionMatrix();
    const cp = Math.cos(pitch);
    const tx = Math.sin(yaw) * cp * radius;
    const ty = Math.sin(pitch) * radius * 0.7;
    const tz = Math.cos(yaw) * cp * radius;
    const shake = throne.calm ? 0 : (throne.raptured ? 0.03 : 0.04);
    const lx = tx + Math.sin(t * 0.17) * shake;
    const ly = ty + Math.sin(t * 0.13) * shake * 0.5;
    const lz = tz;
    const ease = 0.32;
    camera.position.x += (lx - camera.position.x) * ease;
    camera.position.y += (ly - camera.position.y) * ease;
    camera.position.z += (lz - camera.position.z) * ease;
    camera.lookAt(0, 0, 0);

    const mouse = new THREE.Vector2(throne.mouse.ndcX, throne.mouse.ndcY);
    for (const field of eyeFields) {
      field.mat.uniforms.uTime.value = t;
      field.mat.uniforms.uMouse.value.copy(mouse);
      field.mat.uniforms.uCalm.value = calm;
    }
    hubMat.uniforms.uTime.value = t;
    hubMat.uniforms.uMouse.value.copy(mouse);
    hubMat.uniforms.uCalm.value = calm;

    if (distantEye >= 0 && t > distantUntil) {
      outerEyes.alive[distantEye] = 1;
      outerEyes.mesh.geometry.attributes.aAlive.needsUpdate = true;
      distantEye = -1;
    }

    key.position.set(Math.sin(t * 0.4) * 0.4, Math.cos(t * 0.3) * 0.3, 0.2);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  return {
    /** Punch-zoom used by Fear Not. */
    shudder() {
      if (throne.calm) return;
      pulseScale = 1.28;
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
      yaw -= dx * 0.007;
      pitch = Math.max(-0.62, Math.min(0.62, pitch + dy * 0.0055));
    },
    getOrbit() {
      return { yaw, pitch };
    },
    tilt(nx, ny) {
      this.orbit(nx * 18, ny * 12);
    },
    setRapture(on) {
      throne.raptured = !!on;
      document.documentElement.classList.toggle("raptured", !!on);
      scene.fog.density = on ? 0.14 : 0.022;
      pulseScale = on ? 1.18 : 0.88;
    },
    pulse() {
      pulseScale = 1.22;
    },
    nudgeZ(delta) {
      zNudge = Math.max(-2.2, Math.min(2.4, zNudge + delta));
    },
    setSpinBoost(n) {
      spinBoost = n;
    },
    offer() {
      offering = true;
      offerAge = 0;
      pulseScale = 1.35;
      zNudge = 0;
      scene.fog.density = 0.07;
      this.setAspect("offered");
    },
    wound() {
      wounding = true;
      woundAge = 0;
      pulseScale = 1.52;
      spinBoost = -2.8;
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
      pulseScale = 1.3;
    },
    /**
     * Rewrite the angel. Aspects change blink, gaze, extra rims, wings, hub eye, and spin.
     */
    setAspect(id) {
      const table = {
        witness: { blink: 1, look: 1.15, pupil: 1.1, spin: 1, camZ: 7.6, third: 1, wings: 0, hub: 0, presence: 1, palLock: -1, sclera: "#f3ebd6" },
        unblinking: { blink: 0, look: 2.8, pupil: 1.55, spin: 0.55, camZ: 6.4, third: 1, wings: 0, hub: 0, presence: 1, palLock: 1, sclera: "#ffffff" },
        merkavah: { blink: 1, look: 1.4, pupil: 1.15, spin: 1.2, camZ: 8.2, third: 1, wings: 0, hub: 0, presence: 1, palLock: 0, sclera: "#f0d078" },
        waters: { blink: 0.35, look: 0.7, pupil: 0.82, spin: 0.32, camZ: 8.8, third: 1, wings: 0, hub: 0, presence: 1, palLock: 1, sclera: "#ead9a8" },
        seraph: { blink: 1, look: 1.8, pupil: 1.2, spin: 1.85, camZ: 6.8, third: 1, wings: 1, hub: 0, presence: 1, palLock: 1, sclera: "#fff6d8" },
        inverted: { blink: 1, look: 2.1, pupil: 1.7, spin: -1.15, camZ: 6.2, third: 1, wings: 0, hub: 0, presence: 1, palLock: 0, sclera: "#2a1014" },
        name: { blink: 0, look: 3.2, pupil: 1.7, spin: 0.22, camZ: 5.8, third: 0.55, wings: 0, hub: 1, presence: 0.12, palLock: 0, sclera: "#f4f1e8" },
        hush: { blink: 1, look: 0.2, pupil: 0.55, spin: 0.1, camZ: 9.8, third: 0.7, wings: 0, hub: 0, presence: 0.08, palLock: 0, sclera: "#6a6048" },
        offered: { blink: 1, look: 0.45, pupil: 0.82, spin: 0.05, camZ: 5.4, third: 0.2, wings: 0, hub: 1, presence: 0.1, palLock: 1, sclera: "#fff8ea" },
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
        wings: next.wings,
        hub: next.hub,
        presence: next.presence,
        palLock: next.palLock,
        sclera: new THREE.Color(next.sclera),
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
  return { shudder() {}, openDistantEye() {}, setPalette() {}, setAspect() {}, tilt() {}, orbit() {}, getOrbit() { return { yaw: 0, pitch: 0 }; }, setRapture() {}, pulse() {}, nudgeZ() {}, setSpinBoost() {}, offer() {}, wound() {}, bleed() {}, showFace() {}, dispose() {} };
}
