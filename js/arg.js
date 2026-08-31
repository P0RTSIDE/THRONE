/**
 * arg.js — the page keeps a ledger the UI does not read aloud.
 *
 * Visible toys (choir, depth, seals, strike, space-to-hum, drag-to-tilt)
 * sit beside quieter doors that rewrite the angel:
 *   days-value clicked seven times
 *   rim released at 72
 *   petition that names many waters
 *   typed instruction BE NOT AFRAID
 *   Fear Not while muted
 *   four seals in the attending order
 *   direction field turned inward
 *   catching the fleeing line three times
 *   hash names for those who already know the way back
 */

import { throne, showCaption } from "./throne.js";

const ASPECT_CAPTIONS = {
  witness: "it returns to the shape you first survived",
  unblinking: "it declines to close",
  merkavah: "another rim remembers itself",
  waters: "the voice is not one voice",
  seraph: "the instruction is taken literally",
  inverted: "it heard the quiet as an answer",
  name: "one eye is enough, if it is the right one",
  hush: "the wheels still turn. they do not comment.",
};

const SECRET_ORDER = ["voice", "rim", "fire", "gate"];

export function createArg({ audio, wheel }) {
  const state = {
    daysClicks: 0,
    lastDay: 0,
    seals: [],
    fleeHits: 0,
    typed: "",
    holdingHum: false,
    choirBeforeHum: false,
  };

  function become(id, caption) {
    if (!id || id === throne.aspect) {
      if (id === throne.aspect && caption) showCaption(caption, 2800);
      return;
    }
    wheel.setAspect(id);
    audio.setAspect(id);
    showCaption(caption || ASPECT_CAPTIONS[id] || "", 3200);
    window.dispatchEvent(new CustomEvent("throne:aspect", { detail: { id } }));
  }

  function applyHash() {
    const raw = (location.hash || "").replace("#", "").toLowerCase();
    const known = ["witness", "unblinking", "merkavah", "waters", "seraph", "inverted", "name", "hush"];
    if (known.includes(raw) && throne.entered) become(raw);
  }

  // Quiet console breadcrumb. Not a walkthrough.
  console.info("%cthe wheels keep a ledger.", "color:#c9a227");
  Object.defineProperty(window, "ledger", {
    configurable: true,
    get() {
      console.info("%c72", "color:#f0d078;font-size:18px");
      return 72;
    },
  });

  document.getElementById("days-counter")?.addEventListener("click", () => {
    if (!throne.entered) return;
    const now = performance.now();
    if (now - state.lastDay > 2500) state.daysClicks = 0;
    state.lastDay = now;
    state.daysClicks += 1;
    audio.ping("click");
    if (state.daysClicks >= 7) {
      state.daysClicks = 0;
      become("unblinking");
    } else if (state.daysClicks === 3) {
      showCaption("the count is not finished");
    }
  });

  window.addEventListener("throne:rim", (e) => {
    const v = Math.round(Number(e.detail?.value));
    if (v === 72) become("merkavah");
  });

  window.addEventListener("throne:petition", (e) => {
    const petition = String(e.detail?.petition || "").toLowerCase();
    const direction = String(e.detail?.direction || "").toLowerCase();
    const forgotten = String(e.detail?.forgotten || "").toLowerCase();
    if (petition.includes("many waters")) become("waters");
    else if (direction.includes("inward")) become("hush");
    else if (forgotten.trim() === "ledger") {
      showCaption("the rim remembers seventy-two");
    }
  });

  window.addEventListener("throne:fearnot", (e) => {
    if (e.detail?.muted) become("inverted");
  });

  window.addEventListener("throne:flee", () => {
    state.fleeHits += 1;
    if (state.fleeHits >= 3) {
      showCaption("you were not meant to catch it. now it knows you can.");
      audio.strike();
    }
  });

  document.querySelectorAll("[data-seal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-seal");
      btn.classList.add("lit");
      btn.setAttribute("aria-pressed", "true");
      audio.ping("click");
      state.seals.push(id);
      const lastFour = state.seals.slice(-4);
      const allLit = [...document.querySelectorAll("[data-seal]")].every((b) => b.classList.contains("lit"));
      if (lastFour.length === 4 && lastFour.every((s, i) => s === SECRET_ORDER[i])) {
        become("name");
        return;
      }
      if (allLit && throne.aspect !== "name") {
        become("merkavah");
      }
    });
  });

  document.getElementById("choir-toggle")?.addEventListener("click", () => {
    const next = !throne.choir;
    audio.setChoir(next);
    const btn = document.getElementById("choir-toggle");
    btn?.setAttribute("aria-pressed", next ? "true" : "false");
    if (btn) btn.textContent = next ? "Choir is listening" : "Open the choir";
    showCaption(next ? "the waters rise in the mouth" : "the choir folds itself away");
  });

  document.getElementById("depth-slider")?.addEventListener("input", (e) => {
    audio.setDepth(Number(e.target.value) / 100);
  });

  document.getElementById("strike")?.addEventListener("click", () => {
    audio.strike();
    showCaption("the rim answers");
    window.dispatchEvent(new CustomEvent("throne:pulse"));
  });

  document.getElementById("reset-aspect")?.addEventListener("click", () => {
    document.querySelectorAll("[data-seal]").forEach((b) => {
      b.classList.remove("lit");
      b.setAttribute("aria-pressed", "false");
    });
    state.seals = [];
    audio.setChoir(false);
    const choir = document.getElementById("choir-toggle");
    if (choir) {
      choir.setAttribute("aria-pressed", "false");
      choir.textContent = "Open the choir";
    }
    become("witness", ASPECT_CAPTIONS.witness);
  });

  window.addEventListener("keydown", (e) => {
    if (e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
    if (e.code === "Space" && throne.entered) {
      e.preventDefault();
      if (!state.holdingHum) {
        state.holdingHum = true;
        state.choirBeforeHum = throne.choir;
        audio.setChoir(true);
      }
      return;
    }
    if (e.key.length !== 1) return;
    state.typed = (state.typed + e.key.toUpperCase()).slice(-24);
    if (state.typed.includes("BENOTAFRAID")) {
      state.typed = "";
      become("seraph");
    }
    if (state.typed.includes("WITNESS")) {
      state.typed = "";
      become("witness", ASPECT_CAPTIONS.witness);
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" && state.holdingHum) {
      state.holdingHum = false;
      audio.setChoir(state.choirBeforeHum);
    }
  });

  window.addEventListener("pointermove", (e) => {
    if (!throne.entered || e.buttons !== 1) return;
    if (e.target.closest(".hud-safe, .plane, button, input, textarea, a")) return;
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = -((e.clientY / window.innerHeight) * 2 - 1);
    wheel.tilt(nx, ny);
  });
  window.addEventListener("pointerup", () => wheel.tilt(0, 0));

  window.addEventListener("hashchange", applyHash);

  return {
    become,
    onEntered() {
      applyHash();
    },
  };
}
