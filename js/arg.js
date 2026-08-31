/**
 * arg.js — the page keeps a ledger the UI does not read aloud.
 *
 * Hold the mouth to enter. Drag Fear Not into the mouth to feed it. Hold Fear Not to unmake it.
 * Drag the orbit to retune the drone. Seals rewrite the voice.
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

  function rapture(on) {
    if (!!on === throne.raptured) return;
    wheel.setRapture(on);
    audio.setRapture(on);
    if (on) showCaption("you are inside the count", 2400);
    else showCaption("", 1);
  }

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

  window.addEventListener("throne:fearnot", (e) => {
    if (e.detail?.muted) become("inverted");
  });

  window.addEventListener("throne:rapture", (e) => rapture(!!e.detail?.on));
  window.addEventListener("throne:fed", (e) => {
    if (e.detail?.fed >= 7) rapture(true);
  });

  window.addEventListener("throne:flee", () => {
    state.fleeHits += 1;
    if (state.fleeHits >= 3) {
      audio.strike();
      become("hush");
    }
  });

  document.querySelectorAll("[data-seal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-seal");
      btn.classList.add("lit");
      btn.setAttribute("aria-pressed", "true");
      audio.ping("click");
      if (id === "voice") {
        audio.setChoir(true);
        document.getElementById("choir-toggle")?.setAttribute("aria-pressed", "true");
      }
      if (id === "fire") audio.strike();
      if (id === "rim") audio.setDepth(0.72);
      if (id === "gate") audio.setDepth(0.15);
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
  });

  document.getElementById("depth-slider")?.addEventListener("input", (e) => {
    audio.setDepth(Number(e.target.value) / 100);
  });

  document.getElementById("strike")?.addEventListener("click", () => {
    audio.strike();
    window.dispatchEvent(new CustomEvent("throne:pulse"));
  });

  // Return the first shape by typing WITNESS. No labeled reset.

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
    if (state.typed.includes("MANYWATERS")) {
      state.typed = "";
      become("waters");
    }
    if (state.typed.includes("INWARD")) {
      state.typed = "";
      rapture(true);
    }
    if (state.typed.includes("WITNESS")) {
      state.typed = "";
      rapture(false);
      document.querySelectorAll("[data-seal]").forEach((b) => {
        b.classList.remove("lit");
        b.setAttribute("aria-pressed", "false");
      });
      state.seals = [];
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
    if (e.target.closest(".hud-safe, .relic, .orbit, .mouth, .fear-not, button, input, textarea, a")) return;
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
