/**
 * chaosUI.js — Nonsense Liturgy + optical overlays
 *
 * Map of effects:
 *   glitchText     — invented glyphs, tremble, brief mirror/invert; restored in Calm Mode
 *   layoutSwap     — unobserved panels trade places on a seeded interval
 *   nav            — every item scrolls to a random section
 *   fearNot        — shudder + spawn three smaller copies (capped)
 *   petition       — modal "witnessed" then immediately closes
 *   rimSlider      — no live change; on release, a distant eye opens / palette snaps
 *   comprehension  — fills, resets, never reaches 100
 *   flee           — one inscription runs from the cursor
 *   averted click  — Approach only registers when the cursor is NOT on it
 *   days counter   — absurd ticking number
 *   cursor trail   — decaying eye/sparks (skipped on coarse pointers)
 *   sacred geometry— Metatron-ish linework + vesica, counter-rotating
 *   strobe         — single-frame black/white, NEVER more than ~2.5 flashes/sec
 *   wing pulse     — slow radial wash from center
 */

import { throne, randRange, randInt, showCaption } from "./throne.js";

/** Invented sigils. Not Hebrew, not any real liturgical script. */
const SIGILS = "◊◈◉◎◌◍◐◑◒◓◔◕◘◙☿♄♃♁☥⚜⚝✦✧✩✪✫✬✭✮✯✰❋❊❈❇✺✹✸✷✶✵✴✳";

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
  const planes = [...document.querySelectorAll("[data-swap]")];
  const glitchEls = [...document.querySelectorAll("[data-glitch]")].filter((el) => !el.closest("#veil"));
  const sections = [...document.querySelectorAll("[data-section]")];

  glitchEls.forEach(wrapGlyphs);

  let lastStrobe = 0;
  let strobeOn = false;
  let comprehension = randRange(4, 18);
  let compVel = randRange(2, 9);
  let days = 2_198_447 + Math.floor(throne.rng() * 90000);
  let lastSwap = 0;
  let invertUntil = 0;
  let fearCount = 0;
  const MAX_FEAR = 21;

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

  // ----- Cursor + particles -----
  window.addEventListener("pointermove", (e) => {
    throne.mouse.x = e.clientX;
    throne.mouse.y = e.clientY;
    throne.mouse.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    throne.mouse.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    if (throne.calm || coarse || !throne.entered) return;
    if (particles.length < (throne.quality === "low" ? 40 : 90)) {
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

  // ----- Nav: the way is not the way you expect -----
  document.getElementById("liturgy-nav")?.addEventListener("click", (e) => {
    const a = e.target.closest("[data-nav]");
    if (!a) return;
    e.preventDefault();
    if (!sections.length) return;
    const pick = sections[Math.floor(throne.rng() * sections.length)];
    pick.scrollIntoView({ behavior: throne.calm ? "smooth" : "auto", block: "center" });
    showCaption("the way is not the way you expect");
    audio.ping("click");
  });

  // ----- Fear Not -----
  function bindFear(btn) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      audio.ping("click");
      if (!throne.calm) {
        document.body.classList.add("shudder");
        wheel.shudder();
        setTimeout(() => document.body.classList.remove("shudder"), 900);
      }
      showCaption("be not afraid is an instruction, not a comfort");
      window.dispatchEvent(new CustomEvent("throne:fearnot", { detail: { muted: throne.muted } }));
      if (throne.calm) return;
      const spawn = Math.min(3, MAX_FEAR - 1 - fearCount);
      for (let i = 0; i < spawn; i++) {
        const n = btn.cloneNode(true);
        n.classList.add("spawned");
        n.style.left = `${randRange(8, 86)}vw`;
        n.style.top = `${randRange(18, 82)}vh`;
        n.style.transform = `rotate(${randRange(-18, 18)}deg) scale(${randRange(0.62, 0.92)})`;
        document.body.appendChild(n);
        fearCount++;
        bindFear(n);
      }
    });
  }
  const fearRoot = document.getElementById("fear-not");
  if (fearRoot) bindFear(fearRoot);

  // ----- Petition: witnessed, then gone -----
  document.getElementById("petition-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    audio.ping("click");
    const data = new FormData(e.target);
    window.dispatchEvent(
      new CustomEvent("throne:petition", {
        detail: {
          forgotten: data.get("forgotten") || "",
          petition: data.get("petition") || "",
          direction: data.get("direction") || "",
        },
      })
    );
    if (!witness) return;
    witness.hidden = false;
    showCaption("Your petition has been witnessed", 800);
    setTimeout(() => {
      witness.hidden = true;
      e.target.reset();
    }, 720);
  });

  // ----- Slider: inert until release -----
  const slider = document.getElementById("rim-slider");
  slider?.addEventListener("input", () => {
    /* deliberately does nothing while dragging */
  });
  slider?.addEventListener("pointerup", () => {
    audio.ping("click");
    wheel.openDistantEye();
    wheel.setPalette(randInt(0, 2));
    document.body.classList.remove("palette-gold", "palette-white", "palette-violet");
    document.body.classList.add(["palette-gold", "palette-white", "palette-violet"][throne.palette]);
    showCaption("something distant has opened");
    triggerPulse();
    window.dispatchEvent(new CustomEvent("throne:rim", { detail: { value: Number(slider.value) } }));
  });

  // ----- Averted button: only counts when you are not on it -----
  let avertedArmed = false;
  averted?.addEventListener("pointerenter", () => {
    avertedArmed = true;
    audio.ping("hover");
  });
  averted?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showCaption("it will not be touched directly");
  });
  document.addEventListener("click", (e) => {
    if (!avertedArmed || !throne.entered) return;
    if (e.target.closest(".hud-safe")) return;
    if (averted && (averted === e.target || averted.contains(e.target))) return;
    avertedArmed = false;
    showCaption("looking away was the approach");
    audio.ping("click");
    triggerPulse();
    document.body.classList.toggle("palette-violet");
  });

  // ----- Hover bells (sparse: only planes, not every pixel) -----
  document.querySelectorAll(".plane a, .plane button, .plane label").forEach((el) => {
    let last = 0;
    el.addEventListener("pointerenter", () => {
      const now = performance.now();
      if (now - last < 400) return;
      last = now;
      if (throne.rng() > 0.45) audio.ping("hover");
    });
  });

  window.addEventListener("throne:cycle", () => {
    audio.swell();
    triggerPulse();
    maybeStrobe(true);
    if (!throne.calm && throne.rng() > 0.6) {
      showCaption("it has already looked at you");
    }
  });
  window.addEventListener("throne:pulse", () => triggerPulse());

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
    const dt = 0.016;

    // Comprehension bar: inconsistent velocity, hard reset before 100.
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

    // Geometry opacity flicker (slow, not a strobe).
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
      const el = glitchEls[randInt(0, glitchEls.length - 1)];
      el.style.transform = throne.rng() > 0.5 ? "scaleX(-1)" : "rotate(180deg)";
      invertUntil = t + 400;
      setTimeout(() => {
        el.style.transform = "";
      }, 380);
    }
    if (throne.calm) glitchEls.forEach(restoreGlyphs);

    // Layout swap when unobserved: exchange margins and tilt, not DOM order.
    if (!throne.calm && t - lastSwap > 9000 + throne.rng() * 7000) {
      lastSwap = t;
      const live = planes.filter((p) => !p.matches(":hover"));
      if (live.length >= 2) {
        const a = live[randInt(0, live.length - 1)];
        let b = live[randInt(0, live.length - 1)];
        if (a === b) b = live[(live.indexOf(a) + 1) % live.length];
        a.style.transition = "transform 0.9s ease, margin 0.9s ease";
        b.style.transition = "transform 0.9s ease, margin 0.9s ease";
        const am = a.style.marginLeft;
        const at = a.style.transform;
        a.style.marginLeft = b.style.marginLeft || `${randRange(4, 36)}vw`;
        b.style.marginLeft = am || `${randRange(4, 36)}vw`;
        a.style.transform = at && at.includes("rotate") ? b.style.transform : `rotate(${randRange(-8, 8)}deg)`;
        b.style.transform = `rotate(${randRange(-8, 8)}deg)`;
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

    // Occasional ambient strobe (still 420ms gated).
    if (!throne.calm && throne.rng() < 0.003) maybeStrobe(false);

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
        ctx2d.strokeStyle = p.gold ? "#f0d078" : "#c77dff";
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
        ctx2d.fillStyle = "#6b2d9a";
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
        planes.forEach((p) => {
          p.style.transform = "";
        });
        particles.length = 0;
        if (ctx2d && trail) ctx2d.clearRect(0, 0, trail.width, trail.height);
      }
    },
  };
}
