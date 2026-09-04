/**
 * main.js — THRONE bootstrap
 *
 * Order of operations:
 *   1. Seed the session PRNG (stable for this tab load).
 *   2. Probe device quality and throttle eye/particle counts.
 *   3. Build wheel, audio, chaos UI.
 *   4. Wire volume (always reachable).
 *   5. Wait for the veil gesture (required to start Web Audio).
 *   6. Drive chaos overlays from a shared rAF loop. The wheel has its own rAF.
 */

import { throne, mulberry32, probeQuality, showCaption } from "./throne.js";
import { createEyeWheel, createFallbackWheel } from "./eyeWheel.js";
import { createAudioEngine } from "./audioEngine.js";
import { createChaosUI } from "./chaosUI.js";
import { createArg } from "./arg.js";
import { createAbyss } from "./abyss.js";
import { createGodMode } from "./godMode.js";

(function boot() {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get("seed")) || (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
  throne.seed = seed;
  throne.rng = mulberry32(seed);
  throne.quality = probeQuality();
  console.info(`[THRONE] seed=${seed} quality=${throne.quality}`);

  const root = document.getElementById("wheel-root");
  let wheel;
  try {
    wheel = createEyeWheel(root);
  } catch (err) {
    console.warn("[THRONE] WebGL wheel failed, using fallback rings.", err);
    wheel = createFallbackWheel(root);
  }

  const audio = createAudioEngine();
  const abyss = createAbyss(document.getElementById("abyss"));
  const chaos = createChaosUI({ audio, wheel });
  const arg = createArg({ audio, wheel });
  createGodMode({ audio, wheel, arg });

  const vol = document.getElementById("volume");
  vol?.addEventListener("input", () => {
    const v = Number(vol.value);
    audio.setVolume(v);
    if (v > 0.001 && throne.muted) audio.setMuted(false);
  });

  const veil = document.getElementById("veil");
  const enter = document.getElementById("enter");

  async function enterThrone() {
    if (throne.entered) return;
    throne.entered = true;
    document.documentElement.classList.add("entered");
    try {
      await audio.start();
    } catch (err) {
      console.warn("[THRONE] audio could not start", err);
    }
    showCaption("you came to bring him back. the hill is still in your hands.", 8000);
    arg.onEntered();
    setTimeout(() => {
      veil?.setAttribute("hidden", "true");
      veil?.setAttribute("aria-hidden", "true");
    }, 1300);
  }

  enter?.addEventListener("click", (e) => {
    e.stopPropagation();
    enterThrone();
  });
  veil?.addEventListener("click", enterThrone);

  function loop(now) {
    abyss.tick(now);
    if (throne.entered) chaos.tick(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
