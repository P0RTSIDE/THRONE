/**
 * chaosUI.js — Nonsense Liturgy + optical overlays
 *
 * Map of effects:
 *   glitchText     — invented glyphs, tremble, brief mirror/invert; restored in Calm Mode
 *   nav            — each item opens the named window
 *   fearNot        — shudder + one smaller copy (capped)
 *   petition       — modal "witnessed" then immediately closes
 *   rimSlider      — no live change; on release, a distant eye opens / palette snaps
 *   comprehension  — fills, resets, never reaches 100
 *   flee           — one inscription runs from the cursor
 *   averted click  — Approach only registers when the cursor is NOT on it
 *   days counter   — absurd ticking number
 *   cursor trail   — decaying eye/sparks (skipped on coarse pointers)
 *   sacred geometry— Metatron-ish linework + vesica, counter-rotating
 *   strobe         — single-frame black/white, NEVER more than ~2.4 flashes/sec
 *   wing pulse     — slow radial wash from center
 */

import { throne, randRange, randInt, showCaption } from "./throne.js";

/** Invented sigils. Not Hebrew, not any real liturgical script. */
const SIGILS = "◊◈◉◎◌◍◐◑◒◓◔◕◘◙☿♄♃♁☥⚜⚝✦✧✩✪✫✬✭✮✯✰❋❊❈❇✺✹✸✷✶✵✴✳";

const BLURBS = {
  angel: [
    "full of eyes within",
    "the wheels moved as they went",
    "a voice of many",
    "face within face",
    "it is not one",
    "you are already seen",
    "the mouth is not a mouth",
    "eyes behind eyes",
    "the center is a door",
    "the living thing had four",
    "the air is full of lids",
    "what you hear is the looking",
  ],
  father: [
    "you came about a boy",
    "bring him back",
    "he was small enough to carry",
    "the hill is still in your hands",
    "you told him not to look down",
  ],
  fear: [
    "you said it to him",
    "he believed you",
    "a courtesy, then a cord",
    "fear is a courtesy",
    "the words arrived late",
  ],
  fed: [
    "a substitute is not a son",
    "rams keep failing",
    "the mouth wants the hand",
    "offerings of language are cheap",
  ],
  inside: [
    "the boy is not in the wheels",
    "you brought the morning with you",
    "this is as close as a father gets",
    "trade requires a body",
  ],
  named: [
    "he still turns toward that sound",
    "do not say it like a prayer",
    "the hill heard it first",
    "naming him does not return him",
  ],
  confessed: [
    "no voice arrived in time",
    "you finished the instruction",
    "it will take the other body now",
    "the ram did not come",
    "hold the center until you are the offering",
  ],
  offered: [
    "he blinks because he can",
    "the count has a new rim",
    "do not ask him about the hill",
    "he is looking at you",
    "you are the rest of the eyes",
  ],
};

function blurbPool() {
  const lore = throne.lore;
  if (lore.offered) return BLURBS.offered;
  if (lore.confessed) return BLURBS.confessed;
  if (lore.named) return BLURBS.named;
  if (lore.raptured >= 1 && throne.raptured) return BLURBS.inside;
  if (lore.fed >= 1) return BLURBS.fed;
  if (lore.feared >= 1) return BLURBS.fear;
  if (throne.entered) return BLURBS.father;
  return BLURBS.angel;
}

function wrapGlyphs(el) {
  if (el.dataset.wrapped) return;
  const raw = el.textContent;
  el.dataset.original = raw;
  el.dataset.wrapped = "1";
  el.textContent = "";
  for (const ch of raw) {
    if (ch === " " || ch === "\n" || ch === "\t") {
      el.appendChild(document.createTextNode(ch));
      continue;
    }
    const span = document.createElement("span");
    span.className = "ch";
    span.textContent = ch;
    el.appendChild(span);
  }
}

function restoreGlyphs(el) {
  if (!el.dataset.original) return;
  const origChars = [...el.dataset.original].filter((c) => c !== " " && c !== "\n" && c !== "\t");
  el.querySelectorAll(".ch").forEach((span, i) => {
    span.textContent = origChars[i] ?? "";
    span.style.transform = "";
  });
  el.style.transform = "";
}

