/**
 * arg.js — the page keeps a ledger the UI does not read aloud.
 *
 * Hold the mouth to enter. Drag Fear Not into the mouth to feed it. Hold Fear Not to unmake it.
 * Drag the void to turn around it.
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

export function createArg({ audio, wheel }) {
  const state = {
    daysClicks: 0,
    lastDay: 0,
    typed: "",
    holdingHum: false,
    choirBeforeHum: false,
    merkavahOnce: false,
  };

  function rapture(on) {
    if (!!on === throne.raptured) return;
    wheel.setRapture(on);
    audio.setRapture(on);
    if (on) {
      showCaption("you are inside the count", 2400);
      audio.utter();
    } else {
      showCaption("", 1);
      audio.ping("mouth");
    }
  }

  function become(id, caption) {
    if (!id || id === throne.aspect) {
      if (id === throne.aspect && caption) showCaption(caption, 2800);
      return;
    }
    wheel.setAspect(id);
    audio.setAspect(id);
    audio.utter();
    showCaption(caption || ASPECT_CAPTIONS[id] || "", 3200);
    window.dispatchEvent(new CustomEvent("throne:aspect", { detail: { id } }));
  }

  function applyHash() {
    const raw = (location.hash || "").replace("#", "").toLowerCase();
    const known = ["witness", "unblinking", "merkavah", "waters", "seraph", "inverted", "name", "hush"];
    if (known.includes(raw) && throne.entered) become(raw);
  }

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
    }
  });

  window.addEventListener("throne:orbit", (e) => {
    const yaw = Math.abs(Number(e.detail?.yaw) || 0);
    if (!state.merkavahOnce && yaw > Math.PI * 2) {
      state.merkavahOnce = true;
      become("merkavah");
    }
  });

  window.addEventListener("throne:fearnot", (e) => {
    if (e.detail?.muted) become("inverted");
  });

  window.addEventListener("throne:rapture", (e) => rapture(!!e.detail?.on));
  window.addEventListener("throne:fed", (e) => {
    if (e.detail?.fed >= 7) rapture(true);
  });

  window.addEventListener("keydown", (e) => {
    if (e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
    if (e.code === "Space" && throne.entered) {
      e.preventDefault();
      if (!state.holdingHum) {
        state.holdingHum = true;
        state.choirBeforeHum = throne.choir;
        audio.setChoir(true);
        audio.utter();
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
      become("witness", ASPECT_CAPTIONS.witness);
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" && state.holdingHum) {
      state.holdingHum = false;
      audio.setChoir(state.choirBeforeHum);
    }
  });

  window.addEventListener("hashchange", applyHash);

  return {
    become,
    onEntered() {
      applyHash();
    },
  };
}
