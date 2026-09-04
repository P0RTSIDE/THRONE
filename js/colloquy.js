/**
 * colloquy.js — progressive talk with the angel
 *
 * A side-plane tree. Early asks are few. Relics, Fear Not, substitutes,
 * marks, and endings unlock later branches. Choices recompute from lore
 * and touched relics each time they are painted.
 */

import { throne } from "./throne.js";

const touched = new Set();
let rimTouched = false;
let aspectTouched = false;
let approached = false;

function crafted(id) {
  return !!document.querySelector(`[data-relic="${id}"]:not([hidden])`);
}

function revealed(id) {
  const el = document.getElementById(id);
  return !!(el && !el.hidden);
}

function held() {
  const L = throne.lore;
  return {
    knife: !!(L.knife || touched.has("knife") || touched.has("ritual") || touched.has("bound-knife") || touched.has("offering-blade") || touched.has("star-knife")),
    fire: !!(touched.has("fire") || touched.has("pyre") || touched.has("brand")),
    wood: !!(touched.has("wood") || touched.has("pyre") || touched.has("altar")),
    lamb: touched.has("lamb"),
    hill: !!(touched.has("hill") || touched.has("other-hill")),
    ram: touched.has("ram"),
    cord: !!(touched.has("cord") || touched.has("bound-knife") || touched.has("altar") || touched.has("brand")),
    name: !!(L.named || touched.has("name")),
    morning: touched.has("morning"),
    feared: L.feared >= 1,
    fed: L.fed >= 1,
    raptured: L.raptured >= 1 || throne.raptured,
    goat: !!(L.goat || touched.has("goat") || touched.has("bound-goat") || touched.has("marked-goat") || revealed("the-goat")),
    face: !!(L.face || touched.has("face") || revealed("boy-face")),
    isaac: !!(L.isaac || touched.has("isaac") || revealed("isaac-devil")),
    pentagram: !!(L.pentagram || L.praised || touched.has("pentagram") || touched.has("star-knife") || touched.has("devil-mark") || crafted("pentagram")),
    ritual: !!(touched.has("ritual") || touched.has("offering-blade") || crafted("ritual") || crafted("offering-blade")),
    judged: !!(L.judged || touched.has("slain-goat") || touched.has("wrong-smoke")),
    offered: !!L.offered,
    slain: !!L.angelSlain,
    ascended: !!L.ascended,
    forgot: !!L.forgotFace,
    petitions: (L.petitions || 0) > 0,
    aspect: aspectTouched || (throne.aspect && throne.aspect !== "witness"),
    rim: rimTouched,
    pyre: !!(touched.has("pyre") || crafted("pyre")),
    otherHill: !!(touched.has("other-hill") || crafted("other-hill")),
    bladeAngel: !!L.bladeAngel,
    bladeSelf: !!L.bladeSelf,
    canOffer: !!L.canOffer,
    approached,
  };
}

function C(label, to, when) {
  return when ? { label, to, when } : { label, to };
}

const again = C("I came about something else.", "open");
const bringBack = C("How do I bring him back?", "bring");