export function createChaosUI({ audio, wheel }) {
  const strobeEl = document.getElementById("strobe");
  const pulseEl = document.getElementById("pulse");
  const trail = document.getElementById("cursor-trail");
  const geo = document.getElementById("sacred-geo");
  const chroma = document.getElementById("chromatic");
  const daysEl = document.getElementById("days-value");
  const bar = document.getElementById("comprehension-bar");
  const barVal = document.getElementById("comprehension-value");
  const witness = document.getElementById("witness");
  const averted = document.getElementById("averted");
  const fleeEls = [...document.querySelectorAll("[data-flee]")];
  fleeEls.forEach((el) => {
    el.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("throne:flee"));
    });
  });
  const driftEls = [...document.querySelectorAll("[data-drift]")];
  const glitchEls = [...document.querySelectorAll("[data-glitch]")].filter((el) => !el.closest("#veil"));

  glitchEls.forEach(wrapGlyphs);

  let lastStrobe = 0;
  let strobeOn = false;
  let comprehension = randRange(4, 18);
  let compVel = randRange(2, 9);
  let days = 2_198_447 + Math.floor(throne.rng() * 90000);
  let lastSwap = 0;
  let invertUntil = 0;
  let fearCount = 0;
  let fed = 0;
  const MAX_FEAR = 21;
  let lastBlurb = "";
  let nextBlurbAt = 0;
  let stareMs = 0;
  let stareWarned = false;
  let stareCool = 0;
  let lastStareAt = 0;
  let bindCarry = () => {};
  const forged = new Set();

  function speakBlurb(ms = 2800) {
    if (throne.calm || !throne.entered || throne.lore.lock) return;
    if (document.getElementById("caption")?.classList.contains("show")) return;
    const pool = blurbPool();
    if (!pool.length) return;
    let line = pool[randInt(0, pool.length - 1)];
    if (pool.length > 1) {
      while (line === lastBlurb) line = pool[randInt(0, pool.length - 1)];
    }
    lastBlurb = line;
    showCaption(line, ms);
    audio.utter();
  }

  const particles = [];
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  let ctx2d = null;
  if (trail && !coarse) {
    ctx2d = trail.getContext("2d");
  }

  function sizeTrail() {
    if (!trail) return;
    trail.width = window.innerWidth;
    trail.height = window.innerHeight;
  }
  sizeTrail();
  window.addEventListener("resize", sizeTrail);

  buildSacredGeometry(geo);
  wireOrbit(audio);
  wireMouth(audio, wheel);
  wireGaze(audio, wheel);
  wireWindows(audio, wheel);
  wirePlaneDrag();
  wireCarry(audio, wheel);

  function overwhelm() {
    if (throne.lore.offered || document.documentElement.classList.contains("overwhelmed")) return;
    document.documentElement.classList.add("overwhelmed");
    const death = document.getElementById("death");
    if (death) death.hidden = false;
    audio.scream?.();
    wheel.setAspect?.("unblinking");
    wheel.setSpinBoost?.(3.4);
    comprehension = 99;
    showCaption("too long. it poured the count into you.", 4200);
    maybeStrobe(true);
  }

  function wakeFromDeath() {
    document.documentElement.classList.remove("overwhelmed");
    const death = document.getElementById("death");
    if (death) death.hidden = true;
    stareMs = 0;
    stareWarned = false;
    stareCool = performance.now() + 8000;
    wheel.setSpinBoost?.(1);
    wheel.setAspect?.("witness");
    showCaption("look away sooner. the wheels keep what they take.", 4200);
  }

  document.getElementById("death-wake")?.addEventListener("click", (e) => {
    e.stopPropagation();
    wakeFromDeath();
  });

  // ----- Cursor + particles -----
  window.addEventListener("pointermove", (e) => {
    throne.mouse.x = e.clientX;
    throne.mouse.y = e.clientY;
    throne.mouse.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    throne.mouse.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    if (throne.calm || coarse || !throne.entered) return;
    if (particles.length < (throne.quality === "low" ? 12 : 22)) {
      particles.push({
        x: e.clientX,
        y: e.clientY,
        vx: randRange(-0.4, 0.4),
        vy: randRange(-0.4, 0.4),
        life: 1,
        r: randRange(3, 8),
        gold: throne.rng() > 0.35,
      });
    }
  });

  // ----- Fear Not: click multiplies, hold unmakes, drag into the mouth to feed it -----
  function nearMouth(x, y) {
    const mouth = document.getElementById("mouth");
    if (!mouth) return false;
    const r = mouth.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hit = Math.max(r.width, r.height) * 0.9;
    return Math.hypot(x - cx, y - cy) < hit;
  }

  function unmakeFear(btn) {
    if (btn.classList.contains("unmaking")) return;
    btn.classList.add("unmaking");
    audio.unmake();
    window.dispatchEvent(new CustomEvent("throne:unmake"));
    if (btn.classList.contains("spawned")) fearCount = Math.max(0, fearCount - 1);
    setTimeout(() => btn.remove(), 560);
    if (!document.getElementById("fear-not")) {
      setTimeout(() => {
        if (document.getElementById("fear-not")) return;
        const n = document.createElement("button");
        n.id = "fear-not";
        n.className = "fear-not relic";
        n.type = "button";
        n.textContent = "Fear Not";
        const hint = document.createElement("span");
        hint.className = "fear-not-hint";
        hint.textContent = "you said it once. it is still in your mouth.";
        n.appendChild(hint);
        n.style.left = "50%";
        n.style.top = "auto";
        n.style.bottom = "18px";
        document.body.appendChild(n);
        bindFear(n);
      }, 8000);
    }
  }

  function consumeFear(btn) {
    unmakeFear(btn);
    wheel.openDistantEye();
    audio.consume();
    audio.utter();
    fed += 1;
    window.dispatchEvent(new CustomEvent("throne:fed", { detail: { fed } }));
    triggerPulse();
  }

  function bindFear(btn) {
    let downAt = 0;
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let holdTimer = 0;
    const home = {
      parent: btn.parentElement,
      left: btn.style.left || "50%",
      top: btn.style.top || "auto",
      bottom: btn.style.bottom || (btn.classList.contains("spawned") ? "auto" : "16px"),
      transform: btn.style.transform || (btn.classList.contains("spawned") ? "" : "translateX(-50%)"),
    };

    btn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      downAt = performance.now();
      startX = e.clientX;
      startY = e.clientY;
      dragging = false;
      btn.setPointerCapture(e.pointerId);
      holdTimer = window.setTimeout(() => {
        if (!dragging) unmakeFear(btn);
      }, 650);
    });
    btn.addEventListener("pointermove", (e) => {
      if (!downAt) return;
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (dist > 14) {
        dragging = true;
        clearTimeout(holdTimer);
        if (btn.parentElement !== document.body) document.body.appendChild(btn);
        btn.classList.add("dragging");
        btn.style.position = "fixed";
        btn.style.bottom = "auto";
        btn.style.left = `${e.clientX}px`;
        btn.style.top = `${e.clientY}px`;
        btn.style.transform = "translate(-50%, -50%)";
      }
    });
    btn.addEventListener("pointerup", (e) => {
      clearTimeout(holdTimer);
      btn.classList.remove("dragging");
      const held = performance.now() - downAt;
      downAt = 0;
      if (btn.classList.contains("unmaking")) return;
      if (dragging && nearMouth(e.clientX, e.clientY)) {
        consumeFear(btn);
        dragging = false;
        return;
      }
      if (dragging) {
        const nest = home.parent || document.getElementById("firmament");
        if (nest && btn.parentElement !== nest) nest.appendChild(btn);
        btn.style.position = "";
        btn.style.left = home.left;
        btn.style.top = home.top;
        btn.style.bottom = home.bottom;
        btn.style.transform = home.transform;
        dragging = false;
        return;
      }
      dragging = false;
      if (held >= 640) return;
      audio.ping("click");
      audio.utter();
      if (!throne.calm) {
        document.body.classList.add("shudder");
        wheel.shudder();
        setTimeout(() => document.body.classList.remove("shudder"), 900);
      }
      window.dispatchEvent(new CustomEvent("throne:fearnot", { detail: { muted: throne.muted } }));
      if (throne.calm) return;
      const spawn = Math.min(1, MAX_FEAR - 1 - fearCount);
      for (let i = 0; i < spawn; i++) {
        const n = btn.cloneNode(true);
        n.removeAttribute("id");
        n.classList.add("spawned");
        n.style.left = `${randRange(18, 82)}%`;
        n.style.top = `${randRange(22, 78)}%`;
        n.style.transform = `rotate(${randRange(-12, 12)}deg) scale(${randRange(0.7, 0.9)})`;
        document.body.appendChild(n);
        n.style.position = "fixed";
        fearCount++;
        bindFear(n);
      }
    });
  }
  const fearRoot = document.getElementById("fear-not");
  if (fearRoot) bindFear(fearRoot);

  document.querySelectorAll(".relic").forEach((el) => {
    let last = 0;
    el.addEventListener("pointerenter", () => {
      const now = performance.now();
      if (now - last < 350) return;
      last = now;
      audio.ping("hover");
    });
  });

  window.addEventListener("throne:cycle", () => {
    audio.swell();
    wheel.pulse();
    if (throne.time > 14 || throne.lore.feared || throne.lore.fed) speakBlurb(1600);
  });
  window.addEventListener("throne:pulse", () => triggerPulse());

  function wireOrbit(audio) {
    const orbit = document.getElementById("orbit");
    if (!orbit) return;
    let dragging = false;
    function apply(clientX, clientY) {
      const r = orbit.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const ang = Math.atan2(clientY - cy, clientX - cx);
      const deg = ((ang * 180) / Math.PI + 360 + 90) % 360;
      orbit.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
      const value = (deg / 360) * 100;
      audio.setDepth(value / 100);
      return value;
    }
    orbit.addEventListener("pointerdown", (e) => {
      dragging = true;
      document.body.classList.add("rim-live");
      orbit.setPointerCapture(e.pointerId);
      apply(e.clientX, e.clientY);
      audio.ping("hover");
    });
    orbit.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      apply(e.clientX, e.clientY);
    });
    orbit.addEventListener("pointerup", (e) => {
      document.body.classList.remove("rim-live");
      if (!dragging) return;
      dragging = false;
      const value = apply(e.clientX, e.clientY);
      window.dispatchEvent(new CustomEvent("throne:rim", { detail: { value } }));
    });
  }

  function wireMouth(audio, wheel) {
    const mouth = document.getElementById("mouth");
    if (!mouth) return;
    let hold = 0;
    mouth.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (throne.lore.offered) return;
      if (throne.raptured) {
        if (throne.lore.canOffer) {
          document.documentElement.classList.add("offering");
          audio.charge(true);
          audio.ping("mouth");
          hold = window.setTimeout(() => {
            document.documentElement.classList.remove("offering", "charging");
            audio.charge(false);
            window.dispatchEvent(new CustomEvent("throne:offer"));
          }, 1400);
        } else {
          window.dispatchEvent(new CustomEvent("throne:rapture", { detail: { on: false } }));
          audio.ping("mouth");
        }
        return;
      }
      document.documentElement.classList.add("charging");
      audio.charge(true);
      audio.ping("mouth");
      hold = window.setTimeout(() => {
        document.documentElement.classList.remove("charging");
        audio.charge(false);
        window.dispatchEvent(new CustomEvent("throne:rapture", { detail: { on: true } }));
      }, 900);
    });
    const cancel = () => {
      clearTimeout(hold);
      document.documentElement.classList.remove("charging", "offering");
      audio.charge(false);
    };
    mouth.addEventListener("pointerup", cancel);
    mouth.addEventListener("pointerleave", cancel);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && throne.raptured && !throne.lore.offered) {
        clearTimeout(hold);
        document.documentElement.classList.remove("offering", "charging");
        window.dispatchEvent(new CustomEvent("throne:rapture", { detail: { on: false } }));
      }
    });
  }

  function nearEl(el, x, y, pad = 1.05) {
    if (!el || el.hidden) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 && r.height < 2) return false;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hit = Math.max(r.width, r.height, 56) * pad;
    return Math.hypot(x - cx, y - cy) < hit;
  }

  const COMBOS = {
    "fire|knife": { id: "ritual", label: "the ritual knife", line: "your hands itch for the ritual knife" },
    "fire|wood": { id: "pyre", label: "the pyre", line: "the wood takes. it has been waiting for this heat." },
    "cord|knife": { id: "bound-knife", label: "the bound knife", line: "the cord finds the blade the way a knot finds a throat" },
    "cord|wood": { id: "altar", label: "the altar", line: "wood and cord remember a place. it is still empty." },
    "cord|fire": { id: "brand", label: "the brand", line: "the mark remembers a wrist" },
    "face|knife": { id: "portion", label: "his portion", line: "you cannot keep his face and the knife in the same hand" },
    "face|ritual": { id: "portion", label: "his portion", line: "the ritual knife already knew which face this was" },
    "altar|knife": { id: "offering-blade", label: "the offering blade", line: "the place is ready. the blade finishes the count." },
    "knife|pyre": { id: "offering-blade", label: "the offering blade", line: "the pyre and the knife have done this before" },
    "ritual|wood": { id: "offering-blade", label: "the offering blade", line: "your hands itch for the last step" },
  };

  const itchOnce = new Set();
  function itch(id, text) {
    if (itchOnce.has(id) || !text) return;
    itchOnce.add(id);
    showCaption(text, 3400);
  }

  const NEAR_ITCH = {
    "knife|fire": "the knife looks flammable",
    "fire|knife": "the knife looks flammable",
    "wood|fire": "the wood still wants the heat you carried",
    "fire|wood": "the wood still wants the heat you carried",
    "cord|knife": "the cord wants the blade back",
    "knife|cord": "the cord wants the blade back",
    "knife|face": "your hands itch and will not keep both",
    "face|knife": "your hands itch and will not keep both",
    "ritual|self": "your hands itch for the ritual knife",
    "knife|self": "the old instruction is still in the palm",
  };

  function pairKey(a, b) {
    return [a, b].filter(Boolean).sort().join("|");
  }

  function spawnCrafted(id, label, x, y) {
    const field = document.getElementById("relic-field");
    if (!field) return null;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "world-relic crafted";
    btn.setAttribute("data-relic", id);
    btn.setAttribute("data-carry", id);
    btn.textContent = label;
    const box = field.getBoundingClientRect();
    const leftPct = ((x - box.left) / Math.max(box.width, 1)) * 100;
    const topPct = ((y - box.top) / Math.max(box.height, 1)) * 100;
    btn.style.left = `${Math.max(4, Math.min(96, leftPct)).toFixed(1)}%`;
    btn.style.top = `${Math.max(4, Math.min(96, topPct)).toFixed(1)}%`;
    field.appendChild(btn);
    bindCarry(btn);
    return btn;
  }

  function wireCarry(audio) {
    bindCarry = function bindCarry(btn) {
      let downAt = 0;
      let startX = 0;
      let startY = 0;
      let dragging = false;
      let grabX = 0;
      let grabY = 0;
      const homeLeft = btn.style.left;
      const homeTop = btn.style.top;
      const homeParent = btn.parentElement;

      function restore() {
        btn.classList.remove("carrying");
        if (homeParent && btn.parentElement !== homeParent) homeParent.appendChild(btn);
        btn.style.position = "";
        btn.style.left = homeLeft;
        btn.style.top = homeTop;
        btn.style.transform = "";
        btn.style.margin = "";
      }

      function beginCarry(e) {
        e.stopPropagation();
        downAt = performance.now();
        startX = e.clientX;
        startY = e.clientY;
        const box = btn.getBoundingClientRect();
        grabX = e.clientX - (box.left + box.width * 0.5);
        grabY = e.clientY - (box.top + box.height * 0.5);
        dragging = false;
        if (e.pointerId != null) {
          try { btn.setPointerCapture(e.pointerId); } catch { /* already captured */ }
        }
      }

      function moveCarry(e) {
        if (!downAt) return;
        if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) {
          dragging = true;
          if (btn.parentElement !== document.body) document.body.appendChild(btn);
          btn.classList.add("carrying");
          btn.style.position = "fixed";
          btn.style.left = `${e.clientX - grabX}px`;
          btn.style.top = `${e.clientY - grabY}px`;
          btn.style.transform = "translate(-50%, -50%)";
          btn.style.margin = "0";
          const id = btn.getAttribute("data-carry") || btn.getAttribute("data-relic");
          const hand = document.getElementById("self-hand");
          if (nearEl(hand, e.clientX, e.clientY, 1.8)) {
            itch(`${id}|self`, NEAR_ITCH[`${id}|self`]);
          }
          for (const other of document.querySelectorAll("[data-carry], [data-relic]")) {
            if (other === btn || other.hidden) continue;
            if (!nearEl(other, e.clientX, e.clientY, 1.8)) continue;
            const otherId = other.getAttribute("data-carry") || other.getAttribute("data-relic");
            itch(pairKey(id, otherId), NEAR_ITCH[pairKey(id, otherId)] || NEAR_ITCH[`${id}|${otherId}`]);
          }
        }
      }

      function endCarry(e) {
        const id = btn.getAttribute("data-carry") || btn.getAttribute("data-relic");
        const held = performance.now() - downAt;
        downAt = 0;
        if (dragging) {
          const others = [...document.querySelectorAll("[data-carry], [data-relic]")].filter((el) => el !== btn && !el.hidden);
          for (const other of others) {
            if (!nearEl(other, e.clientX, e.clientY, 1.4)) continue;
            const otherId = other.getAttribute("data-carry") || other.getAttribute("data-relic");
            const combo = COMBOS[pairKey(id, otherId)];
            if (!combo) continue;
            restore();
            dragging = false;
            if (forged.has(combo.id)) {
              showCaption("it is already finished. it wants a throat or a hand.", 3200);
              return;
            }
            forged.add(combo.id);
            spawnCrafted(combo.id, combo.label, e.clientX, e.clientY);
            showCaption(combo.line || "they remember each other", 4200);
            window.dispatchEvent(new CustomEvent("throne:relic", { detail: { id: combo.id } }));
            return;
          }
          const mouth = document.getElementById("mouth");
          const hand = document.getElementById("self-hand");
          const fire = document.querySelector('[data-relic="fire"]');
          let target = "";
          if (nearEl(mouth, e.clientX, e.clientY, 1.6)) target = "angel";
          else if (nearEl(hand, e.clientX, e.clientY, 1.6)) target = "self";
          else if (id === "wood" && nearEl(fire, e.clientX, e.clientY, 1.4)) target = "fire";
          restore();
          dragging = false;
          if (target) {
            window.dispatchEvent(new CustomEvent("throne:use", { detail: { id, target } }));
            return;
          }
          if (id === "knife") itch("knife-loose", "the knife looks flammable");
          else if (id === "ritual") itch("ritual-loose", "your hands itch for the ritual knife");
          else if (id === "offering-blade") itch("offblade-loose", "the last step is still a hand");
          return;
        }
        dragging = false;
        restore();
        if (held >= 500) return;
        audio.ping("click");
        window.dispatchEvent(new CustomEvent("throne:relic", { detail: { id } }));
      }

      btn.addEventListener("pointerdown", beginCarry);
      btn.addEventListener("pointermove", moveCarry);
      btn.addEventListener("pointerup", endCarry);
      btn.addEventListener("pointercancel", () => {
        downAt = 0;
        dragging = false;
        restore();
      });
      btn.addEventListener("mousedown", beginCarry);
      btn.addEventListener("mouseup", endCarry);
      window.addEventListener("mousemove", (e) => {
        if (downAt) moveCarry(e);
      });
    }

    document.querySelectorAll("[data-carry]").forEach(bindCarry);
  }

  function wireGaze(audio, wheel) {
    let down = false;
    let lastX = 0;
    let lastY = 0;
    let traveled = 0;
    let lastZoom = 0;
    let panX = 0;
    let panY = 0;
    const field = document.getElementById("relic-field");
    const maxX = () => Math.min(360, window.innerWidth * 0.34);
    const maxY = () => Math.min(240, window.innerHeight * 0.32);

    function paintWorld() {
      if (!field) return;
      field.style.transform = `translate3d(${panX.toFixed(1)}px, ${panY.toFixed(1)}px, 0)`;
    }

    function endGaze() {
      if (!down) return;
      down = false;
      document.body.classList.remove("gazing");
      audio.scrape(0);
      const orbit = wheel.getOrbit ? wheel.getOrbit() : { yaw: 0, pitch: 0 };
      window.dispatchEvent(new CustomEvent("throne:orbit", { detail: { ...orbit, traveled } }));
      if (traveled > 180 && (throne.lore.feared || throne.lore.fed || throne.time > 24)) speakBlurb(2200);
      traveled = 0;
    }

    window.addEventListener("throne:offer", () => {
      panX = 0;
      panY = 0;
      paintWorld();
    });

    window.addEventListener("pointerdown", (e) => {
      if (!throne.entered || e.button !== 0) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest(".hud-safe, .veil, .mouth, .fear-not, .plane, .witness, .dock, .world-relic, .self-hand, .carrying, .death, button, input, textarea, label, a")) return;
      down = true;
      lastX = e.clientX;
      lastY = e.clientY;
      traveled = 0;
      e.preventDefault();
      document.body.classList.add("gazing");
      audio.ping("drag");
    });
    window.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const speed = Math.hypot(dx, dy);
      traveled += speed;
      panX = Math.max(-maxX(), Math.min(maxX(), panX + dx * 0.9));
      panY = Math.max(-maxY(), Math.min(maxY(), panY + dy * 0.9));
      wheel.orbit(dx, dy);
      paintWorld();
      audio.scrape(speed);
      const pitch = Math.abs((wheel.getOrbit ? wheel.getOrbit() : { pitch: 0 }).pitch);
      audio.setDepth(Math.max(0.05, Math.min(1, 0.2 + pitch * 0.7)));
    });
    window.addEventListener("pointerup", endGaze);
    window.addEventListener("pointercancel", endGaze);

    window.addEventListener("wheel", (e) => {
      if (!throne.entered || throne.calm) return;
      if (e.target.closest(".hud-safe")) return;
      e.preventDefault();
      wheel.nudgeZ(e.deltaY * 0.007);
      audio.setDepth(Math.max(0, Math.min(1, throne.depth + (e.deltaY > 0 ? 0.03 : -0.03))));
      const now = performance.now();
      if (now - lastZoom > 180) {
        lastZoom = now;
        audio.ping("zoom");
      }
    }, { passive: false });
  }

  function foldPlane(plane, fold) {
    plane.classList.toggle("folded", fold);
    const id = plane.id;
    if (!id) return;
    const dock = document.getElementById("dock");
    let chip = document.querySelector(`.dock-chip[data-open="${id}"]`);
    if (fold) {
      if (!chip && dock) {
        chip = document.createElement("button");
        chip.className = "dock-chip";
        chip.type = "button";
        chip.dataset.open = id;
        chip.textContent = plane.dataset.title || "window";
        dock.appendChild(chip);
        chip.addEventListener("click", () => foldPlane(plane, false));
      }
      if (chip) chip.hidden = false;
    } else if (chip) {
      chip.hidden = true;
    }
  }

  function wirePlaneDrag() {
    document.querySelectorAll(".plane").forEach((plane) => {
      if (plane.classList.contains("folded")) foldPlane(plane, true);
      plane.querySelector(".plane-min")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        foldPlane(plane, true);
      });
      const grip = plane.querySelector(".plane-head");
      if (!grip) return;
      grip.classList.add("plane-grip");
      let dragging = false;
      let ox = 0;
      let oy = 0;
      let sl = 0;
      let st = 0;
      plane.addEventListener("pointerdown", () => {
        document.querySelectorAll(".plane").forEach((p) => {
          p.style.zIndex = p === plane ? "18" : "12";
        });
      });
      grip.addEventListener("pointerdown", (e) => {
        if (e.target.closest("a, button, input, textarea, .plane-min")) return;
        e.preventDefault();
        e.stopPropagation();
        dragging = true;
        plane.dataset.pinned = "1";
        plane.classList.add("dragging");
        const r = plane.getBoundingClientRect();
        ox = e.clientX;
        oy = e.clientY;
        sl = r.left;
        st = r.top;
        plane.style.left = `${r.left}px`;
        plane.style.top = `${r.top}px`;
        plane.style.right = "auto";
        plane.style.bottom = "auto";
        plane.style.transition = "none";
        grip.setPointerCapture(e.pointerId);
      });
      grip.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const x = sl + e.clientX - ox;
        const y = st + e.clientY - oy;
        plane.style.left = `${Math.max(8, Math.min(window.innerWidth - 80, x))}px`;
        plane.style.top = `${Math.max(8, Math.min(window.innerHeight - 40, y))}px`;
      });
      const end = () => {
        dragging = false;
        plane.classList.remove("dragging");
      };
      grip.addEventListener("pointerup", end);
      grip.addEventListener("pointercancel", end);
    });
  }

  function wakePlane(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.classList.contains("plane")) foldPlane(el, false);
    el.classList.add("wake");
    el.style.zIndex = "16";
    window.setTimeout(() => {
      el.classList.remove("wake");
      el.style.zIndex = "";
    }, 1400);
  }

  function wireWindows(audio, wheel) {
    document.getElementById("liturgy-nav")?.addEventListener("click", (e) => {
      const a = e.target.closest("[data-nav]");
      if (!a) return;
      e.preventDefault();
      const id = a.getAttribute("data-nav");
      audio.ping("click");
      const target = id && document.getElementById(id);
      if (target?.classList.contains("plane")) foldPlane(target, false);
      if (id === "wheel") {
        wheel.shudder();
        wheel.pulse();
        triggerPulse();
        showCaption("it answers the count", 2400);
        return;
      }
      wakePlane(id);
      if (id === "measure") {
        showCaption("the rim is farther than the hand", 2400);
      } else if (id === "petition") {
        document.querySelector("#petition-form input")?.focus();
        showCaption("ask for him back. it will not keep the name unless the name was his.", 3200);
      } else if (id === "attendants") {
        showCaption("they will not introduce themselves", 2400);
      } else if (id === "approach") {
        showCaption("looking away was always the door", 2400);
      } else if (id === "boy") {
        showCaption("he asked where the lamb was", 2600);
      } else if (id === "litany") {
        showCaption("a voice like many waters, and none of them yours", 2600);
      }
    });

    const rim = document.getElementById("rim-slider");
    rim?.addEventListener("pointerup", () => {
      if (!throne.entered) return;
      audio.ping("click");
      wheel.openDistantEye();
      wheel.pulse();
      triggerPulse();
      showCaption("something distant has opened", 2800);
      window.dispatchEvent(new CustomEvent("throne:rim", { detail: { value: Number(rim.value) } }));
    });

    const depth = document.getElementById("depth-slider");
    depth?.addEventListener("input", () => {
      const v = Number(depth.value) / 100;
      audio.setDepth(v);
      wheel.nudgeZ((v - 0.45) * 0.8);
    });

    const choirBtn = document.getElementById("choir-toggle");
    choirBtn?.addEventListener("click", () => {
      const on = !throne.choir;
      audio.setChoir(on);
      choirBtn.setAttribute("aria-pressed", on ? "true" : "false");
      choirBtn.textContent = on ? "Close the choir" : "Open the choir";
      audio.ping("click");
      showCaption(on ? "the waters rise in the throat" : "the waters fall back", 2400);
    });

    document.getElementById("strike")?.addEventListener("click", () => {
      audio.strike();
      wheel.pulse();
      wheel.shudder();
      triggerPulse();
      maybeStrobe(true);
      showCaption("the rim remembers the blow", 2400);
      window.dispatchEvent(new CustomEvent("throne:strike"));
    });

    document.getElementById("reset-aspect")?.addEventListener("click", () => {
      audio.ping("click");
      window.dispatchEvent(new CustomEvent("throne:return"));
    });

    document.querySelectorAll("[data-seal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-seal");
        document.querySelectorAll("[data-seal]").forEach((b) => b.setAttribute("aria-pressed", "false"));
        btn.setAttribute("aria-pressed", "true");
        audio.ping("click");
        window.dispatchEvent(new CustomEvent("throne:seal", { detail: { id } }));
      });
    });

    document.getElementById("petition-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!throne.entered) return;
      audio.ping("click");
      const data = new FormData(e.target);
      window.dispatchEvent(
        new CustomEvent("throne:petition", {
          detail: {
            forgotten: String(data.get("forgotten") || ""),
            petition: String(data.get("petition") || ""),
          },
        })
      );
      if (witness) {
        witness.hidden = false;
        window.setTimeout(() => {
          witness.hidden = true;
          e.target.reset();
        }, 780);
      }
      triggerPulse();
    });

    let avertedArmed = false;
    averted?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      avertedArmed = true;
      averted.setAttribute("aria-pressed", "true");
      audio.ping("click");
      showCaption("it will not be touched directly", 2800);
    });
    document.addEventListener("click", (e) => {
      if (!avertedArmed || !throne.entered) return;
      if (e.target.closest(".hud-safe, .averted, .plane, .fear-not, .world-relic, .mouth")) return;
      avertedArmed = false;
      averted?.setAttribute("aria-pressed", "false");
      audio.ping("click");
      triggerPulse();
      wheel.openDistantEye();
      wheel.shudder();
      showCaption("looking away was the approach", 3200);
    });

    fleeEls.forEach((el) => {
      el.addEventListener("click", () => {
        audio.ping("click");
        wheel.shudder();
        showCaption("it runs because you reached", 2400);
      });
    });

    document.getElementById("self-hand")?.addEventListener("click", (e) => {
      e.stopPropagation();
      audio.ping("click");
      showCaption("the hand that raised it. the knife still knows the way.", 3600);
    });

    document.querySelectorAll("[data-relic]:not([data-carry])").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        audio.ping("click");
        window.dispatchEvent(new CustomEvent("throne:relic", { detail: { id: btn.getAttribute("data-relic") } }));
      });
    });

    document.querySelectorAll(".plane button, .plane a, .plane label, .plane input").forEach((el) => {
      let last = 0;
      el.addEventListener("pointerenter", () => {
        const now = performance.now();
        if (now - last < 400) return;
        last = now;
        if (throne.rng() > 0.4) audio.ping("hover");
      });
    });
  }

  function triggerPulse() {
    if (throne.calm) return;
    document.body.classList.remove("pulse-on");
    void pulseEl?.offsetWidth;
    document.body.classList.add("pulse-on");
    setTimeout(() => document.body.classList.remove("pulse-on"), 2400);
  }

  /**
   * Photosensitive safety: at most one flash, then a mandatory 420ms quiet.
   * That is ~2.4 Hz worst case, under the ~3 flashes/sec threshold.
   */
  function maybeStrobe(force = false) {
    if (throne.calm || !strobeEl) return;
    const now = performance.now();
    if (now - lastStrobe < 420) return;
    if (!force && throne.rng() > 0.08) return;
    lastStrobe = now;
    strobeEl.classList.toggle("black", throne.rng() > 0.5);
    strobeEl.classList.add("on");
    strobeOn = true;
    requestAnimationFrame(() => {
      strobeEl.classList.remove("on");
      strobeOn = false;
    });
  }

  // ----- Days counter -----
  setInterval(() => {
    if (!daysEl) return;
    days += throne.calm ? 1 : randInt(1, 17);
    daysEl.textContent = days.toLocaleString("en-US");
  }, 420);
  if (daysEl) daysEl.textContent = days.toLocaleString("en-US");

  // ----- Sacred geometry builder (13-circle net + vesica + rims) -----
  function buildSacredGeometry(svg) {
    if (!svg) return;
    const NS = "http://www.w3.org/2000/svg";
    svg.innerHTML = "";
    const g = document.createElementNS(NS, "g");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", "#c9a227");
    g.setAttribute("stroke-width", "0.12");
    const cx = 50;
    const cy = 50;
    const r = 7.2;
    const centers = [[cx, cy]];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      centers.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      centers.push([cx + Math.cos(a) * r * Math.sqrt(3), cy + Math.sin(a) * r * Math.sqrt(3)]);
    }
    centers.forEach(([x, y]) => {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", x);
      c.setAttribute("cy", y);
      c.setAttribute("r", r);
      g.appendChild(c);
    });
    // Connect all centers: Metatron's net.
    for (let i = 0; i < centers.length; i++) {
      for (let j = i + 1; j < centers.length; j++) {
        const line = document.createElementNS(NS, "line");
        line.setAttribute("x1", centers[i][0]);
        line.setAttribute("y1", centers[i][1]);
        line.setAttribute("x2", centers[j][0]);
        line.setAttribute("y2", centers[j][1]);
        line.setAttribute("stroke-opacity", "0.35");
        g.appendChild(line);
      }
    }
    const vesicaA = document.createElementNS(NS, "circle");
    vesicaA.setAttribute("cx", 42);
    vesicaA.setAttribute("cy", 50);
    vesicaA.setAttribute("r", 18);
    vesicaA.setAttribute("stroke-opacity", "0.55");
    const vesicaB = vesicaA.cloneNode();
    vesicaB.setAttribute("cx", 58);
    g.appendChild(vesicaA);
    g.appendChild(vesicaB);
    [22, 34, 46].forEach((rr) => {
      const ring = document.createElementNS(NS, "circle");
      ring.setAttribute("cx", 50);
      ring.setAttribute("cy", 50);
      ring.setAttribute("r", rr);
      ring.setAttribute("stroke-opacity", "0.4");
      g.appendChild(ring);
    });
    svg.appendChild(g);
  }

  // ----- Per-frame chaos (called from main RAF) -----
  function tick(t) {
    try {
      paintComprehension();
      tickChaos(t);
    } catch {
      /* keep the loop alive */
    }
  }

  function paintComprehension() {
    const dt = 0.016;
    if (!throne.calm) {
      if (throne.rng() < 0.01) compVel = randRange(-6, 14);
      comprehension += compVel * dt;
      if (comprehension > randRange(86, 98) || comprehension < 0) {
        comprehension = randRange(2, 12);
        compVel = randRange(1.5, 11);
      }
    } else {
      comprehension += (41 - comprehension) * 0.02;
    }
    const shown = Math.max(0, Math.min(99, comprehension));
    if (bar) bar.style.width = `${shown}%`;
    if (barVal) barVal.textContent = String(Math.floor(shown));
  }

  function tickChaos(t) {
    if (throne.entered && !throne.lore.offered && !document.documentElement.classList.contains("overwhelmed")) {
      const cx = window.innerWidth * 0.5;
      const cy = window.innerHeight * 0.48;
      const reach = Math.min(window.innerWidth, window.innerHeight) * 0.2;
      const near = Math.hypot(throne.mouse.x - cx, throne.mouse.y - cy) < reach;
      const dt = lastStareAt ? Math.min(48, t - lastStareAt) : 16;
      lastStareAt = t;
      if (t < stareCool) {
        stareMs = 0;
      } else if (near) {
        stareMs += dt;
        if (!stareWarned && stareMs > 4500) {
          stareWarned = true;
          showCaption("look away. it is filling you.", 2800);
        }
        if (stareMs > 8500) overwhelm();
      } else {
        stareMs = Math.max(0, stareMs - dt * 1.4);
        if (stareMs < 2000) stareWarned = false;
      }
    }

    if (geo && !throne.calm) {
      geo.style.opacity = String(0.12 + 0.22 * (0.5 + 0.5 * Math.sin(t * 0.0011)));
    }

    // Glitch glyphs: corrupt a few letters, then let them self-correct so copy stays readable.
    if (!throne.calm) {
      glitchEls.forEach((el) => {
        const chars = el.querySelectorAll(".ch");
        const orig = el.dataset.original || "";
        if (!chars.length) return;
        if (throne.rng() < 0.014) {
          const i = randInt(0, chars.length - 1);
          chars[i].textContent = SIGILS[randInt(0, SIGILS.length - 1)];
        }
        if (throne.rng() < 0.09 && orig) {
          const origChars = [...orig].filter((c) => c !== " " && c !== "\n" && c !== "\t");
          const i = randInt(0, chars.length - 1);
          chars[i].textContent = origChars[i] ?? chars[i].textContent;
          chars[i].style.transform = "";
        }
        if (throne.rng() < 0.03) {
          const i = randInt(0, chars.length - 1);
          chars[i].style.transform = `translate(${randRange(-1.5, 1.5)}px, ${randRange(-2, 2)}px)`;
        }
      });
    }
    if (!throne.calm && t > invertUntil && throne.rng() < 0.002) {
      const el = glitchEls[randInt(0, Math.max(0, glitchEls.length - 1))];
      if (el) el.style.transform = throne.rng() > 0.5 ? "scaleX(-1)" : "rotate(180deg)";
      invertUntil = t + 400;
      setTimeout(() => {
        el.style.transform = "";
      }, 380);
    }
    if (throne.calm) glitchEls.forEach(restoreGlyphs);

    if (!throne.calm && t - lastSwap > 7000 + throne.rng() * 6000) {
      lastSwap = t;
        const live = driftEls.filter((p) => !p.matches(":hover") && !p.dataset.pinned);
      if (live.length >= 1) {
        const a = live[randInt(0, live.length - 1)];
        a.style.transition = "left 1.4s ease, top 1.4s ease";
        a.style.left = `${randRange(4, 88)}%`;
        a.style.top = `${randRange(8, 86)}%`;
      }
    }

    // Fleeing inscription.
    if (!throne.calm) {
      fleeEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = cx - throne.mouse.x;
        const dy = cy - throne.mouse.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 140) {
          const push = ((140 - dist) / 140) * 28;
          el.style.transform = `translate(${(dx / dist) * push}px, ${(dy / dist) * push}px)`;
        } else {
          el.style.transform = "";
        }
      });
    }

    // Parallax: debris leans away from the gaze.
    if (!throne.calm && throne.entered) {
      const nx = throne.mouse.ndcX;
      const ny = throne.mouse.ndcY;
      document.querySelectorAll(".floater:not(.burst)").forEach((el, i) => {
        const k = ((i % 5) + 1) * 4;
        el.style.translate = `${(-nx * k).toFixed(1)}px ${(-ny * k).toFixed(1)}px`;
      });
      if (geo) {
        geo.style.translate = `${(-nx * 8).toFixed(1)}px ${(-ny * 6).toFixed(1)}px`;
      }
      if (chroma) {
        const speed = Math.hypot(nx, ny);
        chroma.style.opacity = String(0.45 + speed * 0.4);
      }
    } else if (chroma) {
      chroma.style.opacity = "";
    }

    // Occasional ambient strobe (still 420ms gated).
    if (!throne.calm && throne.rng() < 0.003) maybeStrobe(false);

    if (!throne.calm && throne.entered) {
      if (!nextBlurbAt) nextBlurbAt = t + 4000;
      if (t > nextBlurbAt) {
        nextBlurbAt = t + 8000 + throne.rng() * 12000;
        speakBlurb(3400);
      }
    }

    // Cursor trail.
    if (ctx2d && trail && !throne.calm && !coarse) {
      ctx2d.clearRect(0, 0, trail.width, trail.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx2d.save();
        ctx2d.translate(p.x, p.y);
        ctx2d.globalAlpha = p.life * 0.7;
        ctx2d.strokeStyle = p.gold ? "#f0d078" : "#8a5a22";
        ctx2d.fillStyle = "rgba(244,241,232,0.8)";
        ctx2d.beginPath();
        ctx2d.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.beginPath();
        ctx2d.arc(0, 0, p.r * 0.28, 0, Math.PI * 2);
        ctx2d.fillStyle = "#050308";
        ctx2d.fill();
        ctx2d.restore();
      }
      // Custom cursor: a small burning wheel / eye at the pointer.
      if (throne.entered) {
        const x = throne.mouse.x;
        const y = throne.mouse.y;
        ctx2d.save();
        ctx2d.translate(x, y);
        const spinMul = document.body.classList.contains("gazing") ? 2.2 : 1;
        ctx2d.rotate((t * 0.0018) * spinMul);
        ctx2d.strokeStyle = "#f0d078";
        ctx2d.lineWidth = 1.2;
        ctx2d.beginPath();
        ctx2d.arc(0, 0, 11, 0, Math.PI * 2);
        ctx2d.stroke();
        ctx2d.beginPath();
        ctx2d.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
        ctx2d.stroke();
        ctx2d.beginPath();
        ctx2d.arc(0, 0, 2.2, 0, Math.PI * 2);
        ctx2d.fillStyle = "#3d1c08";
        ctx2d.fill();
        ctx2d.restore();
      }
    } else if (ctx2d && trail) {
      ctx2d.clearRect(0, 0, trail.width, trail.height);
    }
  }

  return {
    tick,
    setCalm(on) {
      if (on) {
        strobeEl?.classList.remove("on");
        glitchEls.forEach(restoreGlyphs);
        particles.length = 0;
        if (ctx2d && trail) ctx2d.clearRect(0, 0, trail.width, trail.height);
        document.body.classList.remove("cycle-kick", "shock", "reversed", "seal-wake", "frenzy", "jitter", "rim-live", "aspect-wake");
        document.querySelectorAll(".floater").forEach((el) => {
          el.style.translate = "";
          el.style.transform = "";
        });
      }
    },
  };
}
