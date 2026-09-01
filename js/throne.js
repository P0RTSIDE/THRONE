/**
 * THRONE shared session state.
 * All "randomness" is mulberry32(seed) so a session is reproducible while debugging.
 */
export const throne = {
  seed: 0,
  rng: () => Math.random(),
  calm: false,
  muted: false,
  volume: 0.62,
  entered: false,
  quality: "medium",
  mouse: { x: 0, y: 0, ndcX: 0, ndcY: 0 },
  time: 0,
  palette: 0,
  aspect: "witness",
  depth: 0.45,
  choir: false,
  raptured: false,
  fall: 0,
  rim: 0.37,
  lore: {
    feared: 0,
    fed: 0,
    raptured: 0,
    named: false,
    confessed: false,
    canOffer: false,
    offered: false,
    lock: false,
    knife: false,
    face: false,
    bladeAngel: false,
    bladeSelf: false,
    goat: false,
    pentagram: false,
    judged: false,
    praised: false,
    isaac: false,
    angelSlain: false,
    forgotFace: false,
    ascended: false,
    petitions: 0,
  },
};

/** Deterministic 0..1 PRNG (Mulberry32). */
export function mulberry32(a) {
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(min, max) {
  return min + throne.rng() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

/**
 * Cheap capability probe so low-end machines get fewer eyes / particles
 * instead of a melted fan. Not a benchmark, just a first-pass throttle.
 */
export function probeQuality() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  const dpr = window.devicePixelRatio || 1;
  let score = 0;
  if (mem != null) {
    if (mem >= 8) score += 2;
    else if (mem >= 4) score += 1;
    else score -= 1;
  }
  if (cores >= 8) score += 2;
  else if (cores >= 4) score += 1;
  else if (cores < 4) score -= 1;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
      if (/apple m[1-9]|metal/i.test(renderer)) score += 3;
      else if (/nvidia|radeon|geforce|adreno 7|mali-g7/i.test(renderer)) score += 2;
      if (/swiftshader|llvmpipe|software/i.test(renderer)) score -= 2;
    } else {
      score -= 3;
    }
  } catch {
    score -= 1;
  }
  if (dpr >= 2.5) score -= 1;
  if (coarse) score -= 2;
  if (saveData) score -= 2;
  if (score >= 5) return "high";
  if (score >= 2) return "medium";
  return "low";
}

export function showCaption(text, ms = 2200) {
  const el = document.getElementById("caption");
  if (!el) return;
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(showCaption._t);
  showCaption._t = setTimeout(() => el.classList.remove("show"), ms);
}