const NODES = {
  open: {
    line: (h) => {
      if (h.ascended) return "you are what looks now. he is still on the hill.";
      if (h.slain) return "the wheels have no one left to turn them. you still came to talk.";
      if (h.isaac) return "he came back. that is not the boy you walked up with. you still came asking.";
      if (h.offered) return "you already gave yourself. do not ask him about the hill.";
      return "you came about the son who believed you. he is not in the wheels. say what you came to say.";
    },
    choices: [
      C("Where is he?", "where"),
      bringBack,
      C("I will not ask you.", "refuse"),
      C("What of the ram?", "ram"),
      C("I told him Fear Not.", "fear", (h) => h.feared),
      C("The knife is still in my hand.", "knife", (h) => h.knife),
      C("He came back.", "isaac", (h) => h.isaac),
      C("I already offered.", "offered", (h) => h.offered),
    ],
  },

  where: {
    line: (h) => {
      if (h.isaac) return "he is here. he did not walk down with you. he came back another way.";
      if (h.offered) return "he is looking at you. the boy is not in the asking.";
      return "he is not in the wheels. he is not under the wood he carried for you. you already finished the walk.";
    },
    choices: [
      C("Then why can I still hear him?", "hear"),
      C("Is he dead?", "dead"),
      bringBack,
      C("I said his name.", "name", (h) => h.name),
      C("I have the look of him.", "face", (h) => h.face),
      C("He came back.", "isaac", (h) => h.isaac),
      C("I will not ask further.", "refuse"),
    ],
  },

  bring: {
    line: (h) => {
      if (h.ascended) return "you already finished him. the hill kept you instead. that was not a return.";
      if (h.isaac) return "he is already back. that is not the mercy you meant. he came for the living thing.";
      if (h.pentagram) return "a mark is already left. his morning name still fits it, if you can stand to say it.";
      if (h.goat) return "you already made a substitute. it is not a son. do not waste it.";
      return "the hill still has the son you did not withhold. the days have not stopped. you have been counting them.";
    },
    choices: [
      C("What count?", "count"),
      C("Another body, then.", "substitute"),
      C("Tell me plainly.", "plain"),
      C("I told him Fear Not.", "fear", (h) => h.feared),
      C("The knife is still in my hand.", "knife", (h) => h.knife),
      C("Wood and fire know each other.", "pyre", (h) => h.fire && h.wood),
      C("Something else caught.", "goat", (h) => h.goat),
      C("A mark was left.", "mark", (h) => h.pentagram),
      C("He came back.", "isaac", (h) => h.isaac),
      C("I asked for him back already.", "asked", (h) => h.petitions),
      again,
    ],
  },

  refuse: {
    line: "then stop asking. go back to the grade.",
    choices: [
      C("I changed my mind.", "open"),
      C("What of the ram?", "ram"),
      C("I will not.", "colder"),
    ],
  },

  colder: {
    line: "good. silence is cleaner than a father who will not finish.",
    choices: [
      C("I will ask after all.", "open"),
    ],
  },

  ram: {
    line: (h) => (h.goat
      ? "nothing caught that first time. you made the ram up after. something else is already in your hands."
      : "nothing caught. the thicket stayed empty. you made the ram up after."),
    choices: [
      C("Then what caught?", "substitute"),
      bringBack,
      C("I found the empty thicket.", "thicket", (h) => h.ram),
      C("Something else caught.", "goat", (h) => h.goat),
      C("I pressed the measure.", "measure", (h) => h.rim),
      again,
    ],
  },

  hear: {
    line: "if you ask him to speak you will hear the hill. he loved you quietly. that is not him answering.",
    choices: [
      C("I will still call for him.", "petition"),
      bringBack,
      C("I asked for him back already.", "asked", (h) => h.petitions),
      again,
    ],
  },

  dead: {
    line: (h) => (h.isaac
      ? "you finished it once. he came back anyway. walking him down twice is not mercy."
      : "you finished it. you were faithful and no voice arrived. he cannot come down."),
    choices: [
      C("Then what walks down?", "substitute"),
      bringBack,
      C("He walked down already.", "isaac", (h) => h.isaac),
      again,
    ],
  },

  plain: {
    line: "I will not make you a list. look at the days. you have been adding them.",
    choices: [
      C("My hands, then.", "hands"),
      bringBack,
      C("I will not ask you.", "refuse"),
    ],
  },

  count: {
    line: "every day since you did not withhold him. you still add to it. that is how long the son who believed you has been on the hill.",
    choices: [
      C("The right throat.", "throat"),
      C("His morning.", "nameHint"),
      C("Which blade?", "knife", (h) => h.knife),
      C("He asked after the lamb.", "lamb", (h) => h.lamb),
      C("I have another throat.", "goat", (h) => h.goat),
      C("A mark was left.", "mark", (h) => h.pentagram),
      bringBack,
    ],
  },

  throat: {
    line: "a substitute can be accepted. an ordinary death is not. the hill remembers a cheap one.",
    choices: [
      C("Another body, then.", "substitute"),
      C("Which blade?", "knife", (h) => h.knife),
      C("Something else caught.", "goat", (h) => h.goat),
      C("I wasted it.", "wasted", (h) => h.judged),
      bringBack,
    ],
  },

  substitute: {
    line: "a substitute is not a son. the ram never came. if you make another body take his place, do not spend it cheaply.",
    choices: [
      C("Then what do I invent?", "lamb", (h) => h.lamb),
      C("He asked after the lamb.", "lamb", (h) => h.lamb),
      C("The ram is only an absence.", "thicket", (h) => h.ram),
      C("Something else caught.", "goat", (h) => h.goat),
      C("I did not waste it.", "mark", (h) => h.pentagram),
      C("I wasted it.", "wasted", (h) => h.judged),
      bringBack,
    ],
  },

  petition: {
    line: "ask for him. he loved you. he asked where the lamb was and still followed. you did not withhold him, and that faithfulness is honored. asking will not bring him down the hill.",
    choices: [
      C("I asked for him back already.", "asked", (h) => h.petitions),
      C("I said his name.", "name", (h) => h.name),
      bringBack,
      again,
    ],
  },

  asked: {
    line: (h) => (h.name
      ? "you already asked. he still loved you when the knife came. asking again does not bring him down."
      : "you already asked. he did not come down. if you use the name the morning used, the hill will know who you mean."),
    choices: [
      C("His name, then.", "nameHint"),
      C("I said his name.", "name", (h) => h.name),
      bringBack,
      again,
    ],
  },

  hands: {
    line: "you bound him and did not look at his face. he let you, because he loved you. your hands still remember.",
    choices: [
      C("The knife is still in my hand.", "knife", (h) => h.knife),
      C("The fire is still waiting.", "fire", (h) => h.fire),
      C("He carried the wood.", "wood", (h) => h.wood),
      C("The cord has not forgotten.", "cord", (h) => h.cord),
      bringBack,
      again,
    ],
  },

  nameHint: {
    line: "naming him does not return him. you will still have to look at him.",
    choices: [
      C("I said his name.", "name", (h) => h.name),
      C("The morning was already a lie.", "morning", (h) => h.morning),
      C("I have the look of him.", "face", (h) => h.face),
      C("A mark wants a name.", "mark", (h) => h.pentagram),
      bringBack,
    ],
  },

  fear: {
    line: (h) => (h.fed
      ? "you said Fear Not. he heard comfort. you heard a command. the light has had the word. it still wants a father."
      : "you said Fear Not. he heard comfort. you heard a command. he believed you anyway."),
    choices: [
      C("The light.", "mouth"),
      C("I already fed it the word.", "fed", (h) => h.fed),
      bringBack,
      again,
    ],
  },

  mouth: {
    line: "it wants the word, then the hand. words are not enough.",
    choices: [
      C("I already fed it the word.", "fed", (h) => h.fed),
      C("I have been inside.", "inside", (h) => h.raptured),
      C("I told him Fear Not.", "fear", (h) => h.feared),
      C("I turned the blade on the living thing.", "blade", (h) => h.bladeAngel),
      bringBack,
    ],
  },

  fed: {
    line: "you are trying to buy him back. you did not withhold him once. the light still wants a father, not a word.",
    choices: [
      C("I held the center.", "inside", (h) => h.raptured || h.canOffer),
      C("I gave the hand.", "offered", (h) => h.offered),
      C("I turned the blade on my own hand.", "blade", (h) => h.bladeSelf),
      bringBack,
    ],
  },

  inside: {
    line: "the boy is not in here. hold until you are the offering, or leave.",
    choices: [
      C("I stayed.", "offered", (h) => h.offered),
      C("He is not the offering now.", "isaac", (h) => h.isaac),
      C("I will leave this talk.", "colder"),
      bringBack,
    ],
  },

  knife: {
    line: (h) => {
      if (h.isaac) return "the first job is still in the hand. this blade remembers the boy, not the substitute.";
      if (h.ritual) return "your hands itch. this blade already knew which face it was for.";
      return "you bound him and looked past his face. your hands itch for a worse job than the one you already finished.";
    },
    choices: [
      C("Heat, then.", "fire", (h) => h.fire),
      C("The cord has not forgotten.", "cord", (h) => h.cord),
      C("I will not waste it.", "goat", (h) => h.goat),
      C("The ritual is already in the palm.", "ritual", (h) => h.ritual),
      C("The first job is still in the hand.", "second", (h) => h.isaac),
      C("I turned the blade on the living thing.", "blade", (h) => h.bladeAngel),
      C("I turned the blade on my own hand.", "blade", (h) => h.bladeSelf),
      bringBack,
    ],
  },

  fire: {
    line: "the fire is still waiting for the death that was meant.",
    choices: [
      C("He carried the wood.", "wood", (h) => h.wood),
      C("The knife is still in my hand.", "knife", (h) => h.knife),
      C("Wood and fire know each other.", "pyre", (h) => h.wood || h.pyre),
      C("I will not burn it cheap.", "goat", (h) => h.goat),
      bringBack,
    ],
  },

  wood: {
    line: "he carried it because you asked. he loved you enough not to put it down. the place is still empty of him.",
    choices: [
      C("The fire is still waiting.", "fire", (h) => h.fire),
      C("The place.", "cord", (h) => h.cord),
      C("Wood and fire know each other.", "pyre", (h) => h.fire || h.pyre),
      bringBack,
    ],
  },

  pyre: {
    line: "the wood takes. the boy is not on it this time.",
    choices: [
      C("The right throat.", "throat"),
      C("The knife is still in my hand.", "knife", (h) => h.knife),
      C("Something else caught.", "goat", (h) => h.goat),
      bringBack,
    ],
  },

  cord: {
    line: "the cord still remembers his wrists. it will find another body that will lie still.",
    choices: [
      C("The knife is still in my hand.", "knife", (h) => h.knife),
      C("Another body.", "goat", (h) => h.goat),
      C("He carried the wood.", "wood", (h) => h.wood),
      bringBack,
    ],
  },

  lamb: {
    line: "he asked where the lamb was. he still trusted your answer. whatever you invent will not be him.",
    choices: [
      C("Then what do I invent?", "substitute"),
      C("I invented a goat.", "goat", (h) => h.goat),
      bringBack,
      again,
    ],
  },

  hill: {
    line: "three days up he walked beside you and asked nothing but the lamb. you did not withhold him. he is still on the hill.",
    choices: [
      C("Another hill.", "otherHill", (h) => h.pentagram || h.otherHill),
      C("Where is he?", "where"),
      bringBack,
      again,
    ],
  },

  morning: {
    line: "you told him it was only a walk. you were already looking past him. the morning still has his name.",
    choices: [
      C("His name.", "nameHint"),
      C("I said his name.", "name", (h) => h.name),
      bringBack,
    ],
  },

  thicket: {
    line: "the thicket was empty. it only looked like a ram when you were already too close.",
    choices: [
      C("How far?", "measure"),
      C("The lie came true.", "goat", (h) => h.goat),
      bringBack,
    ],
  },

  measure: {
    line: "how far to the boy you cannot see. the thicket only answers when you are already too close.",
    choices: [
      C("Something caught.", "goat", (h) => h.goat),
      C("What of the ram?", "ram"),
      bringBack,
      again,
    ],
  },

  name: {
    line: (h) => (h.face
      ? "he still turns toward that sound. he loved that name in your mouth. naming him does not return him."
      : "he still turns toward that sound. he loved the mouth that named him. calling it does not bring him down."),
    choices: [
      C("I looked.", "face", (h) => h.face),
      C("The mark wants the morning's name.", "mark", (h) => h.pentagram),
      C("The morning was already a lie.", "morning", (h) => h.morning),
      bringBack,
    ],
  },

  face: {
    line: (h) => (h.forgot
      ? "you had the look. you put it into the living thing. you cannot get it back."
      : "you will have to look at him now. you cannot keep his face and the knife. if you give the look away, you will not get it back."),
    choices: [
      C("I already gave the look.", "forgot", (h) => h.forgot),
      C("I cannot keep both.", "knife", (h) => h.knife),
      C("The mark wants the living thing.", "mark", (h) => h.pentagram),
      C("He came back.", "isaac", (h) => h.isaac),
      bringBack,
    ],
  },

  forgot: {
    line: "you have the name. you do not have the face. he is still the boy. you are the one who cannot see him.",
    choices: [
      C("He came back anyway.", "isaac", (h) => h.isaac),
      bringBack,
      again,
    ],
  },

  goat: {
    line: (h) => {
      if (h.judged) return "you already spent the substitute. the cheap death is not forgotten.";
      if (h.pentagram) return "the hill accepted that death. a mark is left. a boy can come back wearing it.";
      return "something caught. it was not a ram. this death can be accepted, if you do not spend it cheaply.";
    },
    choices: [
      C("Which blade?", "knife", (h) => h.knife),
      C("I finished it correctly.", "mark", (h) => h.pentagram),
      C("I wasted it.", "wasted", (h) => h.judged),
      C("The fire is still waiting.", "fire", (h) => h.fire),
      bringBack,
    ],
  },

  wasted: {
    line: "it was not asked of you this way. a substitute can die two deaths. one of them is not forgiven.",
    choices: [
      bringBack,
      C("I will not ask further.", "colder"),
      again,
    ],
  },

  ritual: {
    line: "your hands itch. the last step is still a hand, or a substitute the hill will count.",
    choices: [
      C("The substitute.", "goat", (h) => h.goat),
      C("His face.", "face", (h) => h.face),
      C("The first job is still in the hand.", "second", (h) => h.isaac),
      C("I held the center.", "inside", (h) => h.raptured || h.canOffer),
      bringBack,
    ],
  },

  mark: {
    line: (h) => (h.isaac
      ? "the name fit. he came back. he is not the offering now."
      : "the substitute was accepted. a mark is left. his name can call him back through it."),
    choices: [
      C("I have his name.", "name", (h) => h.name),
      C("I have the look of him.", "face", (h) => h.face),
      C("He came back.", "isaac", (h) => h.isaac),
      C("Another hill answers.", "otherHill", (h) => h.otherHill || h.hill),
      bringBack,
    ],
  },

  otherHill: {
    line: "this is not the hill you walked. he came back by the mark. he is not the offering now.",
    choices: [
      C("He is here.", "isaac", (h) => h.isaac),
      C("The hill is still under us.", "hill", (h) => h.hill),
      bringBack,
    ],
  },

  isaac: {
    line: "he is already here. he came back for the living thing. you cannot hold him. he is already holding you.",
    choices: [
      C("What does he want?", "wants"),
      C("The first job is still in the hand.", "second", (h) => h.knife),
      C("I already gave the living thing.", "offered", (h) => h.offered),
      C("I finished it.", "ascended", (h) => h.ascended),
      C("The wheels are quiet.", "slain", (h) => h.slain),
      C("I will not ask further.", "colder"),
    ],
  },

  wants: {
    line: "he wants the living thing that took him. or a second death with no voice after.",
    choices: [
      C("The look.", "face", (h) => h.face),
      C("A second death.", "second", (h) => h.knife),
      C("I already gave the look.", "forgot", (h) => h.forgot),
      bringBack,
    ],
  },

  second: {
    line: "you finish it this time. no voice arrives. that is not a return.",
    choices: [
      C("I finished it.", "ascended", (h) => h.ascended),
      C("He is already here.", "isaac"),
      C("I will not.", "colder"),
    ],
  },

  offered: {
    line: "he blinks because he can. do not ask him about the hill. you are what looks now.",
    choices: [
      C("Where is the boy?", "where"),
      C("He came back after.", "isaac", (h) => h.isaac),
      again,
    ],
  },

  slain: {
    line: "he finished what finished him. the living thing is quiet. there is no one left to turn the wheels.",
    choices: [
      C("Sit with that.", "colder"),
      C("Begin the ask again.", "open"),
    ],
  },

  ascended: {
    line: "you are what looks now. he is still on the hill. the boy is finished. the hill kept you.",
    choices: [
      C("Begin the ask again.", "open"),
    ],
  },

  blade: {
    line: (h) => {
      if (h.bladeSelf && h.offered) return "you turned the old instruction on the hand that raised it. the light had you. that is a father spent.";
      if (h.bladeSelf) return "you turn the old instruction on the hand that raised it. the light has not always had you yet.";
      return "the living thing takes the cut and keeps turning. a wound is not a return.";
    },
    choices: [
      C("The light.", "mouth"),
      C("I already offered.", "offered", (h) => h.offered),
      bringBack,
      again,
    ],
  },

  attendants: {
    line: "fourfold and also one. they will not introduce themselves. if you call them, the shape you first survived will not keep.",
    choices: [
      C("I pressed the measure.", "measure", (h) => h.rim),
      bringBack,
      again,
    ],
  },

  approach: {
    line: "it will not be touched directly. looking away was the approach. the door was never in front of you.",
    choices: [
      bringBack,
      again,
    ],
  },
};

