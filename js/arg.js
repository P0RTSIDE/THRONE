/**
 * arg.js — the page keeps a ledger the UI does not read aloud.
 *
 * The visitor is a father. The rest is found, not labeled.
 */

import { throne, showCaption } from "./throne.js";

const ASPECT_CAPTIONS = {
  witness: "it returns to the shape you first survived",
  unblinking: "the eyes lock. nothing in it will close.",
  merkavah: "another rim wakes. the whole count speeds.",
  waters: "the rims wade. a voice like many fills the throat.",
  seraph: "the fire stands up. the wings remember themselves.",
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
    offerHinted: false,
    once: new Set(),
  };

  function once(id, text, ms = 3400) {
    if (state.once.has(id) || throne.lore.offered) return;
    state.once.add(id);
    showCaption(text, ms);
    audio.utter();
  }

  function refreshOffer() {
    const lore = throne.lore;
    if (lore.feared >= 1 && lore.fed >= 1 && lore.raptured >= 1 && !lore.confessed) {
      lore.confessed = true;
      once("confessed", "you finished what no voice stopped", 4200);
    }
    lore.canOffer = !!(
      !lore.offered &&
      lore.raptured >= 1 &&
      (lore.fed >= 1 || lore.feared >= 1 || lore.named || lore.knife || lore.confessed)
    );
    if (lore.canOffer && !state.offerHinted) {
      state.offerHinted = true;
      window.setTimeout(() => {
        showCaption("hold the light in the center. it will take you in his place.", 5600);
        audio.utter();
      }, 1800);
    }
  }

  function rapture(on) {
    if (throne.lore.offered) return;
    if (!!on === throne.raptured) return;
    wheel.setRapture(on);
    audio.setRapture(on);
    if (on) {
      throne.lore.raptured += 1;
      if (throne.lore.raptured === 1) {
        once("rapture1", "you came to trade a life for a life", 3800);
      } else if (!throne.lore.canOffer) {
        showCaption("the boy is not in the wheels", 2400);
        audio.utter();
      }
      if (throne.lore.fed < 1) {
        window.setTimeout(() => once("needfeed", "Fear Not still waits below. carry it into the light.", 4200), 2200);
      }
      refreshOffer();
    } else {
      showCaption("", 1);
      audio.ping("mouth");
    }
  }

  function become(id, caption) {
    if (throne.lore.offered) return;
    if (!id || id === throne.aspect) {
      if (id === throne.aspect && caption) showCaption(caption, 2800);
      return;
    }
    wheel.setAspect(id);
    audio.setAspect(id);
    audio.utter();
    wheel.pulse();
    const now = document.getElementById("shape-now");
    if (now) now.textContent = caption || ASPECT_CAPTIONS[id] || "";
    document.body.classList.add("aspect-wake");
    window.setTimeout(() => document.body.classList.remove("aspect-wake"), 1000);
    showCaption(caption || ASPECT_CAPTIONS[id] || "", 3600);
    window.dispatchEvent(new CustomEvent("throne:aspect", { detail: { id } }));
  }

  function revealFace() {
    const face = document.getElementById("boy-face");
    if (!face) return;
    face.hidden = false;
    throne.lore.face = true;
  }

  function nameTheBoy() {
    if (throne.lore.named) {
      revealFace();
      return;
    }
    throne.lore.named = true;
    revealFace();
    once("named", "the name lands. he flinches in you. his face is above the wheels.", 4200);
    refreshOffer();
  }

  function confess(text, silent = false) {
    if (throne.lore.confessed) {
      refreshOffer();
      return;
    }
    throne.lore.confessed = true;
    if (!silent) once("confessed", text || "no voice arrived in time. you finished it.", 4200);
    window.setTimeout(refreshOffer, 3400);
  }

  function offer() {
    if (throne.lore.offered) return;
    throne.lore.offered = true;
    throne.lore.canOffer = false;
    throne.lore.lock = true;
    document.documentElement.classList.add("offered");
    document.documentElement.classList.remove("offering", "charging", "raptured");
    wheel.setRapture(false);
    audio.setRapture(false);
    wheel.offer();
    audio.offer();
    document.querySelectorAll(".fear-not").forEach((el) => {
      el.style.pointerEvents = "none";
      el.style.opacity = "0";
    });
    const mouth = document.getElementById("mouth");
    if (mouth) {
      mouth.style.pointerEvents = "none";
      mouth.setAttribute("aria-hidden", "true");
    }
    showCaption("it takes the hand that raised it", 2200);
    window.setTimeout(() => showCaption("he opens.", 2400), 2300);
    window.setTimeout(() => {
      showCaption("you are in the count now", 4200);
      throne.lore.lock = false;
    }, 5000);
  }

  function applyHash() {
    const raw = (location.hash || "").replace("#", "").toLowerCase();
    const known = ["witness", "unblinking", "merkavah", "waters", "seraph", "inverted", "name", "hush"];
    if (known.includes(raw) && throne.entered) become(raw);
    if ((raw === "isaac" || raw === "face") && throne.entered) nameTheBoy();
    if (raw === "offered" && throne.entered) {
      throne.lore.confessed = true;
      throne.lore.fed = Math.max(throne.lore.fed, 1);
      throne.lore.raptured = Math.max(throne.lore.raptured, 1);
      offer();
    }
  }

  console.info("%cthe wheels keep a ledger.", "color:#c9a227");
  Object.defineProperty(window, "ledger", {
    configurable: true,
    get() {
      if (throne.lore.offered) {
        console.info("%che is the one eye. you are the rest.", "color:#f0d078");
        return "taken";
      }
      if (throne.lore.confessed) {
        console.info("%cno ram. you did not wait.", "color:#f0d078");
        return "finished";
      }
      if (throne.lore.named) {
        console.info("%csay it again, lower.", "color:#f0d078");
        return "named";
      }
      if (throne.lore.fed >= 1) {
        console.info("%csubstitutes keep failing.", "color:#c9a227");
        return 72;
      }
      console.info("%c72", "color:#f0d078;font-size:18px");
      return 72;
    },
  });

  document.getElementById("days-counter")?.addEventListener("click", () => {
    if (!throne.entered || throne.lore.offered) return;
    const now = performance.now();
    if (now - state.lastDay > 2500) state.daysClicks = 0;
    state.lastDay = now;
    state.daysClicks += 1;
    audio.ping("click");
    if (state.daysClicks === 3) {
      once("days3", "three days to the hill", 3000);
    }
    if (state.daysClicks >= 7) {
      state.daysClicks = 0;
      once("days7", "he did not shut them", 3200);
      become("unblinking");
    }
  });

  window.addEventListener("throne:orbit", (e) => {
    const yaw = Math.abs(Number(e.detail?.yaw) || 0);
    if (!state.merkavahOnce && yaw > Math.PI * 1.2) {
      state.merkavahOnce = true;
      become("merkavah");
      once("orbit", "the whole hill turns with your hand", 3600);
    }
    if ((e.detail?.traveled || 0) > 18) {
      once("drag1", "the hill is still in your hands. the knife waits in the dark.", 4800);
    }
  });

  window.addEventListener("throne:fearnot", (e) => {
    if (throne.lore.offered) return;
    throne.lore.feared += 1;
    if (e.detail?.muted) become("inverted");
    if (throne.lore.feared === 1) once("fear1", "you told the boy not to fear. carry those words to the light.", 4200);
    else if (throne.lore.feared === 3) once("fear3", "the words came. the knife did not stay.", 3600);
    refreshOffer();
  });

  window.addEventListener("throne:unmake", () => {
    once("unmake", "you cannot take the morning back", 3000);
  });

  window.addEventListener("throne:rapture", (e) => rapture(!!e.detail?.on));
  window.addEventListener("throne:fed", (e) => {
    if (throne.lore.offered) return;
    throne.lore.fed = e.detail?.fed ?? throne.lore.fed + 1;
    if (throne.lore.fed === 1) once("fed1", "you are trying to buy him back. hold the center.", 4000);
    else if (throne.lore.fed === 3) once("fed3", "the mouth wants the hand, not the word", 3400);
    if (e.detail?.fed >= 7) rapture(true);
    refreshOffer();
  });
  window.addEventListener("throne:offer", () => offer());

  window.addEventListener("throne:seal", (e) => {
    const id = e.detail?.id;
    if (id) become(id);
  });

  window.addEventListener("throne:return", () => {
    become("witness", "it returns to the shape you first survived");
    document.querySelectorAll("[data-seal]").forEach((b) => b.setAttribute("aria-pressed", "false"));
  });

  window.addEventListener("throne:petition", (e) => {
    if (throne.lore.offered) return;
    const blob = `${e.detail?.forgotten || ""} ${e.detail?.petition || ""}`.toUpperCase();
    if (/\bTALK\b|\bSPEAK\b|\bVOICE\b|\bSCREAM\b|\bCALL HIM\b|\bSAY SOMETHING\b/.test(blob)) {
      audio.scream?.();
      showCaption("he does not speak. he only screams.", 5200);
      return;
    }
    if (/\bISAAC\b|\bSON\b|\bBOY\b|\bCHILD\b/.test(blob)) {
      nameTheBoy();
    } else if (/\bKNIFE\b|\bBOUND\b|\bRAM\b|\bABRAHAM\b/.test(blob)) {
      confess();
    } else if (/\bTAKE ME\b|\bINSTEAD\b|\bMY PLACE\b|\bMY LIFE\b/.test(blob)) {
      throne.lore.confessed = true;
      refreshOffer();
      if (throne.raptured || throne.lore.raptured >= 1) offer();
      else once("takewait", "hold the center first. then write take me again, or hold the center from inside.", 4800);
    } else {
      once("petition", "write Isaac, boy, knife, take me, or talk. it will not guess.", 4200);
    }
  });

  window.addEventListener("throne:rim", () => {
    once("rim", "one more lid lifts on the far side", 2800);
  });

  window.addEventListener("throne:relic", (e) => {
    if (throne.lore.offered) return;
    const id = e.detail?.id;
    if (id === "knife") {
      throne.lore.knife = true;
      document.documentElement.classList.add("knife-found");
      once("knife", "you bound him. the knife did not stay in the bag. it will go where you take it.", 4800);
      confess("", true);
    } else if (id === "cord") {
      once("cord", "the cord still remembers his wrists.", 4200);
      confess("", true);
    } else if (id === "ram") {
      once("ram", "nothing caught in the thicket.", 4200);
      confess("", true);
    } else if (id === "name") {
      nameTheBoy();
    } else if (id === "hill") {
      once("hill", "three days up. you can still feel the grade in your legs.", 4200);
    } else if (id === "morning") {
      once("morning", "you told him it was only a walk. you were already lying.", 4200);
    } else if (id === "wood") {
      once("wood", "he carried the wood. you carried the fire and the knife.", 4200);
    } else if (id === "lamb") {
      once("lamb", "he asked where the lamb was. you said the Lord would see to it.", 4600);
    } else if (id === "fire") {
      once("fire", "you stacked the wood. you reached for him.", 4200);
      confess("", true);
    } else if (id === "face") {
      nameTheBoy();
      once("face", "carry his face to the light if you can still look at it.", 4200);
    } else if (id === "ritual") {
      once("ritual", "a knife that has already known fire. the light or your hand will finish it.", 4800);
    } else if (id === "pyre") {
      once("pyre", "the wood takes. carry the pyre to the light if you still mean the hill.", 4200);
    } else if (id === "bound-knife") {
      once("boundknife", "cord and blade together. that is how you held him.", 4200);
    } else if (id === "altar") {
      once("altarmade", "wood and cord make a place. it is still empty of a boy.", 4200);
    } else if (id === "brand") {
      once("brand", "the mark remembers a wrist. carry it to the hand or the light.", 4200);
    } else if (id === "portion") {
      once("portion", "you made a portion of him. the light will take it.", 4200);
    } else if (id === "offering-blade") {
      once("offblade", "this blade is finished. your hand is the last step.", 4200);
    }
  });

  function flashBlade(kind) {
    const root = document.documentElement;
    root.classList.remove("blade-angel", "blade-self");
    void root.offsetWidth;
    root.classList.add(kind);
    window.setTimeout(() => root.classList.remove(kind), 2800);
  }

  window.addEventListener("throne:use", (e) => {
    if (throne.lore.offered) return;
    const id = e.detail?.id;
    const target = e.detail?.target;
    if (id === "knife" && target === "angel") {
      throne.lore.knife = true;
      throne.lore.bladeAngel = true;
      document.documentElement.classList.add("knife-found");
      confess("", true);
      flashBlade("blade-angel");
      wheel.wound?.();
      audio.strike();
      audio.utter();
      become("inverted", "the living thing takes the cut and keeps turning");
      return;
    }
    if (id === "knife" && target === "self") {
      throne.lore.knife = true;
      throne.lore.bladeSelf = true;
      document.documentElement.classList.add("knife-found");
      confess("you turn the old instruction on the hand that raised it.", true);
      flashBlade("blade-self");
      wheel.bleed?.();
      audio.strike();
      showCaption("you turn the old instruction on the hand that raised it.", 4200);
      if (throne.lore.canOffer || throne.lore.raptured >= 1 || throne.lore.fed >= 1) {
        window.setTimeout(() => offer(), 900);
      } else {
        once("bladeneed", "hold the center once, or carry Fear Not into the light. then the hand will finish it.", 4800);
      }
      return;
    }
    if (id === "face" && target === "angel") {
      nameTheBoy();
      become("name", "one eye is enough, if it is the right one");
      wheel.showFace?.();
      return;
    }
    if (id === "face" && target === "self") {
      nameTheBoy();
      once("faceself", "you cannot keep his face in your hand.", 3600);
      return;
    }
    if (id === "wood" && target === "fire") {
      once("altar", "the wood takes. the boy is not on it this time.", 4200);
      confess("", true);
      wheel.pulse();
      audio.strike();
      return;
    }
    if (id === "cord" && target === "self") {
      once("bound", "you know this knot from the other side.", 3800);
      confess("", true);
      return;
    }
    if (id === "fire" && target === "angel") {
      become("seraph", "the instruction is taken literally");
      return;
    }
    if (id === "ritual" && target === "angel") {
      throne.lore.knife = true;
      confess("", true);
      flashBlade("blade-angel");
      wheel.wound?.();
      audio.strike();
      become("inverted", "the ritual knife finds a living wheel");
      refreshOffer();
      return;
    }
    if (id === "ritual" && target === "self") {
      throne.lore.knife = true;
      throne.lore.confessed = true;
      flashBlade("blade-self");
      wheel.bleed?.();
      audio.strike();
      showCaption("the ritual knife remembers which throat was meant.", 4200);
      refreshOffer();
      if (throne.lore.raptured >= 1 || throne.lore.fed >= 1) window.setTimeout(() => offer(), 900);
      return;
    }
    if (id === "pyre" && target === "angel") {
      confess("", true);
      become("seraph", "the pyre is offered and the wings stand");
      refreshOffer();
      return;
    }
    if (id === "pyre" && target === "self") {
      confess("you stand where the wood was stacked.", true);
      showCaption("you stand where the wood was stacked.", 3600);
      refreshOffer();
      return;
    }
    if (id === "bound-knife" && (target === "self" || target === "angel")) {
      throne.lore.knife = true;
      confess("", true);
      if (target === "angel") {
        flashBlade("blade-angel");
        wheel.wound?.();
        become("inverted", "the cord still holds the blade to the work");
      } else {
        flashBlade("blade-self");
        wheel.bleed?.();
        showCaption("you know this knot from the other side.", 3600);
        if (throne.lore.raptured >= 1) window.setTimeout(() => offer(), 900);
      }
      refreshOffer();
      return;
    }
    if (id === "altar" && (target === "angel" || target === "self")) {
      confess("", true);
      wheel.pulse();
      audio.strike();
      showCaption("the place is ready. Fear Not and the center will finish the trade.", 4200);
      refreshOffer();
      return;
    }
    if (id === "brand" && target === "angel") {
      become("seraph", "the mark is pressed into the living thing");
      return;
    }
    if (id === "brand" && target === "self") {
      confess("", true);
      wheel.bleed?.();
      showCaption("the mark finds the hand that tied it.", 3600);
      refreshOffer();
      return;
    }
    if (id === "portion" && target === "angel") {
      nameTheBoy();
      become("name", "you gave the light a portion of him");
      wheel.showFace?.();
      refreshOffer();
      return;
    }
    if (id === "offering-blade" && (target === "self" || target === "angel")) {
      throne.lore.knife = true;
      throne.lore.confessed = true;
      flashBlade(target === "self" ? "blade-self" : "blade-angel");
      audio.strike();
      refreshOffer();
      if (throne.lore.raptured >= 1 || throne.raptured) window.setTimeout(() => offer(), 700);
      else once("offneed", "hold the center, then bring the offering blade back to your hand.", 4200);
      return;
    }
    if (target === "angel") {
      once(`use-${id}-angel`, "it does not want that offering", 2800);
    } else if (target === "self") {
      once(`use-${id}-self`, "that is not the hand it remembers", 2800);
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
    if (throne.lore.offered && e.code !== "Space") return;
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
    state.typed = (state.typed + e.key.toUpperCase()).slice(-28);
    const t = state.typed;
    if (t.includes("ISAAC") || t.includes("HISFACE") || t.includes("THEFACE")) {
      state.typed = "";
      nameTheBoy();
    }
    if (t.includes("ABRAHAM")) {
      state.typed = "";
      confess("you were not that man. that man was stopped.");
    }
    if (t.includes("NORAM") || t.includes("THERAM")) {
      state.typed = "";
      confess("nothing caught in the thicket.");
    }
    if (t.includes("THEKNIFE") || t.includes("IBOUNDHIM") || t.includes("IDIDIT") || t.includes("IFINISHED")) {
      state.typed = "";
      confess();
    }
    if (t.includes("FORGIVE")) {
      state.typed = "";
      once("forgive", "it does not forgive. it trades.", 3400);
    }
    if (t.includes("TAKEME") || t.includes("INSTEAD") || t.includes("MYPLACE") || t.includes("MYLIFE")) {
      state.typed = "";
      if (throne.raptured || throne.lore.raptured >= 1) {
        throne.lore.confessed = true;
        refreshOffer();
        offer();
      } else {
        once("takewait", "hold the center first. then take me will finish it.", 4200);
      }
    }
    if (t.includes("BENOTAFRAID")) {
      state.typed = "";
      become("seraph");
      once("seraph", "the instruction is taken literally", 3000);
    }
    if (t.includes("MANYWATERS")) {
      state.typed = "";
      become("waters");
    }
    if (t.includes("INWARD")) {
      state.typed = "";
      rapture(true);
    }
    if (t.includes("WITNESS")) {
      state.typed = "";
      if (!throne.lore.offered) {
        rapture(false);
        become("witness", ASPECT_CAPTIONS.witness);
      }
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
