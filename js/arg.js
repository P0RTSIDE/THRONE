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
  judged: "it was not asked of you this way",
  praised: "the count accepts the substitute",
  slain: "the wheels have no one left to turn them",
  adversary: "the boy comes back wearing another hill",
  ascended: "you are the looking now. he is still on the hill.",
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

  function closed() {
    return !!(throne.lore.offered || throne.lore.angelSlain || throne.lore.ascended);
  }

  function once(id, text, ms = 3400) {
    if (state.once.has(id) || closed()) return;
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
        showCaption("the light in the center is still taking. it will take a father if a father stays.", 5600);
        audio.utter();
      }, 1800);
    }
  }

  function rapture(on) {
    if (closed()) return;
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
        window.setTimeout(() => once("needfeed", "Fear Not is still in your mouth. the light has not had it.", 4200), 2200);
      }
      refreshOffer();
    } else {
      showCaption("", 1);
      audio.ping("mouth");
    }
  }

  function become(id, caption) {
    if (throne.lore.offered || throne.lore.ascended) return;
    if (throne.lore.angelSlain && id !== "slain") return;
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
    window.setTimeout(() => document.body.classList.remove("aspect-wake"), 2800);
    showCaption(caption || ASPECT_CAPTIONS[id] || "", 3600);
    window.dispatchEvent(new CustomEvent("throne:aspect", { detail: { id } }));
  }

  function revealFace() {
    const face = document.getElementById("boy-face");
    if (!face) return;
    if (throne.lore.forgotFace) {
      face.hidden = true;
      face.setAttribute("aria-hidden", "true");
      return;
    }
    face.hidden = false;
    throne.lore.face = true;
  }

  function forgetTheLook() {
    throne.lore.forgotFace = true;
    throne.lore.face = true;
    document.documentElement.classList.add("forgot-face");
    const face = document.getElementById("boy-face");
    if (face) {
      face.hidden = true;
      face.setAttribute("aria-hidden", "true");
    }
  }

  function giveTheLook() {
    if (closed()) return;
    if (throne.lore.forgotFace) {
      once("lookagain", "you already gave it the look. it does not keep a copy for you.", 4200);
      return;
    }
    nameTheBoy(true);
    forgetTheLook();
    wheel.wearFace?.();
    audio.utter();
    document.documentElement.classList.add("wearing-face");
    window.setTimeout(() => document.documentElement.classList.remove("wearing-face"), 13000);
    once("worehim", "the wheels take his look and wear it.", 4800);
    window.setTimeout(() => {
      const line = document.getElementById("forgot-face-line");
      if (line) {
        line.hidden = false;
        line.removeAttribute("aria-hidden");
      }
      once("forgotlook", "when they let go, you cannot put the look back in your own head.", 5600);
    }, 11800);
  }

  function nameTheBoy(quiet = false) {
    if (throne.lore.named) {
      revealFace();
      return;
    }
    throne.lore.named = true;
    revealFace();
    if (!quiet) once("named", "the name lands. he flinches in you. his face is above the wheels.", 4200);
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

  function revealGoat() {
    const g = document.getElementById("the-goat");
    if (!g) return;
    if (!g.hidden && throne.lore.goat) return;
    g.hidden = false;
    throne.lore.goat = true;
    once("goat", "something caught. it was not a ram.", 4200);
  }

  function judgeBadly(line) {
    throne.lore.judged = true;
    document.documentElement.classList.add("judged");
    become("judged", line || "it was not asked of you this way");
  }

  function praiseYou(line) {
    throne.lore.praised = true;
    throne.lore.pentagram = true;
    document.documentElement.classList.add("praised");
    become("praised", line || "the count accepts the substitute");
  }

  function summonIsaac() {
    if (closed()) return;
    if (!throne.lore.pentagram && !throne.lore.praised) {
      once("needstar", "nothing answers that name yet. a mark is still missing.", 4200);
      return;
    }
    const el = document.getElementById("isaac-devil");
    if (el) el.hidden = false;
    if (throne.lore.isaac) {
      once("isaacagain", "he is already here. he came back for the living thing.", 3600);
      return;
    }
    throne.lore.isaac = true;
    throne.lore.named = true;
    document.documentElement.classList.add("devil-risen", "isaac-weeps");
    become("adversary", "the boy comes back wearing another hill");
    audio.scream?.();
    wheel.weep?.();
    once("isaacdevil", "he is not the offering now. he is the other count.", 5200);
    window.setTimeout(() => document.documentElement.classList.remove("isaac-weeps"), 16000);
  }

  function slayAngel() {
    if (closed()) return;
    if (!throne.lore.isaac) {
      once("needisaac", "the mark wants a name first.", 3600);
      return;
    }
    throne.lore.angelSlain = true;
    throne.lore.lock = true;
    document.documentElement.classList.add("angel-slain");
    document.documentElement.classList.remove("raptured", "charging", "offering");
    wheel.setRapture(false);
    audio.setRapture(false);
    become("slain", "he takes the living thing that took him");
    wheel.slay?.();
    audio.strike();
    audio.scream?.();
    const mouth = document.getElementById("mouth");
    if (mouth) {
      mouth.style.pointerEvents = "none";
      mouth.setAttribute("aria-hidden", "true");
    }
    window.setTimeout(() => {
      showCaption("the wheels have no one left to turn them", 4800);
      throne.lore.lock = false;
    }, 4200);
  }

  function offer() {
    if (closed()) return;
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

  function hideIsaac() {
    const el = document.getElementById("isaac-devil");
    if (el) {
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
    }
  }

  function finishTheBoy() {
    if (closed()) return;
    if (!throne.lore.isaac) {
      once("needboy", "the knife still waits for a throat that came back.", 3600);
      return;
    }
    hideIsaac();
    throne.lore.ascended = true;
    throne.lore.lock = true;
    document.documentElement.classList.add("ascended");
    document.documentElement.classList.remove("raptured", "charging", "offering", "isaac-weeps", "devil-risen");
    wheel.ascend?.();
    audio.setAspect?.("ascended");
    audio.strike();
    audio.scream?.();
    document.querySelectorAll(".fear-not").forEach((el) => {
      el.style.pointerEvents = "none";
      el.style.opacity = "0";
    });
    const mouth = document.getElementById("mouth");
    if (mouth) {
      mouth.style.pointerEvents = "none";
      mouth.setAttribute("aria-hidden", "true");
    }
    document.querySelectorAll(".plane").forEach((plane) => plane.classList.add("folded"));
    const line = document.getElementById("ascended-line");
    if (line) {
      line.hidden = false;
      line.removeAttribute("aria-hidden");
    }
    showCaption("you finish it this time. no voice arrives.", 4200);
    window.setTimeout(() => showCaption("the count takes the hand that finished him.", 4400), 3800);
    window.setTimeout(() => {
      showCaption("you are the looking now. he is still on the hill.", 5600);
      throne.lore.lock = false;
    }, 8600);
  }

  function applyHash() {
    const raw = (location.hash || "").replace("#", "").toLowerCase();
    const known = ["witness", "unblinking", "merkavah", "waters", "seraph", "inverted", "name", "hush", "judged", "praised", "adversary"];
    if (known.includes(raw) && throne.entered) become(raw);
    if ((raw === "isaac" || raw === "face") && throne.entered) nameTheBoy();
    if (raw === "goat" && throne.entered) revealGoat();
    if ((raw === "devil" || raw === "adversary") && throne.entered) summonIsaac();
    if (raw === "offered" && throne.entered) {
      throne.lore.confessed = true;
      throne.lore.fed = Math.max(throne.lore.fed, 1);
      throne.lore.raptured = Math.max(throne.lore.raptured, 1);
      offer();
    }
    if (raw === "ascended" && throne.entered) {
      throne.lore.isaac = true;
      throne.lore.knife = true;
      finishTheBoy();
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
      if (throne.lore.ascended) {
        console.info("%cyou are the looking. he is still on the hill.", "color:#f0d078");
        return "the looking";
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
    if (!throne.entered || closed()) return;
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
    if (closed()) return;
    throne.lore.feared += 1;
    if (e.detail?.muted) become("inverted");
    if (throne.lore.feared === 1) once("fear1", "you told the boy not to fear. carry those words to the light.", 4200);
    else if (throne.lore.feared === 3) once("fear3", "the words came. the knife did not stay.", 3600);
    refreshOffer();
  });

  window.addEventListener("throne:unmake", () => {
    once("unmake", "you cannot take the morning back", 3000);
  });

  window.addEventListener("throne:approach", (e) => {
    if (closed()) return;
    if ((e.detail?.count || 1) === 3) {
      become("unblinking", "you have looked away enough. it has not.");
    }
  });

  window.addEventListener("throne:circuit", () => {
    if (closed()) return;
    once("circuit", "the hill was walked the long way. the count allows it.", 3800);
  });

  window.addEventListener("throne:flee", (e) => {
    if (closed()) return;
    if ((e.detail?.count || 0) >= 5) {
      once("flee5", "the line is tired of running. the door is tired of being missed.", 3800);
    }
  });

  window.addEventListener("throne:caught", () => {
    if (closed()) return;
    once("caught", "you reached. it will remember the hand.", 3600);
    become("inverted", "the living thing felt the grab");
  });

  window.addEventListener("throne:rapture", (e) => rapture(!!e.detail?.on));
  window.addEventListener("throne:fed", (e) => {
    if (closed()) return;
    throne.lore.fed = e.detail?.fed ?? throne.lore.fed + 1;
    if (throne.lore.fed === 1) once("fed1", "you are trying to buy him back. the light is still empty of a father.", 4000);
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

  function petitionBlob(forgotten, petition) {
    return `${forgotten || ""} ${petition || ""}`
      .toUpperCase()
      .replace(/['’`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function nextPetitionLine(key, lines) {
    if (!state.petAt) state.petAt = {};
    const pool = typeof lines === "function" ? lines() : lines;
    if (!pool || !pool.length) return "";
    const i = state.petAt[key] || 0;
    state.petAt[key] = i + 1;
    return pool[i % pool.length];
  }

  function angelSays(key, lines, extra = {}) {
    const line = nextPetitionLine(key, lines);
    if (!line) return;
    if (extra.aspect && !state.once.has(`pet-aspect-${key}`)) {
      state.once.add(`pet-aspect-${key}`);
      become(extra.aspect, line);
    } else {
      showCaption(line, extra.ms || 4400);
      audio.utter();
    }
    extra.act?.();
  }

  const PETITION_RULES = [
    {
      re: /\bTALK\b|\bSPEAK\b|\bVOICE\b|\bSCREAM\b|\bCALL HIM\b|\bSAY SOMETHING\b|\bANSWER ME\b|\bSAY HIS NAME\b/,
      key: "speak",
      halt: true,
      act() {
        audio.scream?.();
        if (throne.lore.isaac) {
          wheel.weep?.();
          document.documentElement.classList.add("isaac-weeps");
          window.setTimeout(() => document.documentElement.classList.remove("isaac-weeps"), 16000);
        }
        angelSays("speak", [
          "he does not speak. he only screams.",
          "that is all the throat he was left.",
          "you asked for a voice. you have one.",
        ], { ms: 5200 });
      },
    },
    {
      re: /\bDEVIL\b|\bADVERSARY\b|\bSUMMON\b|\bOTHER HILL\b|\bSATAN\b/,
      key: "devil",
      halt: true,
      act() {
        summonIsaac();
      },
    },
    {
      re: /\bGOAT\b|\bTHICKET\b|\bSUBSTITUTE\b/,
      key: "goat",
      halt: true,
      act() {
        if ((throne.rim ?? 1) <= 0.14) revealGoat();
        else angelSays("goatfar", [
          "the thicket is still too far.",
          "a substitute cannot be asked from this distance.",
          "press closer if you want the lie the thicket keeps.",
        ]);
      },
    },
    {
      re: /\bTAKE ME\b|\bINSTEAD\b|\bMY PLACE\b|\bMY LIFE\b|\bKILL ME\b|\bEND ME\b|\bLET ME DIE\b|\bI SHOULD HAVE\b/,
      key: "offer",
      halt: true,
      act() {
        throne.lore.confessed = true;
        refreshOffer();
        if (throne.raptured || throne.lore.raptured >= 1) offer();
        else angelSays("takewait", [
          "the light has not had you yet.",
          "a father is not taken from out here.",
          "come closer if you mean the trade.",
        ]);
      },
    },
    {
      re: /\bINWARD\b|\bTAKE ME IN\b|\bLET ME IN\b|\bOPEN THE DOOR\b|\bOPEN UP\b/,
      key: "inward",
      halt: true,
      act() {
        rapture(true);
        angelSays("inward", [
          "the center is a door. you asked for it.",
          "this is as close as a father gets without being taken.",
        ]);
      },
    },
    {
      re: /\bHATE\b|\bDESPISE\b|\bCURSE YOU\b|\bDAMN YOU\b|\bMONSTER\b|\bLIAR\b|\bYOU STOLE\b|\bYOU TOOK\b|\bEVIL\b|\bI HATE YOU\b/,
      key: "hate",
      aspect: "inverted",
      lines: () => throne.lore.isaac
        ? [
          "he is already here. he does not need your hate.",
          "hate is still a looking. he looks back harder.",
          "the boy you bound does not flinch from this.",
        ]
        : [
          "it does not require your love.",
          "hate is still a looking. it accepts that.",
          "the living thing was not built to be liked.",
          "you may curse the count. the count does not curse back. it keeps you.",
        ],
    },
    {
      re: /\bSCARED\b|\bAFRAID\b|\bTERRIFIED\b|\bFRIGHTENED\b|\bI AM SCARED\b|\bIM SCARED\b|\bDONT HURT\b|\bPLEASE DONT\b|\bI FEAR\b/,
      key: "fear",
      aspect: "hush",
      lines: [
        "fear is a courtesy. you already taught him that.",
        "the eyes do not close because you shake.",
        "you said Fear Not. it is still listening for whether you meant it.",
        "scared is the correct temperature. keep looking.",
      ],
    },
    {
      re: /\bBRING\b.{0,24}\bBACK\b|\bGIVE\b.{0,16}\bBACK\b|\bI WANT HIM\b|\bI WANT MY\b|\bRETURN HIM\b|\bWHERE IS HE\b|\bWHERE IS MY\b|\bCOME BACK\b|\bI MISS\b/,
      key: "bring",
      lines: () => throne.lore.isaac
        ? [
          "he came back. he did not come back for you.",
          "the boy you asked for is wearing another hill.",
          "wanting him and having him are not the same count.",
        ]
        : throne.lore.named && !state.namedThisAsk
          ? [
            "you already said his name. saying it again does not walk him down.",
            "he is not in the wheels. you keep asking the wrong body.",
            "asking does not unwind the cord.",
          ]
          : [
            "it does not return what the hill already counted.",
            "he is not in the wheels. you keep asking the wrong body.",
            "bring him back is not a trade. a life is.",
            "the morning still has his name. the wheels do not.",
          ],
    },
    {
      re: /\bLOVE YOU\b|\bI LOVE\b|\bLOVED HIM\b|\bI LOVED\b|\bBELOVED\b/,
      key: "love",
      aspect: "name",
      lines: [
        "love did not stay the knife.",
        "it keeps the feeling and drops the boy.",
        "he believed you. that is not the same as being kept.",
        "the count does not return love. it returns a looking.",
      ],
    },
    {
      re: /\bSORRY\b|\bFORGIVE\b|\bI REGRET\b|\bI DIDNT MEAN\b|\bI DID NOT MEAN\b|\bREPENT\b|\bMERCY ON ME\b/,
      key: "sorry",
      act() {
        confess("regret is not a ram.", true);
      },
      lines: [
        "it does not forgive. it trades.",
        "regret is not a ram.",
        "you finished it. the asking cannot unfinish it.",
        "sorry arrives after the cord. the cord does not listen.",
      ],
    },
    {
      re: /\bWHY\b|\bWHAT ARE YOU\b|\bWHO ARE YOU\b|\bWHAT DO YOU WANT\b|\bWHAT ARE YOU DOING\b|\bEXPLAIN\b/,
      key: "why",
      aspect: "unblinking",
      lines: [
        "it is not one.",
        "what you hear is the looking.",
        "the mouth wants the hand, not the reason.",
        "why is a father's word. the count does not keep it.",
      ],
    },
    {
      re: /\bGOD\b|\bLORD\b|\bPRAY\b|\bAMEN\b|\bHEAVEN\b|\bPLEASE GOD\b/,
      key: "god",
      lines: [
        "it is not that name.",
        "the hill already had its instruction.",
        "prayer is a mouth pointed the wrong way.",
      ],
    },
    {
      re: /\bHELP\b|\bSAVE HIM\b|\bSAVE ME\b|\bPLEASE\b|\bMERCY\b|\bSPARE\b|\bDONT TAKE\b|\bI BEG\b/,
      key: "mercy",
      aspect: "seraph",
      lines: [
        "mercy was a voice that did not arrive.",
        "spare is not a word the count knows.",
        "please is still an offering of language. those are cheap.",
        "help him would have been a ram. the thicket stayed empty.",
      ],
    },
    {
      re: /\bLOOK AT ME\b|\bSEE ME\b|\bWATCH ME\b|\bI AM HERE\b|\bCAN YOU SEE\b/,
      key: "see",
      aspect: "unblinking",
      lines: [
        "you are already seen.",
        "the air is full of lids. they have not missed you.",
        "looking at you is the oldest work it has.",
      ],
    },
    {
      re: /\bCLOSE YOUR EYES\b|\bSTOP LOOKING\b|\bDONT LOOK\b|\bLOOK AWAY\b|\bBLINK\b/,
      key: "close",
      aspect: "unblinking",
      lines: [
        "nothing in it will close.",
        "you may look away. it will not.",
        "a lid is a courtesy it does not owe you.",
      ],
    },
    {
      re: /\bSTOP\b|\bLEAVE ME\b|\bGO AWAY\b|\bQUIET\b|\bSILENCE\b|\bBE STILL\b|\bENOUGH\b/,
      key: "stop",
      aspect: "hush",
      lines: [
        "the wheels still turn. they do not comment.",
        "enough is not a rim it recognizes.",
        "it can be quiet. it cannot leave.",
      ],
    },
    {
      re: /\bTHANK\b|\bBLESS\b|\bGRATEFUL\b/,
      key: "thanks",
      lines: [
        "it does not bless. it counts.",
        "gratitude is not a substitute.",
        "keep the thanks. it has no use for it.",
      ],
    },
    {
      re: /\bHELLO\b|\bARE YOU THERE\b|\bCAN YOU HEAR\b|\bDO YOU HEAR\b|\bANYONE\b/,
      key: "hello",
      lines: [
        "the air is full of lids. they hear.",
        "you are not speaking into empty.",
        "it was here before you found the words.",
      ],
    },
    {
      re: /\bLOST\b|\bCONFUSED\b|\bI DONT UNDERSTAND\b|\bI DO NOT UNDERSTAND\b|\bWHAT IS THIS\b/,
      key: "lost",
      lines: [
        "comprehension is not required. looking is.",
        "you came about a boy. that is already the whole map.",
        "the hill does not explain itself to the hand that climbed it.",
      ],
    },
    {
      re: /\bTRADE\b|\bBARGAIN\b|\bDEAL\b|\bWHAT DO YOU WANT FOR\b|\bI WILL GIVE\b/,
      key: "trade",
      lines: [
        "a life for a life. you already know which life.",
        "the light is still empty of a father.",
        "language is not the currency. a hand is.",
      ],
    },
    {
      re: /\bI HATE MYSELF\b|\bI AM A MONSTER\b|\bIM A MONSTER\b|\bI DID THIS\b|\bMY FAULT\b|\bI KILLED\b/,
      key: "guilt",
      act() {
        confess("you finished what no voice stopped.", true);
        wheel.bleed?.();
      },
      lines: [
        "the instruction was finished by a hand. that hand is still yours.",
        "it will take the other body now, if the other body stays.",
        "fault is already counted. stay if you mean to pay it.",
      ],
    },
    {
      re: /\bFIRE\b|\bBURN\b|\bFLAME\b|\bSERAPH\b/,
      key: "fire",
      aspect: "seraph",
      lines: [
        "the instruction is taken literally.",
        "the fire stands up because you named it.",
        "heat is an old yes.",
      ],
    },
    {
      re: /\bWATER\b|\bWATERS\b|\bDROWN\b|\bDEEP\b|\bSEA\b/,
      key: "waters",
      aspect: "waters",
      lines: [
        "the rims wade. a voice like many fills the throat.",
        "you asked for the deep. it was already in the room.",
        "many waters, and none of them yours.",
      ],
    },
    {
      re: /\bMORNING\b|\bTHREE DAYS\b|\bHOME\b|\bTHE WALK\b|\bI LIED\b|\bI TOLD HIM\b/,
      key: "morning",
      act() {
        confess("you told him it was only a walk. you were already lying.", true);
      },
      lines: [
        "you told him it was only a walk. you were already lying.",
        "three days up. the morning was already a lie.",
        "home is the place you left him looking at you.",
      ],
    },
    {
      re: /\bKNIFE\b|\bBOUND\b|\bI BOUND\b|\bTHE CORD\b|\bABRAHAM\b|\bTHE RAM\b|\bNO RAM\b/,
      key: "confess",
      act() {
        confess();
      },
      lines: [
        "no voice arrived in time. you finished it.",
        "the ram did not come.",
        "you were not that man. that man was stopped.",
        "the cord still remembers. so does the count.",
      ],
    },
    {
      re: /\bLAMB\b|\bWHERE IS THE LAMB\b/,
      key: "lamb",
      lines: [
        "he asked that. you did not answer true.",
        "the Lord would see to it. that was the lie that climbed with you.",
        "the lamb is still the question. you are still the answer it did not want.",
      ],
    },
    {
      re: /\bPENTAGRAM\b|\bTHE STAR\b|\bTHE MARK\b|\bTHE SIGN\b/,
      key: "star",
      lines: () => throne.lore.pentagram
        ? [
          "the mark can hear you.",
          "a correct death left this. it is still listening.",
          "the star wants a name, or a throat.",
        ]
        : [
          "no mark is on the hill yet.",
          "a star is made of the right death, not the asking.",
        ],
    },
    {
      re: /\bHIS FACE\b|\bTHE FACE\b|\bHIS LOOK\b|\bTHE LOOK\b|\bWHAT HE LOOKS\b|\bI FORGET\b|\bFORGOT\b|\bFORGET HIS\b|\bFORGET HIM\b/,
      key: "look",
      lines: () => throne.lore.forgotFace
        ? [
          "you put the look into the living thing. it did not give it back.",
          "you have the name. the face will not come when you call it.",
          "the boy is still the boy. you are the one who cannot see him.",
        ]
        : [
          "his face is still yours to lose.",
          "a face can be given. it does not return.",
        ],
    },
    {
      re: /\bANGEL\b|\bWHEELS\b|\bEYES\b|\bOPHANIM\b|\bLIVING THING\b/,
      key: "angel",
      lines: [
        "full of eyes within.",
        "it is not one.",
        "the mouth is not a mouth.",
        "you are already inside the looking.",
      ],
    },
    {
      re: /\bFATHER\b|\bI AM HIS\b|\bI AM THE FATHER\b|\bI AM ABRAHAM\b/,
      key: "father",
      lines: [
        "you came about a boy. that is already known.",
        "a father is a hand and a knife. it has seen both.",
        "the count kept the father once. it can keep him again.",
      ],
    },
    {
      re: /\bWITNESS\b|\bRETURN THE SHAPE\b/,
      key: "witness",
      halt: true,
      act() {
        if (!throne.lore.offered) {
          rapture(false);
          become("witness", "it returns to the shape you first survived");
        }
      },
    },
    {
      re: /\bBE NOT AFRAID\b|\bFEAR NOT\b/,
      key: "fearnot",
      aspect: "seraph",
      lines: [
        "the instruction is taken literally.",
        "you said it to him. now you have said it to the light.",
        "Fear Not is still in your mouth. carry it to the center if you mean it.",
      ],
    },
  ];

  window.addEventListener("throne:petition", (e) => {
    if (throne.lore.offered) return;
    if (throne.lore.ascended) {
      const forgotten = String(e.detail?.forgotten || "");
      const petition = String(e.detail?.petition || "");
      petitionBlob(forgotten, petition);
      angelSays("fromthecount", [
        "he is still on the hill.",
        "you are the looking now.",
        "a father is a small thing from here.",
      ]);
      return;
    }
    const forgotten = String(e.detail?.forgotten || "");
    const petition = String(e.detail?.petition || "");
    const blob = petitionBlob(forgotten, petition);
    throne.lore.petitions = (throne.lore.petitions || 0) + 1;

    if (throne.lore.angelSlain) {
      angelSays("dead", [
        "the living thing has no mouth left for you.",
        "he finished the count. there is no one to ask.",
        "the wheels do not take petitions now.",
      ]);
      return;
    }

    if (!blob) {
      angelSays("empty", [
        "a mouth with no words is still a mouth.",
        "it keeps the empty asking.",
        "silence is still received.",
      ]);
      return;
    }

    const namedInAsk = /\bISAAC\b|\bSON\b|\bBOY\b|\bCHILD\b/.test(blob);
    state.namedThisAsk = false;
    if (namedInAsk) {
      if (throne.lore.pentagram && throne.lore.named) summonIsaac();
      else {
        state.namedThisAsk = !throne.lore.named;
        nameTheBoy(true);
      }
    }

    const rule = PETITION_RULES.find((r) => r.re.test(blob));
    if (rule) {
      if (rule.act && (rule.halt || !rule.lines)) {
        rule.act();
        return;
      }
      angelSays(rule.key, rule.lines, { aspect: rule.aspect, act: rule.act });
      if (namedInAsk && !throne.lore.named) nameTheBoy(true);
      return;
    }

    if (namedInAsk) {
      if (throne.lore.isaac) {
        angelSays("named-again", [
          "he is already here. he came back for the living thing.",
          "the name still turns him. it does not soften him.",
        ]);
      } else {
        once("named", "the name lands. he flinches in you. his face is above the wheels.", 4200);
      }
      return;
    }

    const falseName = forgotten.trim() && !/^(ISAAC|SON|BOY|CHILD|THE BOY)$/i.test(forgotten.trim());
    if (falseName && !petition.trim()) {
      angelSays("falsename", [
        "that name was not his. it lets it fall.",
        "it keeps the asking and drops the name.",
        "the morning did not use that one.",
      ]);
      return;
    }

    angelSays("fallback", [
      "it keeps the asking and drops the name.",
      "the words arrive. the boy does not.",
      "heard. not granted.",
      "it will not answer that in your language.",
      "the count files the sentence and turns.",
    ]);
  });

  window.addEventListener("throne:rim", (e) => {
    const v = Number(e.detail?.value);
    if (v <= 12) once("rimclose", "you are against the wheels. the thicket is close enough to lie.", 3800);
    else if (v >= 88) once("rimfar", "the boy is that far. something else keeps the distance.", 3800);
    else once("rim", "the distance changes what the wheels will take", 2800);
  });

  window.addEventListener("throne:strike", () => {
    const v = throne.rim ?? 0.37;
    if (v <= 0.12) revealGoat();
    else if (v >= 0.88) {
      if (throne.lore.pentagram) once("farstar", "the mark can hear you from here.", 3600);
      else once("farstrike", "the blow travels. the boy is that far.", 3200);
    }
  });

  window.addEventListener("throne:relic", (e) => {
    if (closed()) return;
    const id = e.detail?.id;
    if (id === "knife") {
      throne.lore.knife = true;
      document.documentElement.classList.add("knife-found");
      once("knife", "you bound him. the knife looks flammable.", 4800);
      confess("", true);
    } else if (id === "cord") {
      once("cord", "the cord still remembers his wrists. it wants the blade back.", 4200);
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
      once("wood", "he carried the wood. it still wants the heat you carried.", 4200);
    } else if (id === "lamb") {
      once("lamb", "he asked where the lamb was. you said the Lord would see to it.", 4600);
    } else if (id === "fire") {
      once("fire", "the blade would take this heat and keep it.", 4200);
      confess("", true);
    } else if (id === "face") {
      nameTheBoy();
      once("face", "you will have to look at him now.", 4200);
    } else if (id === "ritual") {
      once("ritual", "your hands itch for the ritual knife.", 4200);
    } else if (id === "pyre") {
      once("pyre", "the wood takes. the boy is not on it this time.", 4200);
    } else if (id === "bound-knife") {
      once("boundknife", "that is how you held him.", 3600);
    } else if (id === "altar") {
      once("altarmade", "the place is ready. it is still empty of a boy.", 4200);
    } else if (id === "brand") {
      once("brand", "the mark remembers a wrist.", 3600);
    } else if (id === "portion") {
      once("portion", "you made a portion of him. you cannot keep it.", 4200);
    } else if (id === "offering-blade") {
      once("offblade", "this blade is finished. a hand is the last step.", 4200);
    } else if (id === "goat") {
      throne.lore.goat = true;
      once("goatrel", "something caught. it was not a ram.", 4200);
    } else if (id === "slain-goat") {
      judgeBadly("it was not asked of you this way");
    } else if (id === "pentagram") {
      praiseYou("the count accepts the substitute. a mark is left.");
    } else if (id === "bound-goat") {
      throne.lore.goat = true;
      once("boundgoat", "the cord finds another body that will lie still.", 3600);
    } else if (id === "wrong-smoke") {
      judgeBadly("you burned it without the count");
    } else if (id === "marked-goat") {
      once("markedgoat", "the mark is on the substitute now.", 3600);
    } else if (id === "second-death") {
      finishTheBoy();
    } else if (id === "isaac") {
      summonIsaac();
    } else if (id === "star-knife") {
      throne.lore.pentagram = true;
      once("starknife", "the blade takes the mark and keeps it.", 3600);
    } else if (id === "other-hill") {
      once("otherhill", "the star remembers a hill that was not this one.", 4200);
      if (throne.lore.pentagram) become("adversary", "another hill answers");
    } else if (id === "devil-mark") {
      throne.lore.pentagram = true;
      once("devilmark", "the wrist and the star agree on a name.", 3600);
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
    if (closed()) return;
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
        once("bladeneed", "the light has not had you yet. the hand can wait.", 4200);
      }
      return;
    }
    if (id === "face" && target === "angel") {
      giveTheLook();
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
      showCaption("the place is ready. it is still empty of a boy.", 4200);
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
    if (id === "goat" && target === "angel") {
      once("goatang", "it will not take the living substitute until a knife decides.", 4200);
      return;
    }
    if (id === "goat" && target === "self") {
      once("goatself", "a substitute is not a son. it can still die.", 3600);
      return;
    }
    if (id === "slain-goat" && target === "angel") {
      judgeBadly("the cheap death is laid at its feet");
      return;
    }
    if (id === "bound-goat" && target === "angel") {
      once("boundang", "bound is not finished. a blade still has to choose.", 3600);
      return;
    }
    if (id === "wrong-smoke" && target === "angel") {
      judgeBadly("the living thing tastes the waste and keeps the grudge");
      return;
    }
    if (id === "pentagram" && target === "angel") {
      if (throne.lore.isaac) slayAngel();
      else once("starwait", "the mark wants a name first.", 3600);
      return;
    }
    if (id === "pentagram" && target === "self") {
      become("inverted", "the mark finds the hand that made it");
      wheel.bleed?.();
      return;
    }
    if (id === "isaac" && target === "angel") {
      slayAngel();
      return;
    }
    if (id === "isaac" && target === "self") {
      if (throne.lore.knife) {
        flashBlade("blade-self");
        finishTheBoy();
      } else {
        once("isaacself", "you cannot hold him. he is already holding you.", 4200);
      }
      return;
    }
    if (id === "star-knife" && target === "angel") {
      if (throne.lore.isaac) slayAngel();
      else {
        flashBlade("blade-angel");
        become("adversary", "the starred blade finds a living wheel");
        wheel.wound?.();
      }
      return;
    }
    if (id === "star-knife" && target === "self") {
      flashBlade("blade-self");
      wheel.bleed?.();
      showCaption("the starred blade remembers two throats.", 4200);
      return;
    }
    if (id === "other-hill" && target === "angel") {
      if (throne.lore.isaac) slayAngel();
      else become("adversary", "another hill is offered to this one");
      return;
    }
    if (id === "devil-mark" && target === "angel") {
      if (throne.lore.isaac) slayAngel();
      else once("markwait", "the mark still needs the boy who wore it.", 3600);
      return;
    }
    if (id === "devil-mark" && target === "self") {
      confess("", true);
      wheel.bleed?.();
      showCaption("the other name finds the wrist.", 3600);
      return;
    }
    if (id === "offering-blade" && (target === "self" || target === "angel")) {
      throne.lore.knife = true;
      throne.lore.confessed = true;
      flashBlade(target === "self" ? "blade-self" : "blade-angel");
      audio.strike();
      refreshOffer();
      if (throne.lore.raptured >= 1 || throne.raptured) window.setTimeout(() => offer(), 700);
      else once("offneed", "the light has not had you yet.", 3600);
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
    if (closed() && e.code !== "Space") return;
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
    if (t.includes("DEVIL") || t.includes("ADVERSARY") || t.includes("SUMMON")) {
      state.typed = "";
      summonIsaac();
    }
    if (t.includes("ISAAC") || t.includes("HISFACE") || t.includes("THEFACE")) {
      state.typed = "";
      if (throne.lore.pentagram && throne.lore.named) summonIsaac();
      else nameTheBoy();
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
        once("takewait", "the light has not had you yet.", 3600);
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