function lineOf(node, h) {
  return typeof node.line === "function" ? node.line(h) : node.line;
}

function choicesOf(node, h) {
  const list = (node.choices || []).filter((c) => !c.when || c.when(h));
  if (h.hill && node === NODES.open) {
    if (!list.some((c) => c.to === "hill")) list.push(C("The hill is still under us.", "hill"));
  }
  if (h.morning && node === NODES.open) {
    if (!list.some((c) => c.to === "morning")) list.push(C("The morning was already a lie.", "morning"));
  }
  if (h.lamb && node === NODES.open) {
    if (!list.some((c) => c.to === "lamb")) list.push(C("He asked after the lamb.", "lamb"));
  }
  if (h.wood && node === NODES.open) {
    if (!list.some((c) => c.to === "wood")) list.push(C("He carried the wood.", "wood"));
  }
  if (h.fire && node === NODES.open) {
    if (!list.some((c) => c.to === "fire")) list.push(C("The fire is still waiting.", "fire"));
  }
  if (h.cord && node === NODES.open) {
    if (!list.some((c) => c.to === "cord")) list.push(C("The cord has not forgotten.", "cord"));
  }
  if (h.name && node === NODES.open) {
    if (!list.some((c) => c.to === "name")) list.push(C("I said his name.", "name"));
  }
  if (h.face && node === NODES.open) {
    if (!list.some((c) => c.to === "face")) list.push(C("I have the look of him.", "face"));
  }
  if (h.goat && node === NODES.open) {
    if (!list.some((c) => c.to === "goat")) list.push(C("Something else caught.", "goat"));
  }
  if (h.pentagram && node === NODES.open) {
    if (!list.some((c) => c.to === "mark")) list.push(C("A mark was left.", "mark"));
  }
  if (h.aspect && node === NODES.open) {
    if (!list.some((c) => c.to === "attendants")) list.push(C("The attendants have another shape.", "attendants"));
  }
  if (h.approached && node === NODES.open) {
    if (!list.some((c) => c.to === "approach")) list.push(C("I looked away from the door.", "approach"));
  }
  if (h.rim && node === NODES.open) {
    if (!list.some((c) => c.to === "measure")) list.push(C("I pressed the measure.", "measure"));
  }
  if (h.slain && node === NODES.open) {
    if (!list.some((c) => c.to === "slain")) list.push(C("The wheels are quiet.", "slain"));
  }
  if (h.ascended && node === NODES.open) {
    if (!list.some((c) => c.to === "ascended")) list.push(C("I finished it.", "ascended"));
  }
  if (h.forgot && node === NODES.open) {
    if (!list.some((c) => c.to === "forgot")) list.push(C("I already gave the look.", "forgot"));
  }
  return list.length ? list : [C("Begin the ask again.", "open")];
}

