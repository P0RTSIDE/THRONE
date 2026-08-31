/**
 * arg.js — the page keeps a ledger the UI does not read aloud.
 *
 * The visitor is a father. The rest is found, not labeled.
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
    lore.canOffer = !!(lore.confessed && lore.fed >= 1 && lore.raptured >= 1 && !lore.offered);
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
    showCaption(caption || ASPECT_CAPTIONS[id] || "", 3200);
    window.dispatchEvent(new CustomEvent("throne:aspect", { detail: { id } }));
  }

  function nameTheBoy() {
    if (throne.lore.named) return;
    throne.lore.named = true;
    once("named", "the name lands. he flinches in you.", 3800);
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
    if (raw === "isaac" && throne.entered) nameTheBoy();
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
    if (/\bISAAC\b|\bSON\b|\bBOY\b|\bCHILD\b/.test(blob)) {
      nameTheBoy();
    } else if (/\bKNIFE\b|\bBOUND\b|\bRAM\b|\bABRAHAM\b/.test(blob)) {
      confess();
    } else {
      once("petition", "it keeps the asking and drops the name", 3200);
    }
  });

  window.addEventListener("throne:rim", () => {
    once("rim", "one more lid lifts on the far side", 2800);
  });

  window.addEventListener("throne:relic", (e) => {
    if (throne.lore.offered) return;
    const id = e.detail?.id;
    if (id === "knife") {
      once("knife", "you bound him. the knife did not stay in the bag.", 4200);
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
    if (t.includes("ISAAC")) {
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
      if (throne.raptured && (throne.lore.confessed || (throne.lore.named && throne.lore.fed >= 1))) {
        throne.lore.confessed = true;
        refreshOffer();
        offer();
      } else {
        once("takewait", "look around. feed Fear Not to the center. then hold the center from inside.", 4200);
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
