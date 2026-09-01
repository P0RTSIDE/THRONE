/**
 * audioEngine.js — Voice of Many Waters
 *
 * All sound is synthesized. No samples, no copyrighted music.
 * Every layer is built to be grand and terrible: sub, tritone, long hall.
 * Hover makes no sound. Nothing small, bright, or pretty.
 *
 * Routing: sources -> hall -> compressor -> calmGain -> muteGain -> master -> destination
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
  let hall = null;
  let hallIn = null;
  let scrapeGain = null;
  let scrapeFilter = null;
  let chargeOsc = null;
  let chargeGain = null;
  let noiseSrc = null;
  let raf = 0;

  function sendToHall(node) {
    if (hallIn) node.connect(hallIn);
  }

  function dreadHit(c, dest, { f, g, d, type = "sawtooth", drop = 0.5, stagger = 0 }) {
    const t0 = c.currentTime + stagger;
    const car = makeOsc(c, type, f);
    const sub = makeOsc(c, "sine", f * 0.5);
    const trit = makeOsc(c, "sawtooth", f * 1.414);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 190;
    lp.Q.value = 5.5;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(g, t0 + 0.08);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    car.frequency.exponentialRampToValueAtTime(Math.max(9, f * drop), t0 + d);
    trit.frequency.exponentialRampToValueAtTime(Math.max(11, f * 1.414 * drop), t0 + d);
    car.connect(lp);
    sub.connect(lp);
    trit.connect(lp);
    lp.connect(out);
    out.connect(dest);
    sendToHall(out);
    car.start(t0);
    sub.start(t0);
    trit.start(t0);
    car.stop(t0 + d + 0.2);
    sub.stop(t0 + d + 0.2);
    trit.stop(t0 + d + 0.2);
  }

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
    droneGain.gain.value = 0.3;
    swellGain = c.createGain();
    swellGain.gain.value = 1;
    formantGain = c.createGain();
    formantGain.gain.value = 0.08;
    bellGain = c.createGain();
    bellGain.gain.value = 0.28;

    hallIn = c.createGain();
    hallIn.gain.value = 0.55;
    const hallLp = c.createBiquadFilter();
    hallLp.type = "lowpass";
    hallLp.frequency.value = 240;
    hallLp.Q.value = 0.7;
    hall = c.createDelay(1.4);
    hall.delayTime.value = 0.52;
    const hallFb = c.createGain();
    hallFb.gain.value = 0.58;
    const hallOut = c.createGain();
    hallOut.gain.value = 0.7;
    hallIn.connect(hallLp);
    hallLp.connect(hall);
    hall.connect(hallFb);
    hallFb.connect(hall);
    hall.connect(hallOut);
    hallOut.connect(comp);

    droneGain.connect(swellGain);
    swellGain.connect(comp);
    swellGain.connect(hallIn);
    formantGain.connect(comp);
    formantGain.connect(hallIn);
    bellGain.connect(comp);
    comp.connect(calmGain);
    calmGain.connect(muteGain);
    muteGain.connect(master);
    master.connect(c.destination);

    // --- Drone: a sub, a beating saw, and a tritone so the floor never consoles ---
    const base = 27.5;
    const specs = [
      { f: base, type: "sine", det: 0 },
      { f: base * 1.008, type: "sawtooth", det: 0.8 },
      { f: base * 0.5, type: "sine", det: -0.1 },
      { f: base * 1.414, type: "sawtooth", det: 0.35 },
    ];
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 110;
    lp.Q.value = 1.4;
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

    extraOsc = makeOsc(c, "sawtooth", base * 1.414);
    extraGain = c.createGain();
    extraGain.gain.value = 0.04;
    extraOsc.connect(extraGain);
    extraGain.connect(droneGain);
    extraOsc.start();

    const delay = c.createDelay(0.9);
    delay.delayTime.value = 0.38;
    delayG = c.createGain();
    delayG.gain.value = 0.2;
    formantGain.connect(delay);
    delay.connect(delayG);
    delayG.connect(comp);

    // --- Formant: a buried throat, never a bright vowel ---
    formantOsc = makeOsc(c, "sawtooth", 36);
    const fg = c.createGain();
    fg.gain.value = 0.28;
    formantOsc.connect(fg);
    const bands = [55, 88, 140];
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
      const baseHz = 55 + depth * 50;
      const hz = baseHz + 16 * Math.sin(now * 0.05) + 8 * Math.sin(now * 0.017 + 1.7);
      lp.frequency.setTargetAtTime(hz, ctx.currentTime, 0.4);
    }
    droneOscs.forEach((osc, i) => {
      const wobble = Math.sin(now * (0.008 + i * 0.002) + i) * (0.22 + i * 0.08);
      osc.detune.setTargetAtTime(wobble * 18, ctx.currentTime, 0.6);
    });

    // Morph formants through invented vowel-ish points; occasional reverse-feeling downward sweep.
    if (formantFilters.length) {
      const reverse = reverseAlways || Math.sin(now * 0.04) > 0.75;
      const a = 0.5 + 0.5 * Math.sin(now * 0.13);
      const targets = reverse
        ? [70 - a * 18, 110 - a * 22, 160 - a * 30]
        : [48 + a * 16, 80 + a * 28, 120 + a * 36];
      formantFilters.forEach((bp, i) => {
        bp.frequency.setTargetAtTime(targets[i], ctx.currentTime, reverse ? 0.08 : 0.6);
      });
      if (formantOsc) {
        formantOsc.frequency.setTargetAtTime(28 + 6 * Math.sin(now * 0.06), ctx.currentTime, 0.4);
      }
      // Sparse presence: voices swell in and out so they are not a constant choir.
      const presence =
        (0.05 + 0.07 * Math.max(0, Math.sin(now * 0.11) * Math.sin(now * 0.037))) *
        choirMul *
        formantMul *
        raptureMul;
      formantGain.gain.setTargetAtTime(presence, ctx.currentTime, 0.5);
    }
    if (droneGain) droneGain.gain.setTargetAtTime(0.3 * droneMul, ctx.currentTime, 0.4);
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
    /** Grand dread. Hover is silent. Everything else is a long, dissonant fall. */
    ping(kind = "click") {
      if (!started || !ctx || throne.muted || throne.calm) return;
      if (kind === "hover") return;
      const table = {
        click: { f: [20, 29], g: 0.34, d: 2.2, drop: 0.42 },
        drag: { f: [16, 24], g: 0.26, d: 1.6, drop: 0.55 },
        zoom: { f: [18, 26], g: 0.24, d: 1.8, drop: 0.48 },
        mouth: { f: [13, 20], g: 0.4, d: 2.8, drop: 0.38 },
      };
      const spec = table[kind] || table.click;
      dreadHit(ctx, bellGain, {
        f: randRange(spec.f[0], spec.f[1]),
        g: spec.g,
        d: spec.d,
        drop: spec.drop,
      });
    },
    /** Grit that follows drag speed. Zero to rest. */
    scrape(speed) {
      if (!scrapeGain || !ctx) return;
      const t = ctx.currentTime;
      const g = !started || throne.muted || throne.calm ? 0 : Math.min(0.36, Math.max(0, speed) * 0.022);
      scrapeGain.gain.setTargetAtTime(g, t, 0.07);
      if (scrapeFilter) {
        scrapeFilter.frequency.setTargetAtTime(36 + Math.min(speed, 48) * 2.4, t, 0.1);
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
        chargeOsc = makeOsc(ctx, "sawtooth", 16);
        chargeGain = ctx.createGain();
        chargeGain.gain.setValueAtTime(0.0001, t);
        chargeGain.gain.exponentialRampToValueAtTime(0.3, t + 0.18);
        chargeOsc.frequency.exponentialRampToValueAtTime(38, t + 1.4);
        const chargeLp = ctx.createBiquadFilter();
        chargeLp.type = "lowpass";
        chargeLp.frequency.value = 130;
        chargeLp.Q.value = 8;
        chargeOsc.connect(chargeLp);
        chargeLp.connect(chargeGain);
        chargeGain.connect(bellGain);
        sendToHall(chargeGain);
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
      dreadHit(ctx, bellGain, {
        f: randRange(15, 22),
        g: 0.3,
        d: 2.4,
        drop: 0.4,
      });
      dreadHit(ctx, bellGain, {
        f: randRange(21, 29),
        g: 0.18,
        d: 2.8,
        drop: 0.46,
        stagger: 0.12,
        type: "square",
      });
    },
    /** Wheel-cycle swell: a few dB above the bed, then back. Compressor + cap keep it from spiking. */
    swell() {
      if (!started || !ctx || throne.muted || throne.calm) return;
      const t = ctx.currentTime;
      swellGain.gain.cancelScheduledValues(t);
      swellGain.gain.setValueAtTime(swellGain.gain.value, t);
      swellGain.gain.linearRampToValueAtTime(1.85, t + 2.2);
      swellGain.gain.linearRampToValueAtTime(1.0, t + 6.4);
    },
    /** Live filter depth from the waters slider. */
    setDepth(v) {
      depth = Math.max(0, Math.min(1, Number(v) || 0));
      throne.depth = depth;
    },
    setChoir(on) {
      throne.choir = !!on;
      choirMul = on ? 4.6 : 1;
    },
    unmake() {
      if (!started || !ctx || throne.muted) return;
      dreadHit(ctx, bellGain, { f: 19, g: 0.36, d: 2.1, drop: 0.28, type: "square" });
    },
    consume() {
      if (!started || !ctx || throne.muted) return;
      dreadHit(ctx, bellGain, { f: 14, g: 0.4, d: 2.6, drop: 0.3 });
    },
    setRapture(on) {
      raptureMul = on ? 3.4 : 1;
      if (!ctx) return;
      const t = ctx.currentTime;
      if (delayG) delayG.gain.setTargetAtTime(on ? 0.55 : 0.2, t, 0.22);
      if (droneGain) droneGain.gain.setTargetAtTime(0.3 * droneMul * (on ? 1.55 : 1), t, 0.3);
      if (hallIn) hallIn.gain.setTargetAtTime(on ? 0.85 : 0.55, t, 0.25);
    },
    scream() {
      if (!started || !ctx || throne.muted) return;
      const hits = [48, 62, 41, 77, 33, 54, 90];
      hits.forEach((f, i) => {
        dreadHit(ctx, bellGain, {
          f,
          g: 0.28,
          d: 3.4,
          drop: 0.22,
          stagger: i * 0.07,
          type: i % 2 ? "square" : "sawtooth",
        });
      });
      if (noiseG) {
        const t = ctx.currentTime;
        noiseG.gain.setTargetAtTime(0.7, t, 0.04);
        noiseG.gain.setTargetAtTime(0.22, t + 1.8, 0.35);
      }
    },
    strike() {
      if (!started || !ctx || throne.muted) return;
      [16, 22, 16 * 1.414, 27].forEach((f, i) => {
        dreadHit(ctx, bellGain, {
          f,
          g: 0.32,
          d: 2.8,
          drop: 0.36,
          stagger: i * 0.11,
          type: i % 2 ? "square" : "sawtooth",
        });
      });
    },
    /** Father taken. One remaining voice. */
    offer() {
      if (!started || !ctx) return;
      this.setAspect("offered");
      const c = ctx;
      const t0 = c.currentTime;
      if (droneGain) droneGain.gain.setTargetAtTime(0.12, t0, 0.5);
      if (formantGain) formantGain.gain.setTargetAtTime(0.02, t0, 0.4);
      if (delayG) delayG.gain.setTargetAtTime(0.45, t0, 0.25);
      if (hallIn) hallIn.gain.setTargetAtTime(0.9, t0, 0.3);
      [13, 18, 13 * 1.414].forEach((f, i) => {
        dreadHit(c, bellGain, {
          f,
          g: 0.34,
          d: 4.2,
          drop: 0.32,
          stagger: i * 0.2,
        });
      });
    },
    setAspect(id) {
      aspectId = id;
      const table = {
        witness: { formant: 1, drone: 1, extra: 0.05, noise: 0.22, reverse: false, extraHz: 27.5 * 1.414 },
        unblinking: { formant: 0.7, drone: 0.85, extra: 0.12, noise: 0.1, reverse: false, extraHz: 22 },
        merkavah: { formant: 1.3, drone: 1.35, extra: 0.16, noise: 0.26, reverse: false, extraHz: 19 },
        waters: { formant: 3.2, drone: 1.2, extra: 0.08, noise: 0.48, reverse: false, extraHz: 16 },
        seraph: { formant: 2.1, drone: 1.15, extra: 0.18, noise: 0.16, reverse: false, extraHz: 24 },
        inverted: { formant: 1.6, drone: 1.05, extra: 0.14, noise: 0.32, reverse: true, extraHz: 14 },
        name: { formant: 0.5, drone: 0.7, extra: 0.2, noise: 0.08, reverse: false, extraHz: 20 },
        hush: { formant: 0.25, drone: 0.5, extra: 0.06, noise: 0.06, reverse: false, extraHz: 18 },
        offered: { formant: 0.55, drone: 0.4, extra: 0.18, noise: 0.05, reverse: false, extraHz: 13 },
        judged: { formant: 1.8, drone: 1.1, extra: 0.16, noise: 0.38, reverse: true, extraHz: 12 },
        praised: { formant: 2.0, drone: 1.2, extra: 0.17, noise: 0.14, reverse: false, extraHz: 26 },
        slain: { formant: 0.15, drone: 0.28, extra: 0.04, noise: 0.04, reverse: false, extraHz: 9 },
        adversary: { formant: 1.9, drone: 1.25, extra: 0.22, noise: 0.4, reverse: true, extraHz: 11 },
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
