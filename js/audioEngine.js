/**
 * audioEngine.js — Voice of Many Waters
 *
 * All sound is synthesized. No samples, no copyrighted music.
 *
 * Layers:
 *   drone   — detuned saws and a sub under a lowpass (engine in the floor, not a choir).
 *   formant — low bandpasses that wander like a throat, not glass.
 *   hits    — alien bass thumps and wobbles on user input. No bells.
 *   swell   — when the outer wheel completes a turn, the drone rises a few dB then falls.
 *
 * Routing: sources -> layer gains -> compressor -> calmGain -> muteGain -> master -> destination
 */

import { throne, randRange } from "./throne.js";

function makeOsc(ctx, type, freq) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  return osc;
}

export function createAudioEngine() {
  let ctx = null;
  let master;
  let muteGain;
  let calmGain;
  let droneGain;
  let formantGain;
  let bellGain;
  let swellGain;
  let started = false;
  let droneOscs = [];
  let filters = [];
  let formantOsc = null;
  let formantFilters = [];
  let extraOsc = null;
  let extraGain = null;
  let noiseG = null;
  let choirMul = 1;
  let depth = 0.45;
  let aspectId = "witness";
  let formantMul = 1;
  let reverseAlways = false;
  let droneMul = 1;
  let raptureMul = 1;
  let delayG = null;
  let scrapeGain = null;
  let scrapeFilter = null;
  let chargeOsc = null;
  let chargeGain = null;
  let noiseSrc = null;
  let raf = 0;

  function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    return ctx;
  }

  function makeNoise(ctx) {
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // Brown-ish noise: slightly integrated white, thunder texture not hiss.
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  function buildGraph() {
    const c = ctx;
    master = c.createGain();
    master.gain.value = throne.volume;

    muteGain = c.createGain();
    muteGain.gain.value = throne.muted ? 0 : 1;

    calmGain = c.createGain();
    calmGain.gain.value = throne.calm ? 0.04 : 1;

    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;

    droneGain = c.createGain();
    droneGain.gain.value = 0.22;
    swellGain = c.createGain();
    swellGain.gain.value = 1;
    formantGain = c.createGain();
    formantGain.gain.value = 0.06;
    bellGain = c.createGain();
    bellGain.gain.value = 0.22;

    droneGain.connect(swellGain);
    swellGain.connect(comp);
    formantGain.connect(comp);
    bellGain.connect(comp);
    comp.connect(calmGain);
    calmGain.connect(muteGain);
    muteGain.connect(master);
    master.connect(c.destination);

    // --- Drone: a sub plus beating saws, kept under a lowpass so it stays in the floor ---
    const base = 36.7;
    const specs = [
      { f: base, type: "sine", det: 0 },
      { f: base * 1.01, type: "sawtooth", det: 0.6 },
      { f: base * 0.5, type: "sine", det: -0.15 },
      { f: base * 2.02, type: "square", det: 0.28 },
    ];
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 140;
    lp.Q.value = 1.1;
    filters.push(lp);
    lp.connect(droneGain);

    droneOscs = specs.map((s) => {
      const osc = makeOsc(c, s.type, s.f + s.det);
      osc.connect(lp);
      osc.start();
      return osc;
    });

    noiseSrc = makeNoise(c);
    const noiseLp = c.createBiquadFilter();
    noiseLp.type = "lowpass";
    noiseLp.frequency.value = 160;
    noiseG = c.createGain();
    noiseG.gain.value = 0.18;
    noiseSrc.connect(noiseLp);
    noiseLp.connect(noiseG);
    noiseG.connect(droneGain);
    noiseSrc.start();
    filters.push(noiseLp);

    scrapeFilter = c.createBiquadFilter();
    scrapeFilter.type = "lowpass";
    scrapeFilter.frequency.value = 90;
    scrapeFilter.Q.value = 2.4;
    scrapeGain = c.createGain();
    scrapeGain.gain.value = 0;
    noiseSrc.connect(scrapeFilter);
    scrapeFilter.connect(scrapeGain);
    scrapeGain.connect(comp);

    extraOsc = makeOsc(c, "sawtooth", base * 1.49);
    extraGain = c.createGain();
    extraGain.gain.value = 0.0001;
    extraOsc.connect(extraGain);
    extraGain.connect(droneGain);
    extraOsc.start();

    const delay = c.createDelay(0.45);
    delay.delayTime.value = 0.16;
    delayG = c.createGain();
    delayG.gain.value = 0;
    formantGain.connect(delay);
    delay.connect(delayG);
    delayG.connect(comp);

    // --- Formant "voices": a pulse-adjacent saw into three moving bandpasses ---
    formantOsc = makeOsc(c, "sawtooth", 48);
    const fg = c.createGain();
    fg.gain.value = 0.22;
    formantOsc.connect(fg);
    const bands = [72, 140, 260];
    formantFilters = bands.map((f) => {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f;
      bp.Q.value = 9;
      fg.connect(bp);
      bp.connect(formantGain);
      return bp;
    });
    formantOsc.start();
  }

  function modulate(now) {
    if (!ctx || ctx.state !== "running") return;
    // Never-quite-looping filter wander.
    const lp = filters[0];
    if (lp) {
      const baseHz = 70 + depth * 90;
      const hz = baseHz + 28 * Math.sin(now * 0.07) + 14 * Math.sin(now * 0.023 + 1.7);
      lp.frequency.setTargetAtTime(hz, ctx.currentTime, 0.4);
    }
    droneOscs.forEach((osc, i) => {
      const wobble = Math.sin(now * (0.011 + i * 0.003) + i) * (0.15 + i * 0.05);
      osc.detune.setTargetAtTime(wobble * 12, ctx.currentTime, 0.5);
    });

    // Morph formants through invented vowel-ish points; occasional reverse-feeling downward sweep.
    if (formantFilters.length) {
      const reverse = reverseAlways || Math.sin(now * 0.04) > 0.75;
      const a = 0.5 + 0.5 * Math.sin(now * 0.13);
      const targets = reverse
        ? [110 - a * 40, 190 - a * 50, 310 - a * 70]
        : [64 + a * 36, 120 + a * 70, 210 + a * 80];
      formantFilters.forEach((bp, i) => {
        bp.frequency.setTargetAtTime(targets[i], ctx.currentTime, reverse ? 0.08 : 0.6);
      });
      if (formantOsc) {
        formantOsc.frequency.setTargetAtTime(38 + 10 * Math.sin(now * 0.09), ctx.currentTime, 0.3);
      }
      // Sparse presence: voices swell in and out so they are not a constant choir.
      const presence =
        (0.02 + 0.04 * Math.max(0, Math.sin(now * 0.19) * Math.sin(now * 0.05))) *
        choirMul *
        formantMul *
        raptureMul;
      formantGain.gain.setTargetAtTime(presence, ctx.currentTime, 0.4);
    }
    if (droneGain) droneGain.gain.setTargetAtTime(0.22 * droneMul, ctx.currentTime, 0.35);
  }

  function loop() {
    if (!started) return;
    modulate(ctx.currentTime);
    raf = requestAnimationFrame(loop);
  }

  return {
    async start() {
      ensureContext();
      if (ctx.state === "suspended") await ctx.resume();
      if (!started) {
        buildGraph();
        started = true;
        loop();
      }
      this.applyFlags();
    },
    applyFlags() {
      if (!ctx) return;
      const t = ctx.currentTime;
      if (master) master.gain.setTargetAtTime(throne.volume, t, 0.05);
      if (muteGain) muteGain.gain.setTargetAtTime(throne.muted ? 0 : 1, t, 0.04);
      if (calmGain) calmGain.gain.setTargetAtTime(throne.calm ? 0.04 : 1, t, 0.12);
    },
    setMuted(muted) {
      throne.muted = muted;
      this.applyFlags();
    },
    setVolume(v) {
      throne.volume = v;
      if (v <= 0.001) throne.muted = true;
      this.applyFlags();
    },
    setCalm(on) {
      throne.calm = on;
      this.applyFlags();
      this.scrape(0);
      this.charge(false);
    },
    /** Alien bass thump. Low carrier, bent by a slower modulator, then crushed under a lowpass. */
    ping(kind = "click") {
      if (!started || !ctx || throne.muted || throne.calm) return;
      const c = ctx;
      const t0 = c.currentTime;
      const table = {
        hover: { f: [28, 42], g: 0.14, d: 0.55, drop: 0.72 },
        click: { f: [24, 38], g: 0.28, d: 0.85, drop: 0.55 },
        drag: { f: [18, 30], g: 0.2, d: 0.5, drop: 0.8 },
        zoom: { f: [22, 34], g: 0.18, d: 0.6, drop: 0.62 },
        mouth: { f: [16, 26], g: 0.32, d: 1.5, drop: 0.45 },
      };
      const spec = table[kind] || table.click;
      const carrierF = randRange(spec.f[0], spec.f[1]);
      const car = makeOsc(c, "sawtooth", carrierF);
      const sub = makeOsc(c, "sine", carrierF * 0.5);
      const mod = makeOsc(c, "sine", randRange(1.6, 6.4));
      const modGain = c.createGain();
      modGain.gain.value = randRange(12, 36);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 220;
      lp.Q.value = 3.2;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(spec.g, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.d);
      car.frequency.exponentialRampToValueAtTime(Math.max(12, carrierF * spec.drop), t0 + spec.d);
      sub.frequency.exponentialRampToValueAtTime(Math.max(10, carrierF * spec.drop * 0.5), t0 + spec.d);
      mod.connect(modGain);
      modGain.connect(car.frequency);
      car.connect(lp);
      sub.connect(lp);
      lp.connect(g);
      g.connect(bellGain);
      car.start(t0);
      sub.start(t0);
      mod.start(t0);
      car.stop(t0 + spec.d + 0.15);
      sub.stop(t0 + spec.d + 0.15);
      mod.stop(t0 + spec.d + 0.15);
    },
    /** Grit that follows drag speed. Zero to rest. */
    scrape(speed) {
      if (!scrapeGain || !ctx) return;
      const t = ctx.currentTime;
      const g = !started || throne.muted || throne.calm ? 0 : Math.min(0.28, Math.max(0, speed) * 0.018);
      scrapeGain.gain.setTargetAtTime(g, t, 0.05);
      if (scrapeFilter) {
        scrapeFilter.frequency.setTargetAtTime(48 + Math.min(speed, 48) * 4, t, 0.08);
      }
    },
    /** Hold-the-mouth rising tone. */
    charge(on) {
      if (!started || !ctx) return;
      const t = ctx.currentTime;
      if (on) {
        if (throne.muted || throne.calm) return;
        if (chargeOsc) {
          try { chargeOsc.stop(); } catch { /* already stopped */ }
          chargeOsc = null;
        }
        chargeOsc = makeOsc(ctx, "sawtooth", 22);
        chargeGain = ctx.createGain();
        chargeGain.gain.setValueAtTime(0.0001, t);
        chargeGain.gain.exponentialRampToValueAtTime(0.22, t + 0.08);
        chargeOsc.frequency.exponentialRampToValueAtTime(48, t + 1.32);
        const chargeLp = ctx.createBiquadFilter();
        chargeLp.type = "lowpass";
        chargeLp.frequency.value = 160;
        chargeLp.Q.value = 6;
        chargeOsc.connect(chargeLp);
        chargeLp.connect(chargeGain);
        chargeGain.connect(bellGain);
        chargeOsc.start(t);
      } else if (chargeGain) {
        chargeGain.gain.cancelScheduledValues(t);
        chargeGain.gain.setTargetAtTime(0.0001, t, 0.04);
        const osc = chargeOsc;
        chargeOsc = null;
        window.setTimeout(() => {
          try { osc?.stop(); } catch { /* already stopped */ }
        }, 180);
      }
    },
    /** Short invented voice for blurbs and answers. */
    utter() {
      if (!started || !ctx || throne.muted || throne.calm) return;
      const c = ctx;
      const t0 = c.currentTime;
      const freqs = [randRange(18, 28), randRange(32, 48), randRange(54, 72)];
      freqs.forEach((f, i) => {
        const osc = makeOsc(c, i === 0 ? "sine" : "sawtooth", f);
        const lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 90 + i * 40;
        lp.Q.value = 4;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.2 - i * 0.04, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + randRange(0.7, 1.3));
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, f * 0.62), t0 + 0.9);
        osc.connect(lp);
        lp.connect(g);
        g.connect(bellGain);
        osc.start(t0);
        osc.stop(t0 + 1.4);
      });
    },
    /** Wheel-cycle swell: a few dB above the bed, then back. Compressor + cap keep it from spiking. */
    swell() {
      if (!started || !ctx || throne.muted || throne.calm) return;
      const t = ctx.currentTime;
      swellGain.gain.cancelScheduledValues(t);
      swellGain.gain.setValueAtTime(swellGain.gain.value, t);
      swellGain.gain.linearRampToValueAtTime(1.45, t + 1.6);
      swellGain.gain.linearRampToValueAtTime(1.0, t + 4.2);
    },
    /** Live filter depth from the waters slider. */
    setDepth(v) {
      depth = Math.max(0, Math.min(1, Number(v) || 0));
      throne.depth = depth;
    },
    setChoir(on) {
      throne.choir = !!on;
      choirMul = on ? 3.4 : 1;
    },
    unmake() {
      if (!started || !ctx || throne.muted) return;
      const t0 = ctx.currentTime;
      const car = makeOsc(ctx, "sawtooth", 48);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 180;
      lp.Q.value = 5;
      const g = ctx.createGain();
      car.frequency.exponentialRampToValueAtTime(12, t0 + 0.55);
      g.gain.setValueAtTime(0.22, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      car.connect(lp);
      lp.connect(g);
      g.connect(bellGain);
      car.start(t0);
      car.stop(t0 + 0.7);
    },
    consume() {
      if (!started || !ctx || throne.muted) return;
      const t0 = ctx.currentTime;
      const car = makeOsc(ctx, "triangle", 70);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
      car.connect(g);
      g.connect(droneGain);
      car.start(t0);
      car.stop(t0 + 0.75);
    },
    setRapture(on) {
      raptureMul = on ? 2.8 : 1;
      if (!ctx) return;
      const t = ctx.currentTime;
      if (delayG) delayG.gain.setTargetAtTime(on ? 0.38 : 0, t, 0.18);
      if (droneGain) droneGain.gain.setTargetAtTime(0.22 * droneMul * (on ? 1.35 : 1), t, 0.25);
    },
    /** Stacked sub hits, still gain-capped. */
    strike() {
      if (!started || !ctx || throne.muted) return;
      [22, 33, 41, 55].forEach((f, i) => {
        const t0 = ctx.currentTime + i * 0.07;
        const car = makeOsc(ctx, i % 2 ? "sawtooth" : "square", f);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 140;
        lp.Q.value = 4.5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
        car.frequency.exponentialRampToValueAtTime(Math.max(10, f * 0.5), t0 + 1.2);
        car.connect(lp);
        lp.connect(g);
        g.connect(bellGain);
        car.start(t0);
        car.stop(t0 + 1.6);
      });
    },
    /** Father taken. One remaining voice. */
    offer() {
      if (!started || !ctx) return;
      this.setAspect("offered");
      const c = ctx;
      const t0 = c.currentTime;
      if (droneGain) droneGain.gain.setTargetAtTime(0.06, t0, 0.4);
      if (formantGain) formantGain.gain.setTargetAtTime(0.012, t0, 0.35);
      if (delayG) delayG.gain.setTargetAtTime(0.22, t0, 0.2);
      [18, 27, 36].forEach((f, i) => {
        const osc = makeOsc(c, i === 0 ? "sine" : "sawtooth", f);
        const lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 120;
        lp.Q.value = 3;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0 + i * 0.16);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + i * 0.16 + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2);
        osc.connect(lp);
        lp.connect(g);
        g.connect(bellGain);
        osc.start(t0);
        osc.stop(t0 + 3.4);
      });
      const child = makeOsc(c, "sine", 44);
      const cg = c.createGain();
      cg.gain.setValueAtTime(0.0001, t0 + 1.1);
      cg.gain.exponentialRampToValueAtTime(0.12, t0 + 1.5);
      cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 5.5);
      child.connect(cg);
      cg.connect(bellGain);
      child.start(t0 + 1.1);
      child.stop(t0 + 5.6);
    },
    setAspect(id) {
      aspectId = id;
      const table = {
        witness: { formant: 1, drone: 1, extra: 0.0001, noise: 0.18, reverse: false, extraHz: 55 },
        unblinking: { formant: 0.45, drone: 0.7, extra: 0.1, noise: 0.06, reverse: false, extraHz: 41 },
        merkavah: { formant: 1.2, drone: 1.25, extra: 0.14, noise: 0.22, reverse: false, extraHz: 27 },
        waters: { formant: 2.8, drone: 1.1, extra: 0.06, noise: 0.42, reverse: false, extraHz: 22 },
        seraph: { formant: 1.8, drone: 1.05, extra: 0.16, noise: 0.1, reverse: false, extraHz: 33 },
        inverted: { formant: 1.4, drone: 0.95, extra: 0.12, noise: 0.28, reverse: true, extraHz: 18 },
        name: { formant: 0.3, drone: 0.55, extra: 0.2, noise: 0.04, reverse: false, extraHz: 36 },
        hush: { formant: 0.15, drone: 0.35, extra: 0.04, noise: 0.03, reverse: false, extraHz: 29 },
        offered: { formant: 0.4, drone: 0.18, extra: 0.16, noise: 0.02, reverse: false, extraHz: 24 },
      };
      const next = table[id] || table.witness;
      formantMul = next.formant;
      droneMul = next.drone;
      reverseAlways = next.reverse;
      if (!ctx) return;
      const t = ctx.currentTime;
      if (extraGain) extraGain.gain.setTargetAtTime(next.extra, t, 0.25);
      if (extraOsc) extraOsc.frequency.setTargetAtTime(next.extraHz, t, 0.3);
      if (noiseG) noiseG.gain.setTargetAtTime(next.noise, t, 0.3);
    },
    dispose() {
      cancelAnimationFrame(raf);
      started = false;
      if (ctx) ctx.close();
      ctx = null;
    },
  };
}
