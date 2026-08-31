/**
 * calmMode.js — Accessibility kill-switch
 *
 * Persistent toggle. Exempt from chaos. When on:
 *   - html.calm class (CSS kills strobe, scanlines, swaps, trails)
 *   - audio near-silent
 *   - wheel spin crawls, blinks freeze
 *   - text/layout stabilize
 *
 * prefers-reduced-motion: we default Calm Mode ON and keep it on if the OS setting is active.
 */

import { throne } from "./throne.js";

export function createCalmMode({ audio, chaos }) {
  const btn = document.getElementById("calm-toggle");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  function apply(on, { fromSystem = false } = {}) {
    throne.calm = on;
    document.documentElement.classList.toggle("calm", on);
    if (btn) {
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.textContent = on ? "Calm Mode on" : "Calm Mode";
    }
    audio.setCalm(on);
    chaos.setCalm(on);
    if (on) {
      window.dispatchEvent(new CustomEvent("throne:rapture", { detail: { on: false } }));
    }
    if (fromSystem && on) {
      btn?.setAttribute("title", "Your system asked for less motion. Calm Mode is on.");
    }
  }

  function systemWantsCalm() {
    return reduce.matches;
  }

  if (systemWantsCalm()) apply(true, { fromSystem: true });

  reduce.addEventListener("change", (e) => {
    if (e.matches) apply(true, { fromSystem: true });
  });

  btn?.addEventListener("click", () => {
    if (systemWantsCalm() && throne.calm) {
      // Still allow turning it off, but it is the user's explicit choice.
      apply(false);
      return;
    }
    apply(!throne.calm);
  });

  return { apply, systemWantsCalm };
}