export function wireColloquy(audio) {
  const plane = document.getElementById("colloquy");
  const thread = document.getElementById("colloquy-thread");
  const box = document.getElementById("colloquy-choices");
  if (!plane || !thread || !box) return;

  let nodeId = "open";
  let busy = false;
  let lastChoiceKey = "";

  function append(kind, text) {
    const p = document.createElement("p");
    p.className = kind === "you" ? "inscription small colloquy-you" : "inscription colloquy-angel";
    p.textContent = text;
    thread.appendChild(p);
    while (thread.children.length > 8) thread.removeChild(thread.firstChild);
    thread.scrollTop = thread.scrollHeight;
  }

  function paintChoices() {
    const node = NODES[nodeId] || NODES.open;
    const h = held();
    const choices = choicesOf(node, h);
    const key = `${nodeId}|${choices.map((c) => c.to + ":" + c.label).join(";")}`;
    if (key === lastChoiceKey && box.childElementCount) return;
    lastChoiceKey = key;
    box.replaceChildren();
    choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "colloquy-choice";
      btn.textContent = choice.label;
      btn.addEventListener("pointerenter", () => {
        if (throne.rng() > 0.45) audio.ping?.("hover");
      });
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        choose(choice);
      });
      box.appendChild(btn);
    });
  }

  function showNode(id, speak) {
    const node = NODES[id] || NODES.open;
    nodeId = id;
    lastChoiceKey = "";
    const text = lineOf(node, held());
    if (speak) append("angel", text);
    paintChoices();
    plane.querySelector(".plane-body")?.scrollTo?.(0, 9999);
  }

  function choose(choice) {
    if (busy) return;
    const next = NODES[choice.to] ? choice.to : "open";
    busy = true;
    lastChoiceKey = "";
    append("you", choice.label);
    box.replaceChildren();
    const wait = document.createElement("p");
    wait.className = "colloquy-await";
    wait.textContent = "it is still looking";
    box.appendChild(wait);
    audio.ping?.("click");
    window.setTimeout(() => {
      busy = false;
      const node = NODES[next] || NODES.open;
      nodeId = next;
      append("angel", lineOf(node, held()));
      audio.utter?.();
      paintChoices();
      plane.querySelector(".plane-body")?.scrollTo?.(0, 9999);
    }, 340);
  }

  function markRelic(id) {
    if (!id) return;
    touched.add(id);
    if (!busy) paintChoices();
  }

  window.addEventListener("throne:relic", (e) => markRelic(e.detail?.id));
  window.addEventListener("throne:use", (e) => {
    markRelic(e.detail?.id);
    if (e.detail?.target) touched.add(`${e.detail.id}:${e.detail.target}`);
  });
  window.addEventListener("throne:fearnot", () => {
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:fed", () => {
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:offer", () => {
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:petition", () => {
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:rim", () => {
    rimTouched = true;
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:aspect", () => {
    aspectTouched = true;
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:seal", () => {
    aspectTouched = true;
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:approach", () => {
    approached = true;
    if (!busy) paintChoices();
  });
  window.addEventListener("throne:spawn", (e) => markRelic(e.detail?.id));

  append("angel", lineOf(NODES.open, held()));
  paintChoices();
}
